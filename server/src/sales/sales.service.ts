import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryStatus,
  MeasurementType,
  MovementType,
  Prisma,
  SaleStatus,
  SaleType,
  SequenceScope,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSequenceService } from '../procurement/shared/tenant-sequence.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: TenantSequenceService,
    private readonly audit: AuditService,
  ) {}

  private ensureDraft(sale: { status: SaleStatus }) {
    if (sale.status !== SaleStatus.DRAFT) {
      throw new ForbiddenException('Only DRAFT sales are editable');
    }
  }

  private toMoney2(value: Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value.toFixed(2));
  }

  private computeLineAmounts(params: {
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    avgCost: Prisma.Decimal;
  }): { lineTotal: Prisma.Decimal; lineCost: Prisma.Decimal; profit: Prisma.Decimal } {
    const lineTotal = this.toMoney2(params.quantity.mul(params.unitPrice));
    const lineCost = this.toMoney2(params.quantity.mul(params.avgCost));
    const profit = this.toMoney2(lineTotal.sub(lineCost));
    return { lineTotal, lineCost, profit };
  }

  private async recomputeSaleTotals(tx: Prisma.TransactionClient, saleId: string): Promise<void> {
    const agg = await tx.saleLine.aggregate({
      where: { saleId },
      _sum: { lineTotal: true, lineCost: true, profit: true },
    });

    const totalAmount = agg._sum.lineTotal ?? new Prisma.Decimal(0);
    const totalCost = agg._sum.lineCost ?? new Prisma.Decimal(0);
    const totalProfit = agg._sum.profit ?? new Prisma.Decimal(0);

    await tx.sale.update({
      where: { id: saleId },
      data: {
        totalAmount: this.toMoney2(totalAmount),
        totalCost: this.toMoney2(totalCost),
        totalProfit: this.toMoney2(totalProfit),
      },
    });
  }

  private async getTenantCurrencyCode(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { currency: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant.currency;
  }

  async createSale(tenantId: string, dto: { customerId: string; type: SaleType }, createdBy: string) {
    const currencyCode = await this.getTenantCurrencyCode(tenantId);

    const { code: saleNumber } = await this.sequences.generateCode(
      tenantId,
      SequenceScope.SALE,
      { prefix: 'SAL', includeYear: true, padSize: 4 },
      async (candidate) => {
        const existing = await this.prisma.sale.findFirst({
          where: { tenantId, saleNumber: candidate },
          select: { id: true },
        });
        return !existing;
      },
    );

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!customer) throw new BadRequestException('Customer not found or inactive');

    const sale = await this.prisma.sale.create({
      data: {
        tenantId,
        saleNumber,
        customerId: dto.customerId,
        type: dto.type,
        status: SaleStatus.DRAFT,
        currencyCode,
        createdBy,
      },
      include: { customer: true },
    });

    await this.audit.log({
      tenantId,
      userId: createdBy,
      action: 'SALE_CREATED',
      entityType: 'Sale',
      entityId: sale.id,
      metadataJson: { saleNumber: sale.saleNumber, type: sale.type },
    });

    return sale;
  }

  async listSales(tenantId: string) {
    return this.prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        payments: { select: { id: true, amount: true, method: true, receivedAt: true } },
      },
    });
  }

  async getSale(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        lines: {
          orderBy: { createdAt: 'asc' },
          include: {
            inventoryItem: {
              include: {
                category: { select: { id: true, name: true } },
                grade: { select: { id: true, name: true } },
                repackUnit: { select: { unitCode: true, measurementType: true, qrLabel: { select: { qrCode: true } } } },
              },
            },
          },
        },
        payments: { orderBy: { receivedAt: 'asc' } },
      },
    });

    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async updateSale(tenantId: string, id: string, dto: { customerId?: string; type?: SaleType }) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!sale) throw new NotFoundException('Sale not found');
    this.ensureDraft(sale);

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException('Customer not found or inactive');
    }

    return this.prisma.sale.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        type: dto.type,
      },
      include: { customer: true },
    });
  }

  async addLine(
    tenantId: string,
    saleId: string,
    dto: { inventoryItemId: string; measurementType: MeasurementType; quantity: number; unitPrice: number },
    userId: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      select: { id: true, status: true, type: true, saleNumber: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    this.ensureDraft(sale);

    const inventory = await this.prisma.inventoryItem.findFirst({
      where: { id: dto.inventoryItemId, tenantId },
      include: { repackUnit: { select: { measurementType: true, unitCode: true } } },
    });
    if (!inventory) throw new NotFoundException('Inventory item not found');

    if (inventory.status !== InventoryStatus.AVAILABLE) {
      throw new ConflictException('Inventory item is not AVAILABLE');
    }

    if (inventory.repackUnit.measurementType !== dto.measurementType) {
      throw new BadRequestException('measurementType does not match inventory item');
    }

    const qty = new Prisma.Decimal(dto.quantity);
    if (dto.measurementType === MeasurementType.WEIGHT) {
      if (!inventory.weightKg || !qty.equals(new Prisma.Decimal(inventory.weightKg.toFixed(2)))) {
        throw new BadRequestException('Quantity must equal full inventory weightKg');
      }
    } else {
      if (inventory.pcsCount <= 0 || !qty.equals(new Prisma.Decimal(inventory.pcsCount))) {
        throw new BadRequestException('Quantity must equal full inventory pcsCount');
      }
    }

    const avgCost = new Prisma.Decimal(inventory.avgCost);
    if (avgCost.lte(0)) {
      throw new BadRequestException('Inventory item cost is missing or invalid');
    }

    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    if (unitPrice.lt(0)) {
      throw new BadRequestException('unitPrice must be >= 0');
    }

    const { lineTotal, lineCost, profit } = this.computeLineAmounts({ quantity: qty, unitPrice, avgCost });

    return this.prisma.$transaction(async (tx) => {
      const existingReservation = await tx.inventoryReservation.findFirst({
        where: { inventoryItemId: inventory.id },
        select: { id: true },
      });
      if (existingReservation) {
        throw new ConflictException('Inventory item is already RESERVED');
      }

      const line = await tx.saleLine.create({
        data: {
          saleId: sale.id,
          inventoryItemId: inventory.id,
          measurementType: dto.measurementType,
          quantity: qty,
          unitPrice,
          lineTotal,
          lineCost,
          profit,
        },
      });

      await tx.inventoryReservation.create({
        data: {
          tenantId,
          inventoryItemId: inventory.id,
          saleId: sale.id,
          saleLineId: line.id,
          reservedQuantity: qty,
        },
      });

      await tx.inventoryItem.update({
        where: { id: inventory.id },
        data: { status: InventoryStatus.RESERVED },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          movementType: MovementType.RESERVATION,
          quantityKg: dto.measurementType === MeasurementType.WEIGHT ? qty : new Prisma.Decimal(0),
          quantityPcs: dto.measurementType === MeasurementType.QUANTITY ? Number(qty) : 0,
          referenceId: sale.id,
          metadataJson: {
            saleNumber: sale.saleNumber,
            saleType: sale.type,
            repackUnitCode: inventory.repackUnit.unitCode,
          },
        },
      });

      await this.recomputeSaleTotals(tx, sale.id);

      await this.audit.log({
        tenantId,
        userId,
        action: 'SALE_LINE_ADDED',
        entityType: 'Sale',
        entityId: sale.id,
        metadataJson: { saleLineId: line.id, inventoryItemId: inventory.id },
      });

      return tx.sale.findFirst({
        where: { id: sale.id },
        include: { customer: true, lines: true },
      });
    });
  }

  async deleteLine(tenantId: string, saleId: string, lineId: string, userId: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id: saleId, tenantId }, select: { id: true, status: true, saleNumber: true } });
    if (!sale) throw new NotFoundException('Sale not found');
    this.ensureDraft(sale);

    const line = await this.prisma.saleLine.findFirst({
      where: { id: lineId, saleId: sale.id },
      select: { id: true, inventoryItemId: true, measurementType: true, quantity: true },
    });
    if (!line) throw new NotFoundException('Sale line not found');

    const reservation = await this.prisma.inventoryReservation.findFirst({
      where: { saleLineId: line.id, saleId: sale.id, tenantId },
      select: { id: true },
    });
    if (!reservation) {
      throw new ConflictException('Reservation not found for sale line');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.saleLine.delete({ where: { id: line.id } });
      await tx.inventoryReservation.delete({ where: { id: reservation.id } });

      await tx.inventoryItem.update({
        where: { id: line.inventoryItemId },
        data: { status: InventoryStatus.AVAILABLE },
      });

      await tx.stockMovement.create({
        data: {
          inventoryItemId: line.inventoryItemId,
          movementType: MovementType.RELEASE,
          quantityKg: line.measurementType === MeasurementType.WEIGHT ? new Prisma.Decimal(line.quantity) : new Prisma.Decimal(0),
          quantityPcs: line.measurementType === MeasurementType.QUANTITY ? Number(line.quantity) : 0,
          referenceId: sale.id,
          metadataJson: { saleNumber: sale.saleNumber, saleLineId: line.id },
        },
      });

      await this.recomputeSaleTotals(tx, sale.id);

      await this.audit.log({
        tenantId,
        userId,
        action: 'SALE_LINE_REMOVED',
        entityType: 'Sale',
        entityId: sale.id,
        metadataJson: { saleLineId: line.id, inventoryItemId: line.inventoryItemId },
      });

      return tx.sale.findFirst({ where: { id: sale.id }, include: { customer: true, lines: true } });
    });
  }

  async issue(tenantId: string, saleId: string, userId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { lines: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    this.ensureDraft(sale);

    if (sale.lines.length === 0) {
      throw new BadRequestException('Cannot issue an empty sale');
    }

    return this.prisma.$transaction(async (tx) => {
      const lines = await tx.saleLine.findMany({
        where: { saleId: sale.id },
        include: { inventoryItem: { include: { repackUnit: { select: { unitCode: true } } } } },
      });

      const reservations = await tx.inventoryReservation.findMany({
        where: { tenantId, saleId: sale.id },
      });

      const reservationByItem = new Map(reservations.map((r) => [r.inventoryItemId, r]));

      for (const line of lines) {
        const inv = line.inventoryItem;
        if (inv.tenantId !== tenantId) {
          throw new ForbiddenException('Tenant data mismatch');
        }
        if (inv.status !== InventoryStatus.RESERVED) {
          throw new ConflictException('All inventory items must be RESERVED before issuing');
        }
        const res = reservationByItem.get(inv.id);
        if (!res || res.saleId !== sale.id) {
          throw new ConflictException('Missing reservation for one or more sale lines');
        }
        if (!new Prisma.Decimal(res.reservedQuantity).equals(new Prisma.Decimal(line.quantity))) {
          throw new ConflictException('Reservation quantity mismatch');
        }
      }

      const inventoryIds = lines.map((l) => l.inventoryItemId);

      const updateRes = await tx.inventoryItem.updateMany({
        where: { tenantId, id: { in: inventoryIds }, status: InventoryStatus.RESERVED },
        data: { status: InventoryStatus.SOLD },
      });

      if (updateRes.count !== inventoryIds.length) {
        throw new ConflictException('Failed to mark all reserved inventory items as SOLD');
      }

      await tx.inventoryReservation.deleteMany({ where: { tenantId, saleId: sale.id } });

      for (const line of lines) {
        await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            movementType: sale.type === SaleType.EXPORT ? MovementType.EXPORT : MovementType.SALE,
            quantityKg: line.measurementType === MeasurementType.WEIGHT ? new Prisma.Decimal(line.quantity) : new Prisma.Decimal(0),
            quantityPcs: line.measurementType === MeasurementType.QUANTITY ? Number(line.quantity) : 0,
            referenceId: sale.id,
            metadataJson: {
              saleNumber: sale.saleNumber,
              saleLineId: line.id,
              repackUnitCode: line.inventoryItem.repackUnit.unitCode,
            },
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.ISSUED, issuedAt: new Date() },
      });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SALE_ISSUED',
        entityType: 'Sale',
        entityId: sale.id,
        metadataJson: { saleNumber: sale.saleNumber },
      });

      return tx.sale.findFirst({
        where: { id: sale.id },
        include: { customer: true, lines: true, payments: true },
      });
    });
  }

  async cancel(tenantId: string, saleId: string, userId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      select: { id: true, status: true, saleNumber: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');

    // Non-negotiable: SOLD inventory is immutable. Since ISSUED converts RESERVED->SOLD,
    // cancellation is only allowed while still DRAFT.
    this.ensureDraft(sale);

    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.inventoryReservation.findMany({ where: { tenantId, saleId: sale.id } });

      for (const res of reservations) {
        const inv = await tx.inventoryItem.findFirst({ where: { id: res.inventoryItemId, tenantId } });
        if (!inv) continue;

        await tx.inventoryItem.update({ where: { id: inv.id }, data: { status: InventoryStatus.AVAILABLE } });
        await tx.stockMovement.create({
          data: {
            inventoryItemId: inv.id,
            movementType: MovementType.RELEASE,
            quantityKg: inv.weightKg ?? new Prisma.Decimal(0),
            quantityPcs: inv.pcsCount,
            referenceId: sale.id,
            metadataJson: { saleNumber: sale.saleNumber, reason: 'sale_cancelled' },
          },
        });
      }

      await tx.inventoryReservation.deleteMany({ where: { tenantId, saleId: sale.id } });

      const updated = await tx.sale.update({ where: { id: sale.id }, data: { status: SaleStatus.CANCELLED } });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SALE_CANCELLED',
        entityType: 'Sale',
        entityId: sale.id,
        metadataJson: { saleNumber: sale.saleNumber },
      });

      return updated;
    });
  }

  async addPayment(tenantId: string, saleId: string, dto: { amount: number; method: string }, userId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      select: { id: true, status: true, totalAmount: true, saleNumber: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const payableStatuses = new Set<SaleStatus>([SaleStatus.ISSUED, SaleStatus.PARTIALLY_PAID, SaleStatus.PAID]);
    if (!payableStatuses.has(sale.status)) {
      throw new ForbiddenException('Payments can only be recorded after the sale is ISSUED');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('amount must be > 0');

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount,
          method: dto.method,
          receivedAt: new Date(),
        },
      });

      const paidAgg = await tx.payment.aggregate({ where: { saleId: sale.id }, _sum: { amount: true } });
      const paid = paidAgg._sum.amount ?? new Prisma.Decimal(0);
      const due = new Prisma.Decimal(sale.totalAmount);

      const nextStatus = paid.gte(due) ? SaleStatus.PAID : SaleStatus.PARTIALLY_PAID;
      const updated = await tx.sale.update({ where: { id: sale.id }, data: { status: nextStatus } });

      await this.audit.log({
        tenantId,
        userId,
        action: 'SALE_PAYMENT_RECORDED',
        entityType: 'Sale',
        entityId: sale.id,
        metadataJson: { saleNumber: sale.saleNumber, amount: amount.toString(), method: dto.method },
      });

      return updated;
    });
  }

  async resolveQrToInventoryItem(tenantId: string, qrCodeOrUnitCode: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        status: InventoryStatus.AVAILABLE,
        OR: [
          { repackUnit: { unitCode: qrCodeOrUnitCode } },
          { repackUnit: { qrLabel: { qrCode: qrCodeOrUnitCode } } },
        ],
      },
      include: {
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        repackUnit: { select: { id: true, unitCode: true, measurementType: true, qrLabel: { select: { qrCode: true } } } },
      },
    });

    if (!item) {
      throw new NotFoundException('QR did not resolve to an AVAILABLE inventory item');
    }

    return {
      id: item.id,
      status: item.status,
      weightKg: item.weightKg,
      pcsCount: item.pcsCount,
      avgCost: item.avgCost,
      category: item.category,
      grade: item.grade,
      repackUnit: item.repackUnit,
    };
  }
}
