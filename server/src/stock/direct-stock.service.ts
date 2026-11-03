import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, MovementType, Prisma, StockSource, StockUnit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../audit/audit.service';
import { costPerKg, dec, money, pieceCosts, takeCost } from '../costing/costing';
import { PrismaService } from '../prisma/prisma.service';
import { OpenBaleDto, ReceiveReadyStockDto } from './stock.dto';

type Tx = Prisma.TransactionClient;

const itemInclude = {
  category: { select: { id: true, name: true } },
  grade: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true } },
} satisfies Prisma.InventoryItemInclude;

/**
 * Stock bought ready to sell (journey 5) and bales opened into pieces.
 * Bought stock costs what was paid for it. Opening a bale moves its cost into the pieces.
 */
@Injectable()
export class DirectStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async receive(tenantId: string, dto: ReceiveReadyStockDto, userId: string) {
    const name = dto.name?.trim() || null;
    if (!name && !dto.categoryId) throw new BadRequestException('Give the stock a name or pick a category');
    const quantity = dec(dto.quantity);
    if (dto.unit !== StockUnit.KG && !quantity.isInteger()) {
      throw new BadRequestException('Bales and pieces are counted in whole numbers');
    }
    await this.assertOwnRefs(tenantId, dto);

    const totalCost = money(dto.totalCost);
    const weightKg = dto.unit === StockUnit.KG ? quantity : dto.weightKg ? dec(dto.weightKg) : null;
    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          tenantId,
          source: StockSource.PURCHASED,
          name,
          categoryId: dto.categoryId ?? null,
          gradeId: dto.gradeId ?? null,
          vendorId: dto.vendorId ?? null,
          warehouseId: dto.warehouseId ?? null,
          unit: dto.unit,
          quantity,
          totalCost,
          unitCost: costPerKg(totalCost, quantity),
          salePrice: dto.salePrice === undefined ? null : money(dto.salePrice),
          weightKg,
          avgCost: weightKg ? money(costPerKg(totalCost, weightKg)) : null,
          pcsCount: dto.unit === StockUnit.PIECE ? quantity.toNumber() : 0,
          status: InventoryStatus.AVAILABLE,
        },
        include: itemInclude,
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: created.id,
          movementType: MovementType.INTAKE,
          quantityKg: weightKg ?? 0,
          quantityPcs: created.pcsCount,
          metadataJson: { source: StockSource.PURCHASED, unit: dto.unit, quantity: quantity.toFixed(2), totalCost: totalCost.toFixed(2) },
        },
      });
      return created;
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'STOCK_RECEIVED',
      entityType: 'InventoryItem',
      entityId: item.id,
      metadataJson: { unit: item.unit, quantity: item.quantity.toFixed(2), totalCost: item.totalCost.toFixed(2) },
    });
    return item;
  }

  /** Opens whole bales into pieces counted by price tier. Every piece of the opened bales costs the same. */
  async open(tenantId: string, itemId: string, dto: OpenBaleDto, userId: string) {
    const bales = dec(dto.bales ?? 1);
    const result = await this.prisma.$transaction(async (tx) => {
      const bale = await tx.inventoryItem.findFirst({ where: { id: itemId, tenantId } });
      if (!bale) throw new NotFoundException('Stock item not found');
      if (bale.unit !== StockUnit.BALE) throw new BadRequestException('Only bales can be opened into pieces');
      const left = bale.quantity.sub(bale.usedQuantity);
      if (bales.greaterThan(left)) throw new ConflictException(`Only ${left.toFixed(0)} bale(s) left to open`);

      const cost = takeCost({ cost: bale.totalCost, kg: bale.quantity }, bale.usedQuantity, bales);
      await this.use(tx, bale, bales);
      const openedKg = bale.weightKg ? money(bale.weightKg.mul(bales).div(bale.quantity)) : null;
      await tx.stockMovement.create({
        data: {
          inventoryItemId: bale.id,
          movementType: MovementType.ADJUSTMENT,
          quantityKg: openedKg ?? 0,
          metadataJson: { reason: 'OPENED', bales: bales.toFixed(0), cost: cost.toFixed(2) },
        },
      });

      const shares = pieceCosts(cost, dto.tiers.map((tier, index) => ({ key: index, pieces: tier.pieces })));
      const pieces = [];
      for (const share of shares) {
        const tier = dto.tiers[share.key];
        const piece = await tx.inventoryItem.create({
          data: {
            tenantId,
            source: bale.source,
            parentItemId: bale.id,
            name: bale.name,
            categoryId: bale.categoryId,
            gradeId: bale.gradeId,
            vendorId: bale.vendorId,
            warehouseId: bale.warehouseId,
            containerId: bale.containerId,
            ragId: bale.ragId,
            unit: StockUnit.PIECE,
            quantity: tier.pieces,
            pcsCount: tier.pieces,
            totalCost: share.amount,
            unitCost: costPerKg(share.amount, tier.pieces),
            salePrice: money(tier.price),
            priceTier: tier.label?.trim() || money(tier.price).toFixed(0),
            status: InventoryStatus.AVAILABLE,
          },
          include: itemInclude,
        });
        await tx.stockMovement.create({
          data: {
            inventoryItemId: piece.id,
            movementType: MovementType.INTAKE,
            quantityKg: 0,
            quantityPcs: tier.pieces,
            referenceId: bale.id,
            metadataJson: { reason: 'OPENED_FROM', parentItemId: bale.id },
          },
        });
        pieces.push(piece);
      }
      return { baleId: bale.id, balesOpened: bales, cost, pieces };
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'STOCK_OPENED',
      entityType: 'InventoryItem',
      entityId: itemId,
      metadataJson: { bales: result.balesOpened.toFixed(0), cost: result.cost.toFixed(2), pieceItems: result.pieces.map((p) => p.id) },
    });
    return result;
  }

  /**
   * Marks `amount` of an item as used (sold or opened). Guarded on the amount read, so two
   * people cannot use the same stock at once.
   */
  async use(tx: Tx, item: { id: string; tenantId: string; quantity: Decimal; usedQuantity: Decimal }, amount: Decimal) {
    const used = item.usedQuantity.add(amount);
    const updated = await tx.inventoryItem.updateMany({
      where: { id: item.id, tenantId: item.tenantId, usedQuantity: item.usedQuantity },
      data: { usedQuantity: used, status: used.equals(item.quantity) ? InventoryStatus.SOLD : InventoryStatus.AVAILABLE },
    });
    if (updated.count !== 1) throw new ConflictException('This stock just changed. Please try again.');
  }

  private async assertOwnRefs(tenantId: string, dto: ReceiveReadyStockDto) {
    const [vendor, category, grade, warehouse] = await Promise.all([
      dto.vendorId ? this.prisma.vendor.findFirst({ where: { id: dto.vendorId, tenantId }, select: { id: true } }) : true,
      dto.categoryId ? this.prisma.category.findFirst({ where: { id: dto.categoryId, tenantId }, select: { id: true } }) : true,
      dto.gradeId ? this.prisma.grade.findFirst({ where: { id: dto.gradeId, tenantId }, select: { id: true } }) : true,
      dto.warehouseId ? this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId }, select: { id: true } }) : true,
    ]);
    if (!vendor) throw new BadRequestException('Supplier not found');
    if (!category) throw new BadRequestException('Category not found');
    if (!grade) throw new BadRequestException('Grade not found');
    if (!warehouse) throw new BadRequestException('Warehouse not found');
  }
}
