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
  SortStatus,
  StockSource,
  StockUnit,
  UnitType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { baleCost, costPerKg, fifoTake, InsufficientStockError, money, sum, takeCost } from '../costing/costing';
import { PrismaService } from '../prisma/prisma.service';
import { AvailableStockQueryDto, BaleAllocationDto, MakeBaleDto } from './stock.dto';
import { formatYYYYMMDD, tokenFromName } from './unit-code.util';

type Tx = Prisma.TransactionClient;

const ZERO = new Decimal(0);
const OPEN_GRADE_STATUSES = [GradingOutputStatus.AVAILABLE, GradingOutputStatus.PARTIALLY_USED, GradingOutputStatus.READY_FOR_REPACK];

/** A sorted output a bale can take kg from: a grade output (2 stages) or an ungraded category output (1 stage). */
interface SortedSource {
  kind: 'GRADE' | 'CATEGORY';
  id: string;
  /** Total kg the output weighed and the cost it carries. */
  kg: Decimal;
  cost: Decimal;
  usedKg: Decimal;
  categoryId: string;
  categoryName: string;
  gradeId: string | null;
  gradeName: string | null;
  sortSessionId: string;
  gradeSessionId: string | null;
  ragId: string;
  ragCode: string;
  containerId: string | null;
  containerNumber: string | null;
  /** When the stock became ready (FIFO order). */
  readyAt: Date | null;
  createdAt: Date;
}

const LOT = { select: { id: true, ragCode: true, containerId: true, container: { select: { containerNumber: true } } } } as const;

/**
 * Finished bales: kg taken from sorted stock (FIFO by default, or picked by hand), costed with the
 * costing rules, sealed with a QR label and a sellable stock item — all in one transaction.
 */
