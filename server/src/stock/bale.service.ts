import { defaultGodownId } from '../common/godown/default-godown';
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
  /** An entry of a lot without a weight: kg/usedKg above are its pieces and the pieces already baled. */
  byPieces?: boolean;
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

  /**
   * Sorted kg not in bales yet — exactly what Make a bale offers — with the cost still in it and the day it
   * was sorted (v2 review: stock value, Home and Inventory count it, not only finished bales).
   */
  async sortedStock(tenantId: string): Promise<Array<{ categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; kg: Decimal; value: Decimal; since: Date }>> {
    const grades = await this.prisma.grade.findMany({ where: { tenantId, isActive: true }, select: { id: true }, orderBy: { rank: 'asc' } });
    const sources = [
      ...(await this.loadSources(this.prisma, tenantId)),
      ...(await Promise.all(grades.map((g) => this.loadSources(this.prisma, tenantId, undefined, g.id)))).flat(),
    ];
    return sources
      .map((s) => {
        const kg = s.kg.sub(s.usedKg);
        const value = s.kg.isZero() ? ZERO : s.cost.mul(kg).div(s.kg).toDecimalPlaces(2);
        return { categoryId: s.categoryId, categoryName: s.categoryName, gradeId: s.gradeId ?? null, gradeName: s.gradeName ?? null, kg, value, since: s.readyAt ?? s.createdAt };
      })
      .filter((r) => r.kg.greaterThan(0));
  }

  /** Makes a ready bale: takes kg from sorted stock, costs it, creates stock + QR. */
  /** One bale, or `count` bales of the same weight (all or none). Answers with the first bale and every bale id. */
  async makeBale(tenantId: string, dto: MakeBaleDto, userId: string) {
    const count = dto.count ?? 1;
    if (count > 1 && dto.allocations?.length) throw new BadRequestException('Pick stock by hand for one bale at a time');
    const made = await this.prisma.$transaction(async (tx) => {
      const out: { baleId: string; unitCode: string; totalCost: Decimal }[] = [];
      for (let i = 0; i < count; i++) out.push(await this.makeBaleTx(tx, tenantId, dto, userId));
      return out;
    }, { timeout: 60_000, maxWait: 10_000 });
    for (const result of made) {
      await this.audit.log({
        tenantId,
        userId,
        action: 'BALE_MADE',
        entityType: 'RepackUnit',
        entityId: result.baleId,
        metadataJson: { unitCode: result.unitCode, weightKg: new Decimal(dto.weightKg ?? 0).toFixed(2), pieces: dto.pieces ?? 0, totalCost: result.totalCost.toFixed(2), ...(dto.ragId ? { ragId: dto.ragId } : {}) },
      });
    }
    return { ...(await this.findOne(tenantId, made[0].baleId)), baleIds: made.map((m) => m.baleId) };
  }

  /** Makes one bale inside the caller's transaction (also used when bales are made while sorting, v2 6.6). */
  async makeBaleTx(tx: Tx, tenantId: string, dto: MakeBaleDto, userId: string): Promise<{ baleId: string; unitCode: string; totalCost: Decimal }> {
    const weightKg = new Decimal(dto.weightKg ?? 0);
    {
      const { sessionId, unitCode, qrCode } = await this.openSessionAndCode(tx, tenantId, dto.categoryId, dto.gradeId, userId);
      const all = dto.fromUngraded
        ? await this.categorySources(tx, tenantId, dto.categoryId, null, dto.ragId)
        : await this.loadSources(tx, tenantId, dto.categoryId, dto.gradeId, dto.ragId);
      if (dto.gradeId && !(await tx.grade.findFirst({ where: { id: dto.gradeId, tenantId }, select: { id: true } }))) throw new BadRequestException('Invalid grade');
      // Sorted pieces without kg (a lot bought by the piece without a weight) are baled by the piece: the bale takes
      // `pieces` of them, and its weight is whatever was weighed (or none). Everything else is baled by kg.
      const byPieces = !!dto.pieces && !dto.allocations?.length && all.some((s) => s.byPieces);
      const sources = all.filter((s) => !!s.byPieces === byPieces);
      if (!byPieces && weightKg.isZero()) throw new BadRequestException('Enter the bale weight');
      if (!byPieces && !sources.length && all.some((s) => s.byPieces)) {
        throw new BadRequestException('These pieces were sorted without a weight: enter how many pieces are in the bale');
      }
      const takes = byPieces
        ? this.pickFifo(sources, new Decimal(dto.pieces!), 'pieces')
        : dto.allocations?.length ? this.pickManual(sources, dto.allocations, weightKg) : this.pickFifo(sources, weightKg);

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
          measurementType: byPieces ? MeasurementType.QUANTITY : MeasurementType.WEIGHT,
          targetAmount: byPieces ? new Decimal(dto.pieces!) : weightKg,
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
            measurementType: source.byPieces ? MeasurementType.QUANTITY : MeasurementType.WEIGHT,
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
          // A bale of pieces nobody weighed has no weight (it is sold by the bale or by the piece).
          weightKg: weightKg.isZero() ? null : weightKg,
          pcsCount: sealed.pcsCount,
          avgCost: money(costPerKg(totalCost, weightKg)),
          warehouseId: dto.warehouseId ?? (await defaultGodownId(tx, tenantId)),
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
      // QR text is unique across tenants (the company code), the short code only within one.
      await tx.qRLabel.create({ data: { repackUnitId: sealed.id, qrCode } });
      return { baleId: sealed.id, unitCode, totalCost };
    }
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
  /**
   * Sticker data for printing (A4 sheet or thermal): code, QR (SVG, crisp at any size), kind, kg, pieces,
   * origin country of the maal and the business name. Only this tenant's bales; order as asked.
   */
  async labels(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 96);
    const [tenant, bales] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      this.prisma.repackUnit.findMany({
        where: { tenantId, id: { in: unique } },
        include: {
          qrLabel: { select: { qrCode: true } },
          category: { select: { name: true } },
          grade: { select: { name: true } },
          inputAllocations: { select: { ragBaleId: true } },
        },
      }),
    ]);
    const ragIds = [...new Set(bales.flatMap((b) => b.inputAllocations.map((a) => a.ragBaleId).filter((x): x is string => !!x)))];
    const rags = await this.prisma.rag.findMany({
      where: { tenantId, id: { in: ragIds } },
      select: { id: true, originCountry: true, container: { select: { originCountry: true } } },
    });
    const originOf = new Map(rags.map((r) => [r.id, r.originCountry ?? r.container?.originCountry ?? null]));
    const byId = new Map(bales.map((b) => [b.id, b]));
    return Promise.all(
      unique
        .map((id) => byId.get(id))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map(async (b) => {
          const qr = b.qrLabel?.qrCode ?? `REPACK:${b.unitCode}`;
          const origins = [...new Set(b.inputAllocations.map((a) => (a.ragBaleId ? originOf.get(a.ragBaleId) : null)).filter((x): x is string => !!x))];
          return {
            id: b.id,
            code: b.unitCode,
            qr,
            qrSvg: await QRCode.toString(qr, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
            category: b.category?.name ?? null,
            grade: b.grade?.name ?? null,
            weightKg: b.weightKg.toString(),
            pieces: b.pcsCount,
            origin: origins.join(', ') || null,
            business: tenant?.name ?? '',
            status: b.status,
          };
        }),
    );
  }

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
   * With a grade: grade outputs (two-step grading) and outputs graded while sorting. Without: ungraded category
   * outputs. Since v2 6.6 sorted kg is usable at once, before its lot is closed.
   */
  private async loadSources(db: Tx | PrismaService, tenantId: string, categoryId?: string, gradeId?: string, ragId?: string): Promise<SortedSource[]> {
    const fromSorting = await this.categorySources(db, tenantId, categoryId, gradeId ?? null, ragId);
    if (!gradeId) return fromSorting;
    const fromGrading = (await this.gradeSources(db, tenantId, categoryId, gradeId)).filter((s) => !ragId || s.ragId === ragId);
    const ready = (s: SortedSource) => (s.readyAt ?? s.createdAt).getTime();
    return [...fromGrading, ...fromSorting].sort((a, b) => ready(a) - ready(b) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  private async gradeSources(db: Tx | PrismaService, tenantId: string, categoryId: string | undefined, gradeId: string): Promise<SortedSource[]> {
    {
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
  }

  private async categorySources(db: Tx | PrismaService, tenantId: string, categoryId: string | undefined, gradeId: string | null, ragId?: string): Promise<SortedSource[]> {
    const rows = await db.categoryOutput.findMany({
      where: {
        tenantId,
        ...(ragId ? { ragId } : {}),
        gradeId,
        ...(categoryId ? { categoryId } : {}),
        gradeSessions: { none: {} },
      },
      include: {
        category: { select: { name: true } },
        grade: { select: { name: true } },
        rag: LOT,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows
      .filter((o) => (o.weightKg.isZero() ? o.usedPieces < o.count : o.usedKg.lessThan(o.weightKg)))
      .map((o) => ({
        kind: 'CATEGORY' as const,
        id: o.id,
        // An entry without kg (a lot without a weight) is measured in pieces.
        byPieces: o.weightKg.isZero(),
        kg: o.weightKg.isZero() ? new Decimal(o.count) : o.weightKg,
        cost: o.allocatedCost,
        usedKg: o.weightKg.isZero() ? new Decimal(o.usedPieces) : o.usedKg,
        categoryId: o.categoryId,
        categoryName: o.category.name,
        gradeId: o.gradeId,
        gradeName: o.grade?.name ?? null,
        sortSessionId: o.sortSessionId,
        gradeSessionId: null,
        ragId: o.rag.id,
        ragCode: o.rag.ragCode,
        containerId: o.rag.containerId,
        containerNumber: o.rag.container?.containerNumber ?? null,
        // Ready when it was entered (v2 6.6); outputs from before were made when their lot closed.
        readyAt: o.createdAt,
        createdAt: o.createdAt,
      }));
  }

  private pickFifo(sources: SortedSource[], weightKg: Decimal, unit: 'kg' | 'pieces' = 'kg') {
    try {
      return fifoTake(sources.map((s) => ({ key: s, availableKg: s.kg.sub(s.usedKg) })), weightKg).map((t) => ({ source: t.key, kg: t.kg }));
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        if (unit === 'pieces') {
          const n = error.availableKg.toFixed(0);
          throw new BadRequestException(`Not enough sorted pieces: ${n} available. Enter ${n} or fewer.`);
        }
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
        : source.byPieces
          ? await tx.categoryOutput.updateMany({
              where: { id: source.id, tenantId, usedPieces: source.usedKg.toNumber() },
              data: { usedPieces: usedAfter.toNumber() },
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

    // Short codes people can read off a sticker and type: B-0001, B-0002… per tenant (older bales keep theirs).
    const count = await tx.repackUnit.count({ where: { tenantId, unitCode: { startsWith: 'B-' } } });
    for (let seq = count + 1; seq <= count + 5; seq++) {
      const unitCode = `B-${String(seq).padStart(4, '0')}`;
      const taken = await tx.repackUnit.findFirst({ where: { tenantId, unitCode }, select: { id: true } });
      if (!taken) return { sessionId: session.id, unitCode, qrCode: `REPACK:${tenant.companyCode}:${unitCode}` };
    }
    throw new ConflictException('Could not generate a unique bale code');
  }
}
