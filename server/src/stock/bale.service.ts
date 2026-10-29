import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AllocationMode,
  GradingOutputStatus,
  InventoryStatus,
  MeasurementType,
  MovementType,
  Prisma,
  RepackSessionStatus,
  RepackStatus,
  UnitType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailableStockQueryDto, MakeBaleDto } from './stock.dto';
import { formatYYYYMMDD, tokenFromName } from './unit-code.util';

type Tx = Prisma.TransactionClient;

const ZERO = new Decimal(0);
const OPEN_OUTPUT_STATUSES = [GradingOutputStatus.AVAILABLE, GradingOutputStatus.PARTIALLY_USED, GradingOutputStatus.READY_FOR_REPACK];

/** Graded stock a bale can be made from, with its lineage. */
const OUTPUT_LINEAGE = {
  grade: { select: { id: true, name: true } },
  gradeBucket: {
    select: {
      gradeSession: {
        select: {
          id: true,
          endTime: true,
          categoryOutput: {
            select: {
              categoryId: true,
              category: { select: { id: true, name: true } },
              sortSessionId: true,
              rag: { select: { id: true, ragCode: true, containerId: true, container: { select: { id: true, containerNumber: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GradeOutputInclude;

type OutputWithLineage = Prisma.GradeOutputGetPayload<{ include: typeof OUTPUT_LINEAGE }>;

/**
 * Finished bales: made from graded stock (FIFO by default, or picked by hand), each with a
 * QR label and a sellable stock item. One call does it all — there is no draft step.
 */
@Injectable()
export class BaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Graded stock with kg left, oldest grading first (the FIFO order). */
  async availableStock(tenantId: string, query: AvailableStockQueryDto) {
    const rows = await this.prisma.gradeOutput.findMany({
      where: this.eligibleWhere(tenantId, query.categoryId, query.gradeId),
      include: OUTPUT_LINEAGE,
      orderBy: [{ gradeBucket: { gradeSession: { endTime: 'asc' } } }, { createdAt: 'asc' }],
    });
    return rows.map((o) => {
      const co = o.gradeBucket.gradeSession.categoryOutput;
      const rag = co.rag;
      return {
        id: o.id,
        categoryId: co.categoryId,
        categoryName: co.category.name,
        gradeId: o.gradeId,
        gradeName: o.grade.name,
        measurementType: o.measurementType,
        totalAmount: o.totalAmount,
        usedAmount: o.usedAmount,
        remainingAmount: o.remainingAmount,
        allocatedCost: o.allocatedCost,
        costPerKg: o.totalAmount.greaterThan(ZERO) ? o.allocatedCost.div(o.totalAmount).toDecimalPlaces(4) : ZERO,
        status: o.status,
        sourceType: rag?.containerId ? 'CONTAINER' : 'LOOSE_BALE',
        containerId: rag?.container?.id ?? null,
        containerNumber: rag?.container?.containerNumber ?? null,
        ragId: rag?.id ?? null,
        ragCode: rag?.ragCode ?? null,
        sortSessionId: co.sortSessionId,
        gradeSessionId: o.gradeBucket.gradeSession.id,
        gradedAt: o.gradeBucket.gradeSession.endTime,
        createdAt: o.createdAt,
      };
    });
  }

  /** Makes a ready bale: takes kg from graded stock, costs it, creates stock + QR. */
  async makeBale(tenantId: string, dto: MakeBaleDto, userId: string) {
    const weightKg = new Decimal(dto.weightKg);
    const result = await this.prisma.$transaction(async (tx) => {
      const { sessionId, unitCode } = await this.openSessionAndCode(tx, tenantId, dto.categoryId, dto.gradeId, userId);
      const takes = dto.allocations?.length
        ? await this.pickManual(tx, tenantId, dto, weightKg)
        : await this.pickFifo(tx, tenantId, dto, weightKg);

      const unit = await tx.repackUnit.create({
        data: {
          tenantId,
          repackSessionId: sessionId,
          categoryId: dto.categoryId,
          gradeId: dto.gradeId,
          unitCode,
          unitType: UnitType.KG_BALE,
          weightKg,
          pcsCount: dto.pieces ?? 0,
          totalCost: ZERO,
          status: RepackStatus.SEALED,
          measurementType: MeasurementType.WEIGHT,
          targetAmount: weightKg,
          allocationMode: dto.allocations?.length ? AllocationMode.MANUAL : AllocationMode.FIFO,
          createdBy: userId,
        },
      });

      let totalCost = ZERO;
      for (const { output, kg } of takes) {
        const cost = output.allocatedCost.div(output.totalAmount).mul(kg).toDecimalPlaces(2);
        totalCost = totalCost.add(cost);
        await this.consume(tx, tenantId, output, kg);
        await tx.repackInputAllocation.create({
          data: {
            tenantId,
            repackUnitId: unit.id,
            gradingOutputId: output.id,
            containerId: output.gradeBucket.gradeSession.categoryOutput.rag?.containerId ?? null,
            ragBaleId: output.gradeBucket.gradeSession.categoryOutput.rag?.id ?? null,
            amountUsed: kg,
            measurementType: MeasurementType.WEIGHT,
            allocatedCost: cost,
          },
        });
      }

      const primary = takes[0].output.gradeBucket.gradeSession;
      const sealed = await tx.repackUnit.update({
        where: { id: unit.id },
        data: {
          totalCost,
          containerId: primary.categoryOutput.rag?.containerId ?? null,
          ragId: primary.categoryOutput.rag?.id ?? null,
          sortSessionId: primary.categoryOutput.sortSessionId,
          gradeSessionId: primary.id,
        },
      });

      if (dto.warehouseId) {
        const warehouse = await tx.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId }, select: { id: true } });
        if (!warehouse) throw new BadRequestException('Invalid warehouse');
      }
      const item = await tx.inventoryItem.create({
        data: {
          tenantId,
          repackUnitId: sealed.id,
          categoryId: dto.categoryId,
          gradeId: dto.gradeId,
          weightKg,
          pcsCount: sealed.pcsCount,
          avgCost: totalCost.div(weightKg).toDecimalPlaces(2),
          warehouseId: dto.warehouseId ?? null,
          status: InventoryStatus.AVAILABLE,
          containerId: sealed.containerId,
          ragId: sealed.ragId,
        },
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          movementType: MovementType.INTAKE,
          quantityKg: weightKg,
          quantityPcs: sealed.pcsCount,
          referenceId: sealed.id,
          metadataJson: { repackUnitId: sealed.id, unitCode, totalCost: totalCost.toString() },
        },
      });
      await tx.qRLabel.create({ data: { repackUnitId: sealed.id, qrCode: `REPACK:${unitCode}` } });
      return { baleId: sealed.id, unitCode, totalCost };
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'BALE_MADE',
      entityType: 'RepackUnit',
      entityId: result.baleId,
      metadataJson: { unitCode: result.unitCode, weightKg: weightKg.toString(), totalCost: result.totalCost.toString() },
    });
    return this.findOne(tenantId, result.baleId);
  }

  async list(tenantId: string) {
    return this.prisma.repackUnit.findMany({
      where: { tenantId, status: { in: [RepackStatus.SEALED, RepackStatus.READY, RepackStatus.RESERVED, RepackStatus.SOLD] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        unitCode: true,
        status: true,
        weightKg: true,
        pcsCount: true,
        totalCost: true,
        measurementType: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        qrLabel: { select: { qrCode: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const bale = await this.prisma.repackUnit.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        qrLabel: true,
        inventoryItems: { select: { id: true, status: true } },
        inputAllocations: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            gradingOutputId: true,
            amountUsed: true,
            allocatedCost: true,
            containerId: true,
            ragBaleId: true,
          },
        },
      },
    });
    if (!bale) throw new NotFoundException('Bale not found');
    return bale;
  }

  /** QR image (PNG data URL) and the facts printed on the sticker. */
  async qr(tenantId: string, id: string) {
    const bale = await this.prisma.repackUnit.findFirst({
      where: { id, tenantId },
      include: {
        qrLabel: true,
        category: { select: { name: true } },
        grade: { select: { name: true } },
      },
    });
    if (!bale?.qrLabel) throw new NotFoundException('QR label not found');
    return {
      qr: {
        encoded: bale.qrLabel.qrCode,
        pngDataUrl: await QRCode.toDataURL(bale.qrLabel.qrCode, { margin: 1, width: 300 }),
        generatedAt: bale.qrLabel.generatedAt,
      },
      unit: {
        id: bale.id,
        unitCode: bale.unitCode,
        unitType: bale.unitType,
        category: bale.category?.name ?? null,
        grade: bale.grade?.name ?? null,
        weightKg: bale.weightKg.toString(),
        pcsCount: bale.pcsCount,
        totalCost: bale.totalCost.toString(),
        createdAt: bale.createdAt,
      },
    };
  }

  private eligibleWhere(tenantId: string, categoryId?: string, gradeId?: string): Prisma.GradeOutputWhereInput {
    return {
      tenantId,
      measurementType: MeasurementType.WEIGHT,
      status: { in: OPEN_OUTPUT_STATUSES },
      remainingAmount: { gt: 0 },
      ...(gradeId ? { gradeId } : {}),
      ...(categoryId ? { gradeBucket: { gradeSession: { categoryOutput: { categoryId } } } } : {}),
    };
  }

  /** Oldest graded stock first until the bale weight is covered. */
  private async pickFifo(tx: Tx, tenantId: string, dto: MakeBaleDto, weightKg: Decimal) {
    const outputs = await tx.gradeOutput.findMany({
      where: this.eligibleWhere(tenantId, dto.categoryId, dto.gradeId),
      include: OUTPUT_LINEAGE,
      orderBy: [{ gradeBucket: { gradeSession: { endTime: 'asc' } } }, { createdAt: 'asc' }],
    });
    const takes: { output: OutputWithLineage; kg: Decimal }[] = [];
    let left = weightKg;
    for (const output of outputs) {
      if (left.lessThanOrEqualTo(ZERO)) break;
      const kg = Decimal.min(output.remainingAmount, left);
      takes.push({ output, kg });
      left = left.sub(kg);
    }
    if (left.greaterThan(ZERO)) {
      const available = weightKg.sub(left);
      throw new BadRequestException(
        `Not enough sorted stock: ${available.toFixed(2)} kg available. Enter ${available.toFixed(2)} kg or less.`,
      );
    }
    return takes;
  }

  /** Stock picked by hand; the picked kg must add up to the bale weight. */
  private async pickManual(tx: Tx, tenantId: string, dto: MakeBaleDto, weightKg: Decimal) {
    const ids = dto.allocations!.map((a) => a.gradingOutputId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('The same stock is picked twice');
    const outputs = await tx.gradeOutput.findMany({
      where: { ...this.eligibleWhere(tenantId, dto.categoryId, dto.gradeId), id: { in: ids } },
      include: OUTPUT_LINEAGE,
    });
    if (outputs.length !== ids.length) throw new BadRequestException('Some picked stock is not available for this grade');
    const takes = dto.allocations!.map((a) => {
      const output = outputs.find((o) => o.id === a.gradingOutputId)!;
      const kg = new Decimal(a.amountKg);
      if (kg.greaterThan(output.remainingAmount)) {
        throw new BadRequestException(`Only ${output.remainingAmount.toFixed(2)} kg left in one of the picked lots`);
      }
      return { output, kg };
    });
    const picked = takes.reduce((sum, t) => sum.add(t.kg), ZERO);
    if (!picked.equals(weightKg)) {
      throw new BadRequestException(`Picked ${picked.toFixed(2)} kg but the bale is ${weightKg.toFixed(2)} kg`);
    }
    return takes;
  }

  /** Deducts kg from a grade output; fails if someone else used it at the same time. */
  private async consume(tx: Tx, tenantId: string, output: OutputWithLineage, kg: Decimal) {
    const remaining = output.remainingAmount.sub(kg);
    const updated = await tx.gradeOutput.updateMany({
      where: { id: output.id, tenantId, remainingAmount: output.remainingAmount },
      data: {
        usedAmount: output.usedAmount.add(kg),
        remainingAmount: remaining,
        status: remaining.equals(ZERO) ? GradingOutputStatus.DEPLETED : GradingOutputStatus.PARTIALLY_USED,
      },
    });
    if (updated.count !== 1) throw new ConflictException('Stock changed while making the bale. Please try again.');
  }

  /** Bales go into one auto-managed open session per tenant (no screen for it in v1). */
  private async openSessionAndCode(tx: Tx, tenantId: string, categoryId: string, gradeId: string, userId: string) {
    const [tenant, category, grade] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { companyCode: true } }),
      tx.category.findFirst({ where: { id: categoryId, tenantId, isActive: true }, select: { name: true } }),
      tx.grade.findFirst({ where: { id: gradeId, tenantId, isActive: true }, select: { name: true } }),
    ]);
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!category) throw new BadRequestException('Invalid category');
    if (!grade) throw new BadRequestException('Invalid grade');

    const session =
      (await tx.repackSession.findFirst({
        where: { tenantId, status: RepackSessionStatus.OPEN },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })) ??
      (await tx.repackSession.create({
        data: { tenantId, workerId: userId, supervisorId: userId, status: RepackSessionStatus.OPEN },
        select: { id: true },
      }));

    const prefix = [tokenFromName(tenant.companyCode, 10), tokenFromName(category.name, 6), tokenFromName(grade.name, 6), formatYYYYMMDD(new Date())].join('-');
    const count = await tx.repackUnit.count({ where: { tenantId, unitCode: { startsWith: prefix } } });
    for (let seq = count + 1; seq <= count + 5; seq++) {
      const unitCode = `${prefix}-${String(seq).padStart(4, '0')}`;
      const taken = await tx.repackUnit.findFirst({ where: { tenantId, unitCode }, select: { id: true } });
      if (!taken) return { sessionId: session.id, unitCode };
    }
    throw new ConflictException('Could not generate a unique bale code');
  }
}