@Injectable()
export class BaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Sorted stock with kg left, oldest first. Without a grade: ungraded category outputs. */
  async availableStock(tenantId: string, query: AvailableStockQueryDto) {
    const sources = await this.loadSources(this.prisma, tenantId, query.categoryId, query.gradeId);
    return sources.map((s) => ({
      id: s.id,
      source: s.kind,
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      gradeId: s.gradeId,
      gradeName: s.gradeName,
      measurementType: MeasurementType.WEIGHT,
      totalAmount: s.kg,
      usedAmount: s.usedKg,
      remainingAmount: s.kg.sub(s.usedKg),
      allocatedCost: s.cost,
      costPerKg: costPerKg(s.cost, s.kg),
      sourceType: s.containerId ? 'CONTAINER' : 'LOOSE_BALE',
      containerId: s.containerId,
      containerNumber: s.containerNumber,
      ragId: s.ragId,
      ragCode: s.ragCode,
      sortSessionId: s.sortSessionId,
      gradeSessionId: s.gradeSessionId,
      gradedAt: s.readyAt,
      createdAt: s.createdAt,
    }));
  }

  /**
   * What can be baled now, one row per kind (category, or category + grade), with the kg left.
   * The phone shows these as tiles on "Make bale".
   */
  async kinds(tenantId: string) {
    const grades = await this.prisma.grade.findMany({ where: { tenantId, isActive: true }, select: { id: true }, orderBy: { rank: 'asc' } });
    const sources = [
      ...(await this.loadSources(this.prisma, tenantId)),
      ...(await Promise.all(grades.map((g) => this.loadSources(this.prisma, tenantId, undefined, g.id)))).flat(),
    ];
    const byKind = new Map<string, { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; availableKg: Decimal }>();
    for (const s of sources) {
      const key = `${s.categoryId}:${s.gradeId ?? ''}`;
      const row = byKind.get(key) ?? { categoryId: s.categoryId, categoryName: s.categoryName, gradeId: s.gradeId ?? null, gradeName: s.gradeName ?? null, availableKg: ZERO };
      row.availableKg = row.availableKg.add(s.kg.sub(s.usedKg));
      byKind.set(key, row);
    }
    return [...byKind.values()]
      .filter((k) => k.availableKg.greaterThan(0))
      .sort((a, b) => b.availableKg.comparedTo(a.availableKg))
      .map((k) => ({ ...k, availableKg: k.availableKg.toString() }));
  }

  /** Makes a ready bale: takes kg from sorted stock, costs it, creates stock + QR. */
  async makeBale(tenantId: string, dto: MakeBaleDto, userId: string) {
    const weightKg = new Decimal(dto.weightKg);
    const result = await this.prisma.$transaction(async (tx) => {
      const { sessionId, unitCode } = await this.openSessionAndCode(tx, tenantId, dto.categoryId, dto.gradeId, userId);
      const sources = await this.loadSources(tx, tenantId, dto.categoryId, dto.gradeId);
      const takes = dto.allocations?.length ? this.pickManual(sources, dto.allocations, weightKg) : this.pickFifo(sources, weightKg);

      const unit = await tx.repackUnit.create({
        data: {
          tenantId,
          repackSessionId: sessionId,
          categoryId: dto.categoryId,
          gradeId: dto.gradeId ?? null,
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

      const costs: Decimal[] = [];
      for (const { source, kg } of takes) {
        const cost = takeCost({ cost: source.cost, kg: source.kg }, source.usedKg, kg);
        costs.push(cost);
        await this.consume(tx, tenantId, source, kg);
        await tx.repackInputAllocation.create({
          data: {
            tenantId,
            repackUnitId: unit.id,
            gradingOutputId: source.kind === 'GRADE' ? source.id : null,
            categoryOutputId: source.kind === 'CATEGORY' ? source.id : null,
            containerId: source.containerId,
            ragBaleId: source.ragId,
            amountUsed: kg,
            measurementType: MeasurementType.WEIGHT,
            allocatedCost: cost,
          },
        });
      }
      const totalCost = baleCost(costs);

      const primary = takes[0].source;
      const sealed = await tx.repackUnit.update({
        where: { id: unit.id },
        data: {
          totalCost,
          containerId: primary.containerId,
          ragId: primary.ragId,
          sortSessionId: primary.sortSessionId,
          gradeSessionId: primary.gradeSessionId,
        },
      });

      if (dto.warehouseId) {
        const warehouse = await tx.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId }, select: { id: true } });
        if (!warehouse) throw new BadRequestException('Invalid warehouse');
      }
      const item = await tx.inventoryItem.create({
        data: {
          tenantId,
          source: StockSource.PROCESSED,
          repackUnitId: sealed.id,
          categoryId: dto.categoryId,
          gradeId: dto.gradeId ?? null,
          unit: StockUnit.BALE,
          quantity: 1,
          totalCost,
          unitCost: totalCost,
          weightKg,
          pcsCount: sealed.pcsCount,
          avgCost: money(costPerKg(totalCost, weightKg)),
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
          metadataJson: { repackUnitId: sealed.id, unitCode, totalCost: totalCost.toFixed(2) },
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
      metadataJson: { unitCode: result.unitCode, weightKg: weightKg.toFixed(2), totalCost: result.totalCost.toFixed(2) },
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
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            gradingOutputId: true,
            categoryOutputId: true,
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

  /**
   * Stock a bale of this category (and grade) can take from, oldest first.
   * With a grade: open grade outputs. Without: closed-lot category outputs that were never graded.
   */
  private async loadSources(db: Tx | PrismaService, tenantId: string, categoryId?: string, gradeId?: string): Promise<SortedSource[]> {
    if (gradeId) {
      const rows = await db.gradeOutput.findMany({
        where: {
          tenantId,
          gradeId,
          measurementType: MeasurementType.WEIGHT,
          status: { in: OPEN_GRADE_STATUSES },
          remainingAmount: { gt: 0 },
          ...(categoryId ? { gradeBucket: { gradeSession: { categoryOutput: { categoryId } } } } : {}),
        },
        include: {
          grade: { select: { name: true } },
          gradeBucket: {
            select: {
              gradeSession: {
                select: {
                  id: true,
                  endTime: true,
                  categoryOutput: { select: { categoryId: true, sortSessionId: true, category: { select: { name: true } }, rag: LOT } },
                },
              },
            },
          },
        },
        orderBy: [{ gradeBucket: { gradeSession: { endTime: 'asc' } } }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      return rows.map((o) => {
        const gs = o.gradeBucket.gradeSession;
        return {
          kind: 'GRADE' as const,
          id: o.id,
          kg: o.totalAmount,
          cost: o.allocatedCost,
          usedKg: o.usedAmount,
          categoryId: gs.categoryOutput.categoryId,
          categoryName: gs.categoryOutput.category.name,
          gradeId: o.gradeId,
          gradeName: o.grade.name,
          sortSessionId: gs.categoryOutput.sortSessionId,
          gradeSessionId: gs.id,
          ragId: gs.categoryOutput.rag.id,
          ragCode: gs.categoryOutput.rag.ragCode,
          containerId: gs.categoryOutput.rag.containerId,
          containerNumber: gs.categoryOutput.rag.container?.containerNumber ?? null,
          readyAt: gs.endTime,
          createdAt: o.createdAt,
        };
      });
    }

    const rows = await db.categoryOutput.findMany({
      where: {
        tenantId,
        ...(categoryId ? { categoryId } : {}),
        gradeSessions: { none: {} },
        sortCategoryBucket: { sortSession: { status: SortStatus.CLOSED } },
      },
      include: {
        category: { select: { name: true } },
        rag: LOT,
        sortCategoryBucket: { select: { sortSession: { select: { endTime: true } } } },
      },
      orderBy: [{ sortCategoryBucket: { sortSession: { endTime: 'asc' } } }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows
      .filter((o) => o.usedKg.lessThan(o.weightKg))
      .map((o) => ({
        kind: 'CATEGORY' as const,
        id: o.id,
        kg: o.weightKg,
        cost: o.allocatedCost,
        usedKg: o.usedKg,
        categoryId: o.categoryId,
        categoryName: o.category.name,
        gradeId: null,
        gradeName: null,
        sortSessionId: o.sortSessionId,
        gradeSessionId: null,
        ragId: o.rag.id,
        ragCode: o.rag.ragCode,
        containerId: o.rag.containerId,
        containerNumber: o.rag.container?.containerNumber ?? null,
        readyAt: o.sortCategoryBucket.sortSession.endTime,
        createdAt: o.createdAt,
      }));
  }

  private pickFifo(sources: SortedSource[], weightKg: Decimal) {
    try {
      return fifoTake(sources.map((s) => ({ key: s, availableKg: s.kg.sub(s.usedKg) })), weightKg).map((t) => ({ source: t.key, kg: t.kg }));
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        const left = error.availableKg.toFixed(2);
        throw new BadRequestException(`Not enough sorted stock: ${left} kg available. Enter ${left} kg or less.`);
      }
      throw error;
    }
  }

  /** Stock picked by hand: each pick names exactly one source, and the picks add up to the bale weight. */
  private pickManual(sources: SortedSource[], picks: BaleAllocationDto[], weightKg: Decimal) {
    const takes = picks.map((pick) => {
      if (!!pick.gradingOutputId === !!pick.categoryOutputId) {
        throw new BadRequestException('Each pick needs exactly one of gradingOutputId or categoryOutputId');
      }
      const id = pick.gradingOutputId ?? pick.categoryOutputId;
      const kind = pick.gradingOutputId ? 'GRADE' : 'CATEGORY';
      const source = sources.find((s) => s.id === id && s.kind === kind);
      if (!source) throw new BadRequestException('Some picked stock is not available for this bale');
      const kg = new Decimal(pick.amountKg);
      const left = source.kg.sub(source.usedKg);
      if (kg.greaterThan(left)) throw new BadRequestException(`Only ${left.toFixed(2)} kg left in one of the picked lots`);
      return { source, kg };
    });
    if (new Set(takes.map((t) => t.source.id)).size !== takes.length) throw new BadRequestException('The same stock is picked twice');
    const picked = sum(takes.map((t) => t.kg));
    if (!picked.equals(weightKg)) {
      throw new BadRequestException(`Picked ${picked.toFixed(2)} kg but the bale is ${weightKg.toFixed(2)} kg`);
    }
    return takes;
  }

  /** Deducts kg from the source; fails if someone else used it at the same time. */
  private async consume(tx: Tx, tenantId: string, source: SortedSource, kg: Decimal) {
    const usedAfter = source.usedKg.add(kg);
    const updated =
      source.kind === 'GRADE'
        ? await tx.gradeOutput.updateMany({
            where: { id: source.id, tenantId, usedAmount: source.usedKg },
            data: {
              usedAmount: usedAfter,
              remainingAmount: source.kg.sub(usedAfter),
              status: usedAfter.equals(source.kg) ? GradingOutputStatus.DEPLETED : GradingOutputStatus.PARTIALLY_USED,
            },
          })
        : await tx.categoryOutput.updateMany({
            where: { id: source.id, tenantId, usedKg: source.usedKg },
            data: { usedKg: usedAfter },
          });
    if (updated.count !== 1) throw new ConflictException('Stock changed while making the bale. Please try again.');
  }

  /** Bales go into one auto-managed open session per tenant (no screen for it in v1). */
  private async openSessionAndCode(tx: Tx, tenantId: string, categoryId: string, gradeId: string | undefined, userId: string) {
    const [tenant, category, grade] = await Promise.all([
      tx.tenant.findUnique({ where: { id: tenantId }, select: { companyCode: true } }),
      tx.category.findFirst({ where: { id: categoryId, tenantId, isActive: true }, select: { name: true } }),
      gradeId ? tx.grade.findFirst({ where: { id: gradeId, tenantId, isActive: true }, select: { name: true } }) : null,
    ]);
    if (!tenant) throw new BadRequestException('Tenant not found');
    if (!category) throw new BadRequestException('Invalid category');
    if (gradeId && !grade) throw new BadRequestException('Invalid grade');

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

    const prefix = [
      tokenFromName(tenant.companyCode, 10),
      tokenFromName(category.name, 6),
      ...(grade ? [tokenFromName(grade.name, 6)] : []),
      formatYYYYMMDD(new Date()),
    ].join('-');
    const count = await tx.repackUnit.count({ where: { tenantId, unitCode: { startsWith: prefix } } });
    for (let seq = count + 1; seq <= count + 5; seq++) {
      const unitCode = `${prefix}-${String(seq).padStart(4, '0')}`;
      const taken = await tx.repackUnit.findFirst({ where: { tenantId, unitCode }, select: { id: true } });
      if (!taken) return { sessionId: session.id, unitCode };
    }
    throw new ConflictException('Could not generate a unique bale code');
  }
}
