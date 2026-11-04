import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, MovementType, Prisma, StockAdjustmentStatus, StockUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { takeCost } from '../costing/costing';
import { PrismaService } from '../prisma/prisma.service';
import { KHATA_SALE_STATUSES } from '../sales/khata.service';
import { ageDays, stockLeft } from '../stock/stock.lists';

const ZERO = new Prisma.Decimal(0);

export class StockCountDto {
  /** What was counted, in the item's unit (kg, bales or pieces). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  counted!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason!: string;
}

export class StockDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class StockTransferDto {
  @IsString()
  godownId!: string;
}

/** Age buckets for stock ageing (days since the stock was received). */
export const AGE_BUCKETS = [
  { key: '0-30', max: 30 },
  { key: '31-60', max: 60 },
  { key: '61-90', max: 90 },
  { key: '90+', max: Infinity },
] as const;

const money = <T>(allowed: boolean, v: T): T | null => (allowed ? v : null);

/**
 * Inventory in the workspace (enterprise plan E3.3): a stock item's record with its full lineage, movements and
 * counts; stock ageing and valuation; stock counts that change the books only once approved; godown transfers.
 */
@Injectable()
export class StockRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async item(tenantId: string, id: string, canSeeCost: boolean) {
    const i = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        parentItem: { select: { id: true, name: true, repackUnit: { select: { unitCode: true } } } },
        pieces: { select: { id: true, name: true, priceTier: true, quantity: true, usedQuantity: true, totalCost: true, salePrice: true }, orderBy: { createdAt: 'asc' } },
        repackUnit: { select: { id: true, unitCode: true, createdAt: true, qrLabel: { select: { qrCode: true } } } },
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, movementType: true, quantityKg: true, quantityPcs: true, createdAt: true, metadataJson: true } },
      },
    });
    if (!i) throw new NotFoundException('Stock item not found');
    const { left, value, leftKg } = stockLeft(i);

    const [allocations, lines, adjustments, godowns] = await Promise.all([
      i.repackUnitId
        ? this.prisma.repackInputAllocation.findMany({
            where: { tenantId, repackUnitId: i.repackUnitId },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              amountUsed: true, measurementType: true, allocatedCost: true, containerId: true, ragBaleId: true,
              gradingOutput: { select: { grade: { select: { name: true } }, gradeBucket: { select: { gradeSession: { select: { categoryOutput: { select: { category: { select: { name: true } } } } } } } } } },
              categoryOutput: { select: { category: { select: { name: true } } } },
            },
          })
        : Promise.resolve([]),
      this.prisma.saleLine.findMany({
        where: { inventoryItemId: id, sale: { tenantId, status: { in: KHATA_SALE_STATUSES } } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, unit: true, quantity: true, unitPrice: true, lineTotal: true, lineCost: true, profit: true, sale: { select: { id: true, saleNumber: true, createdAt: true, customer: { select: { name: true } } } } },
      }),
      this.prisma.stockAdjustment.findMany({ where: { tenantId, inventoryItemId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.warehouse.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);
    // Where it came from: container and lot per input (bales can mix several).
    const containerIds = [...new Set(allocations.map((a) => a.containerId).filter((x): x is string => !!x))];
    const ragIds = [...new Set(allocations.map((a) => a.ragBaleId).filter((x): x is string => !!x))];
    const [containers, rags] = await Promise.all([
      this.prisma.container.findMany({ where: { tenantId, id: { in: containerIds } }, select: { id: true, containerNumber: true, vendor: { select: { id: true, name: true } } } }),
      this.prisma.rag.findMany({ where: { tenantId, id: { in: ragIds } }, select: { id: true, ragCode: true } }),
    ]);
    const containerOf = new Map(containers.map((c) => [c.id, c]));
    const ragOf = new Map(rags.map((r) => [r.id, r]));
    const people = await this.people(tenantId, adjustments.flatMap((a) => [a.requestedBy, a.decidedBy]));

    return {
      item: {
        id: i.id, code: i.repackUnit?.unitCode ?? null, name: i.name ?? ([i.category?.name, i.grade?.name].filter(Boolean).join(' ') || null),
        category: i.category, grade: i.grade, source: i.source, unit: i.unit, status: i.status, quantity: i.quantity, used: i.usedQuantity, left,
        weightKg: i.weightKg, leftKg, pcsCount: i.pcsCount, salePrice: i.salePrice, priceTier: i.priceTier, createdAt: i.createdAt, ageDays: ageDays(i.createdAt),
        godown: i.warehouse, supplier: i.vendor, parent: i.parentItem ? { id: i.parentItem.id, name: i.parentItem.repackUnit?.unitCode ?? i.parentItem.name } : null,
        qrCode: i.repackUnit?.qrLabel?.qrCode ?? null, repackUnitId: i.repackUnitId,
      },
      cost: canSeeCost ? { total: i.totalCost, unitCost: i.unitCost, valueLeft: value } : null,
      lineage: allocations.map((a) => {
        const c = a.containerId ? containerOf.get(a.containerId) : undefined;
        const category = a.gradingOutput?.gradeBucket.gradeSession.categoryOutput.category.name ?? a.categoryOutput?.category.name ?? null;
        return {
          container: c ? { id: c.id, number: c.containerNumber } : null,
          supplier: c?.vendor ?? null,
          lot: a.ragBaleId && ragOf.get(a.ragBaleId) ? { id: a.ragBaleId, code: ragOf.get(a.ragBaleId)!.ragCode } : null,
          category,
          grade: a.gradingOutput?.grade.name ?? null,
          amount: a.amountUsed,
          measure: a.measurementType,
          cost: money(canSeeCost, a.allocatedCost),
        };
      }),
      pieces: i.pieces.map((p) => ({ id: p.id, name: p.name, priceTier: p.priceTier, quantity: p.quantity, left: p.quantity.sub(p.usedQuantity), salePrice: p.salePrice, cost: money(canSeeCost, p.totalCost) })),
      sales: lines.map((l) => ({
        id: l.sale.id, number: l.sale.saleNumber, date: l.sale.createdAt, customer: l.sale.customer.name, unit: l.unit, quantity: l.quantity,
        unitPrice: l.unitPrice, total: l.lineTotal, cost: money(canSeeCost, l.lineCost), profit: money(canSeeCost, l.profit),
      })),
      movements: i.stockMovements.map((m) => ({ id: m.id, type: m.movementType, kg: m.quantityKg, pcs: m.quantityPcs, date: m.createdAt, details: m.metadataJson })),
      counts: adjustments.map((a) => ({
        id: a.id, status: a.status, book: a.bookQuantity, counted: a.countedQuantity, difference: a.countedQuantity.sub(a.bookQuantity), reason: a.reason,
        requestedBy: people.get(a.requestedBy) ?? null, decidedBy: a.decidedBy ? people.get(a.decidedBy) ?? null : null, decidedAt: a.decidedAt,
        note: a.decisionNote, date: a.createdAt, costChange: money(canSeeCost, a.costChange),
      })),
      godowns,
    };
  }

  /** Stock ageing and valuation over what is left (available or reserved). */
  async summary(tenantId: string, canSeeCost: boolean, now = new Date()) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, status: { not: InventoryStatus.SOLD } },
      select: {
        quantity: true, usedQuantity: true, totalCost: true, unit: true, weightKg: true, createdAt: true,
        category: { select: { name: true } }, warehouse: { select: { name: true } },
      },
    });
    const ageing = AGE_BUCKETS.map((b) => ({ bucket: b.key, items: 0, kg: ZERO, value: ZERO }));
    const byCategory = new Map<string, { name: string; items: number; kg: Prisma.Decimal; value: Prisma.Decimal }>();
    const ageByCategory = new Map<string, Record<string, { kg: Prisma.Decimal; value: Prisma.Decimal }>>();
    const byGodown = new Map<string, { name: string; items: number; kg: Prisma.Decimal; value: Prisma.Decimal }>();
    let total = { items: 0, kg: ZERO, value: ZERO };
    const add = (row: { items: number; kg: Prisma.Decimal; value: Prisma.Decimal }, kg: Prisma.Decimal, value: Prisma.Decimal) => {
      row.items += 1;
      row.kg = row.kg.add(kg);
      row.value = row.value.add(value);
    };
    for (const i of items) {
      const { left, value, leftKg } = stockLeft(i);
      if (left.lessThanOrEqualTo(0)) continue;
      const kg = leftKg ?? ZERO;
      const age = ageDays(i.createdAt, now);
      const bucket = AGE_BUCKETS.findIndex((b) => age <= b.max);
      add(ageing[bucket], kg, value);
      const cat = i.category?.name ?? '';
      const row = ageByCategory.get(cat) ?? Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, { kg: ZERO, value: ZERO }]));
      row[AGE_BUCKETS[bucket].key] = { kg: row[AGE_BUCKETS[bucket].key].kg.add(kg), value: row[AGE_BUCKETS[bucket].key].value.add(value) };
      ageByCategory.set(cat, row);
      if (!byCategory.has(cat)) byCategory.set(cat, { name: cat, items: 0, kg: ZERO, value: ZERO });
      add(byCategory.get(cat)!, kg, value);
      const gd = i.warehouse?.name ?? '';
      if (!byGodown.has(gd)) byGodown.set(gd, { name: gd, items: 0, kg: ZERO, value: ZERO });
      add(byGodown.get(gd)!, kg, value);
      total = { items: total.items + 1, kg: total.kg.add(kg), value: total.value.add(value) };
    }
    const hide = <T extends { value: Prisma.Decimal }>(r: T) => ({ ...r, value: money(canSeeCost, r.value) });
    const pendingCounts = await this.prisma.stockAdjustment.count({ where: { tenantId, status: StockAdjustmentStatus.PENDING } });
    return {
      total: hide(total),
      ageing: ageing.map(hide),
      byCategory: [...byCategory.values()].sort((a, b) => b.value.comparedTo(a.value) || b.kg.comparedTo(a.kg)).map(hide),
      byGodown: [...byGodown.values()].sort((a, b) => b.value.comparedTo(a.value) || b.kg.comparedTo(a.kg)).map(hide),
      pendingCounts,
      ageByCategory: [...ageByCategory.entries()].map(([name, b]) => ({
        name,
        buckets: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { kg: v.kg, value: money(canSeeCost, v.value) }])),
      })),
    };
  }

  /** A count that differs from the books; nothing changes until it is approved. */
  async requestCount(tenantId: string, id: string, dto: StockCountDto, userId: string) {
    const i = await this.prisma.inventoryItem.findFirst({ where: { id, tenantId }, select: { id: true, quantity: true, usedQuantity: true, unit: true } });
    if (!i) throw new NotFoundException('Stock item not found');
    const book = i.quantity.sub(i.usedQuantity);
    const counted = new Prisma.Decimal(dto.counted);
    if (counted.equals(book)) throw new BadRequestException('The count matches the books; nothing to change');
    if (i.unit !== StockUnit.KG && !counted.isInteger()) throw new BadRequestException('Bales and pieces are counted in whole numbers');
    if (counted.greaterThan(i.quantity)) throw new BadRequestException('More than was received: receive the extra as new stock');
    if (await this.prisma.stockAdjustment.count({ where: { tenantId, inventoryItemId: id, status: StockAdjustmentStatus.PENDING } })) {
      throw new ConflictException('A count for this item is already waiting for approval');
    }
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.stockAdjustment.create({
        data: { tenantId, inventoryItemId: id, bookQuantity: book, countedQuantity: counted, reason: dto.reason.trim(), requestedBy: userId },
      });
      await tx.auditLog.create({
        data: { tenantId, userId, action: 'STOCK_COUNT_ENTERED', entityType: 'InventoryItem', entityId: id, metadataJson: { adjustmentId: a.id, book: book.toString(), counted: counted.toString(), reason: a.reason } },
      });
      return a;
    });
  }

  /**
   * Approve: the difference is written off (or added back) at the item's cost by position, exactly like a
   * sale takes cost, so the cost chain still adds up. The books must not have moved since the count.
   */
  async decide(tenantId: string, adjustmentId: string, approve: boolean, dto: StockDecisionDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.stockAdjustment.findFirst({ where: { id: adjustmentId, tenantId } });
      if (!a) throw new NotFoundException('Stock count not found');
      if (a.status !== StockAdjustmentStatus.PENDING) throw new ConflictException('This count was already decided');
      const i = await tx.inventoryItem.findFirstOrThrow({ where: { id: a.inventoryItemId, tenantId } });
      const book = i.quantity.sub(i.usedQuantity);
      if (approve && !book.equals(a.bookQuantity)) {
        throw new ConflictException('Stock moved since this count (a sale or another change); count again');
      }
      let costChange: Prisma.Decimal | null = null;
      if (approve) {
        const diff = a.countedQuantity.sub(a.bookQuantity);
        const src = { cost: i.totalCost, kg: i.quantity };
        let used: Prisma.Decimal;
        if (diff.isNegative()) {
          const take = diff.neg();
          costChange = takeCost(src, i.usedQuantity, take).neg();
          used = i.usedQuantity.add(take);
        } else {
          if (diff.greaterThan(i.usedQuantity)) throw new ConflictException('More than was received: receive the extra as new stock');
          costChange = takeCost(src, i.usedQuantity.sub(diff), diff);
          used = i.usedQuantity.sub(diff);
        }
        await tx.inventoryItem.update({
          where: { id: i.id },
          data: { usedQuantity: used, status: used.equals(i.quantity) ? InventoryStatus.SOLD : i.status === InventoryStatus.SOLD ? InventoryStatus.AVAILABLE : i.status },
        });
        const kgPerUnit = i.unit === StockUnit.KG ? new Prisma.Decimal(1) : i.weightKg && !i.quantity.isZero() ? i.weightKg.div(i.quantity) : ZERO;
        await tx.stockMovement.create({
          data: {
            inventoryItemId: i.id, movementType: MovementType.ADJUSTMENT, referenceId: a.id,
            quantityKg: kgPerUnit.mul(diff).toDecimalPlaces(2), quantityPcs: i.unit === StockUnit.KG ? 0 : diff.toNumber(),
            metadataJson: { kind: 'COUNT', unit: i.unit, quantity: diff.toString(), adjustmentId: a.id, reason: a.reason },
          },
        });
      }
      const done = await tx.stockAdjustment.update({
        where: { id: a.id },
        data: { status: approve ? StockAdjustmentStatus.APPROVED : StockAdjustmentStatus.REJECTED, decidedBy: userId, decidedAt: new Date(), decisionNote: dto.note?.trim() || null, costChange },
      });
      await tx.auditLog.create({
        data: {
          tenantId, userId, action: approve ? 'STOCK_COUNT_APPROVED' : 'STOCK_COUNT_REJECTED', entityType: 'InventoryItem', entityId: i.id,
          metadataJson: { adjustmentId: a.id, book: a.bookQuantity.toString(), counted: a.countedQuantity.toString(), costChange: costChange?.toString() ?? null },
        },
      });
      return done;
    });
  }

  /** Move what is left of an item to another godown. */
  async transfer(tenantId: string, id: string, dto: StockTransferDto, userId: string) {
    const [i, to] = await Promise.all([
      this.prisma.inventoryItem.findFirst({ where: { id, tenantId }, include: { warehouse: { select: { id: true, name: true } } } }),
      this.prisma.warehouse.findFirst({ where: { id: dto.godownId, tenantId, isActive: true }, select: { id: true, name: true } }),
    ]);
    if (!i) throw new NotFoundException('Stock item not found');
    if (!to) throw new NotFoundException('Godown not found');
    if (i.warehouseId === to.id) throw new BadRequestException('Already in this godown');
    const { left, leftKg } = stockLeft(i);
    if (left.lessThanOrEqualTo(0)) throw new ForbiddenException('Nothing left to move');
    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({ where: { id }, data: { warehouseId: to.id } });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: id, movementType: MovementType.TRANSFER, quantityKg: leftKg ?? ZERO, quantityPcs: i.unit === StockUnit.KG ? 0 : left.toNumber(),
          metadataJson: { kind: 'TRANSFER', from: i.warehouse?.name ?? null, fromId: i.warehouseId, to: to.name, toId: to.id, quantity: left.toString(), unit: i.unit },
        },
      });
      await tx.auditLog.create({
        data: { tenantId, userId, action: 'STOCK_TRANSFERRED', entityType: 'InventoryItem', entityId: id, metadataJson: { from: i.warehouse?.name ?? null, to: to.name, quantity: left.toString() } },
      });
      return { id, godown: to };
    });
  }

  private async people(tenantId: string, ids: (string | null)[]): Promise<Map<string, string>> {
    const want = [...new Set(ids.filter((x): x is string => !!x))];
    if (!want.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { tenantId, id: { in: want } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }
}
