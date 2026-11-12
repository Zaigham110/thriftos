import { defaultGodownId } from '../common/godown/default-godown';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContainerStatus, GradingOutputStatus, InventoryStatus, MeasurementType, MovementType, Prisma, RagStatus, SortStatus, StockSource, StockUnit, WasteStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../audit/audit.service';
import { costPerKg, money, openLotCost } from '../costing/costing';
import { CostingService } from '../costing/costing.service';
import { startOfDayPKT } from '../home/home';
import { PrismaService } from '../prisma/prisma.service';
import { BaleService } from '../stock/bale.service';
import { AddCategoryKgDto, LotQueueQueryDto, StartSortDto } from './sorting.dto';
import { SortingWasteService } from './sorting-waste.service';

const ZERO = new Decimal(0);
type Tx = Prisma.TransactionClient;
/** Making several bales in one entry takes longer than Prisma's 5 s default. */
const LONG_TX = { timeout: 60_000, maxWait: 10_000 };

/** What one sorting entry is: loose kg, or a number of bales of a weight. */
function entryOf(dto: AddCategoryKgDto): { kg: Decimal; bales: number; baleKg: Decimal | null } {
  if (dto.bales) {
    if (!dto.baleWeightKg) throw new BadRequestException('Enter the weight of one bale');
    const baleKg = new Decimal(dto.baleWeightKg).toDecimalPlaces(2);
    return { kg: baleKg.mul(dto.bales), bales: dto.bales, baleKg };
  }
  if (!dto.amountKg) throw new BadRequestException('Enter the kg, or the number of bales');
  return { kg: new Decimal(dto.amountKg).toDecimalPlaces(2), bales: 0, baleKg: null };
}

/**
 * Sorting a lot (gaari, container lot or loose lot). Since v2 6.6 one step sorts, grades and bales: each entry is a
 * category (+ grade) with loose kg or bales, usable in stock at once while the lot stays open for days. Closing the
 * lot books what is left as kat — into stock to sell, at no cost — and shares the lot's whole cost over what came out.
 */
@Injectable()
export class SortSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly waste: SortingWasteService,
    private readonly bales: BaleService,
    private readonly costing: CostingService,
  ) {}

  /** Lots waiting for sorting or in progress (in-progress first). */
  async queue(tenantId: string, query: LotQueueQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId,
      status: query.status ? (query.status as RagStatus) : { in: [RagStatus.NOT_STARTED, RagStatus.IN_SORTING] },
    };
    const [rows, total] = await Promise.all([
      this.prisma.rag.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
        include: {
          container: { select: { id: true, containerNumber: true } },
          vendor: { select: { id: true, name: true } },
          rawCategory: { select: { id: true, name: true, rawType: true } },
        },
      }),
      this.prisma.rag.count({ where }),
    ]);
    const data = rows
      .map((rag) => ({ ...rag, sourceType: rag.sourceType, sourceId: rag.id }))
      .sort((a, b) => Number(b.status === RagStatus.IN_SORTING) - Number(a.status === RagStatus.IN_SORTING));
    return { data, total, page, limit };
  }

  async start(tenantId: string, dto: StartSortDto, userId: string) {
    const workerId = dto.workerId || userId;
    const supervisorId = dto.supervisorId || userId;

    const session = await this.prisma.$transaction(async (tx) => {
      const rag = await tx.rag.findFirst({
        where: { id: dto.ragId, tenantId },
        select: { id: true, weightKg: true, status: true, containerId: true },
      });
      if (!rag) throw new BadRequestException('Lot not found');
      if (rag.status !== RagStatus.NOT_STARTED) {
        throw new ConflictException(`This lot cannot be sorted again (status ${rag.status}).`);
      }
      await tx.rag.update({ where: { id: rag.id }, data: { status: RagStatus.IN_SORTING } });
      if (rag.containerId) await this.containerInUse(tx, tenantId, rag.containerId, userId);
      return tx.sortSession.create({
        data: {
          tenantId,
          ragId: rag.id,
          workerId,
          supervisorId,
          totalInputWeight: rag.weightKg,
          totalOutputWeight: ZERO,
          wasteWeight: ZERO,
          status: SortStatus.OPEN,
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_SESSION_CREATED',
      entityType: 'SortSession',
      entityId: session.id,
      metadataJson: { ragId: session.ragId, workerId, supervisorId },
    });
    return this.summary(tenantId, session.id);
  }

  /**
   * Sorting a container's lot means the goods are here and through customs: a container still "on the way" or
   * "arrived" moves to "cleared" by itself (with the arrival and clearing dates if they were never entered).
   * Closing stays the owner's step, because a late bill (transport, clearing) can still be added until then.
   */
  private async containerInUse(tx: Prisma.TransactionClient, tenantId: string, containerId: string, userId: string) {
    const c = await tx.container.findFirst({ where: { id: containerId, tenantId }, select: { status: true, arrivedAt: true, clearedAt: true, containerNumber: true } });
    if (!c || (c.status !== ContainerStatus.IN_TRANSIT && c.status !== ContainerStatus.ARRIVED)) return;
    const now = new Date();
    await tx.container.update({ where: { id: containerId }, data: { status: ContainerStatus.CLEARED, arrivedAt: c.arrivedAt ?? now, clearedAt: c.clearedAt ?? now } });
    await tx.auditLog.create({
      data: { tenantId, userId, action: 'CONTAINER_STATUS_CHANGED', entityType: 'Container', entityId: containerId, metadataJson: { containerNumber: c.containerNumber, previousStatus: c.status, newStatus: ContainerStatus.CLEARED, reason: 'SORTING_STARTED' } },
    });
  }

  /** The open session for a lot, or an empty summary (used to resume). */
  async openSummaryForLot(tenantId: string, lotId: string) {
    // The open sorting of the lot; a finished lot shows its result (v2 sorting review), not an empty screen.
    const session =
      (await this.prisma.sortSession.findFirst({ where: { tenantId, status: SortStatus.OPEN, ragId: lotId }, orderBy: { createdAt: 'desc' }, select: { id: true } })) ??
      (await this.prisma.sortSession.findFirst({ where: { tenantId, ragId: lotId }, orderBy: { createdAt: 'desc' }, select: { id: true } }));
    if (!session) return { session: null, buckets: [], wasteLineItems: [], lot: await this.lotInfo(tenantId, lotId) };
    return this.summary(tenantId, session.id);
  }

  async summary(tenantId: string, sessionId: string, now = new Date()) {
    const session = await this.prisma.sortSession.findFirst({
      where: { id: sessionId, tenantId },
      select: {
        id: true,
        status: true,
        totalInputWeight: true,
        totalOutputWeight: true,
        wasteWeight: true,
        rag: { select: { id: true, ragCode: true, weightKg: true } },
      },
    });
    if (!session) throw new NotFoundException('Sort session not found');
    const [buckets, wasteLineItems, outputs, kat, graded, gradedBales] = await Promise.all([
      this.prisma.sortCategoryBucket.findMany({
        where: { sortSessionId: sessionId },
        orderBy: { updatedAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.waste.listLines(tenantId, WasteStage.STAGE_1, sessionId),
      this.prisma.categoryOutput.findMany({
        where: { tenantId, sortSessionId: sessionId },
        select: {
          id: true, categoryId: true, gradeId: true, weightKg: true, usedKg: true, usedPieces: true, allocatedCost: true, entryBales: true, createdAt: true, count: true,
          category: { select: { name: true } }, grade: { select: { name: true, rank: true } },
          _count: { select: { gradeSessions: true } },
          baleAllocations: { select: { repackUnitId: true, repackUnit: { select: { createdAt: true, weightKg: true, categoryId: true, gradeId: true, category: { select: { name: true } }, grade: { select: { name: true, rank: true } }, inventoryItems: { select: { usedQuantity: true, status: true } }, _count: { select: { inputAllocations: true } } } } } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.inventoryItem.findFirst({
        where: { tenantId, ragId: session.rag.id, source: StockSource.KAT },
        select: { id: true, name: true, quantity: true, usedQuantity: true, status: true },
      }),
      // Kg graded afterwards (a separate grading of an entry of this lot) and not baled yet: it can be baled from here too.
      this.prisma.gradeOutput.findMany({
        where: {
          tenantId,
          measurementType: MeasurementType.WEIGHT,
          status: { in: [GradingOutputStatus.AVAILABLE, GradingOutputStatus.PARTIALLY_USED, GradingOutputStatus.READY_FOR_REPACK] },
          remainingAmount: { gt: 0 },
          gradeBucket: { gradeSession: { categoryOutput: { sortSessionId: sessionId } } },
        },
        select: { remainingAmount: true, gradeId: true, grade: { select: { name: true, rank: true } }, gradeBucket: { select: { gradeSession: { select: { categoryOutput: { select: { categoryId: true, category: { select: { name: true } } } } } } } } },
      }),
      // Bales made from that graded kg (they point at the grade output, not at the sorted entry).
      this.prisma.repackInputAllocation.findMany({
        where: { tenantId, gradingOutput: { gradeBucket: { gradeSession: { categoryOutput: { sortSessionId: sessionId } } } } },
        select: { repackUnitId: true, repackUnit: { select: { createdAt: true, weightKg: true, categoryId: true, gradeId: true, category: { select: { name: true } }, grade: { select: { name: true, rank: true } } } } },
      }),
    ]);
    const outputKg = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), ZERO);
    const computedWasteWeight = session.totalInputWeight.sub(outputKg);
    const declaredWasteAmount = wasteLineItems.reduce((sum, line) => sum.add(line.amount), ZERO);

    // What came out, per kind (category + grade): all of it, and today's (Pakistan time).
    const today = startOfDayPKT(now);
    const kinds = new Map<string, { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; rank: number; kg: Decimal; pieces: number; bales: number; todayKg: Decimal; todayPieces: number; todayBales: number; cost: Decimal }>();
    // Bales made from this lot — while sorting or later from its sorted kg — each counted once, by the bale's kind.
    const units = new Map<string, { createdAt: Date; weightKg: Decimal; categoryId: string; gradeId: string | null; category: { name: string }; grade: { name: string; rank: number } | null }>();
    // Kg sorted and not baled yet, per kind: what "Make bales" can still take.
    const loose = new Map<string, { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; rank: number; availableKg: Decimal; availablePieces: number }>();
    for (const o of outputs) {
      const key = `${o.categoryId}:${o.gradeId ?? ''}`;
      const k = kinds.get(key) ?? { categoryId: o.categoryId, categoryName: o.category.name, gradeId: o.gradeId, gradeName: o.grade?.name ?? null, rank: o.grade?.rank ?? 0, kg: ZERO, pieces: 0, bales: 0, todayKg: ZERO, todayPieces: 0, todayBales: 0, cost: ZERO };
      k.kg = k.kg.add(o.weightKg);
      k.pieces += o.count;
      if (o.createdAt >= today) k.todayPieces += o.count;
      k.cost = k.cost.add(o.allocatedCost);
      if (o.createdAt >= today) k.todayKg = k.todayKg.add(o.weightKg);
      kinds.set(key, k);
      for (const a of o.baleAllocations) {
        // A bale counts once, on the kind of the sorted kg it was made from.
        if (units.has(a.repackUnitId)) continue;
        units.set(a.repackUnitId, a.repackUnit);
        k.bales += 1;
        if (a.repackUnit.createdAt >= today) k.todayBales += 1;
      }
      const left = o.weightKg.sub(o.usedKg);
      if (left.greaterThan(ZERO) && !o._count.gradeSessions) {
        const l = loose.get(key) ?? { categoryId: o.categoryId, categoryName: o.category.name, gradeId: o.gradeId, gradeName: o.grade?.name ?? null, rank: o.grade?.rank ?? 0, availableKg: ZERO, availablePieces: 0 };
        l.availableKg = l.availableKg.add(left);
        // Pieces still loose: the entry's pieces in proportion to its kg not baled yet (bales by pieces, owner 2026-11-11).
        if (o.count > 0 && o.weightKg.greaterThan(0)) l.availablePieces += Math.round(left.mul(o.count).div(o.weightKg).toNumber());
        loose.set(key, l);
      } else if (o.weightKg.isZero() && o.count > o.usedPieces && !o._count.gradeSessions) {
        // An entry of a lot without a weight: only pieces, baled by the piece.
        const l = loose.get(key) ?? { categoryId: o.categoryId, categoryName: o.category.name, gradeId: o.gradeId, gradeName: o.grade?.name ?? null, rank: o.grade?.rank ?? 0, availableKg: ZERO, availablePieces: 0 };
        l.availablePieces += o.count - o.usedPieces;
        loose.set(key, l);
      }
    }
    for (const { repackUnitId, repackUnit: u } of gradedBales) {
      if (!units.has(repackUnitId) && u.categoryId) units.set(repackUnitId, { ...u, categoryId: u.categoryId });
    }
    for (const g of graded) {
      const co = g.gradeBucket.gradeSession.categoryOutput;
      const key = `${co.categoryId}:${g.gradeId}`;
      const l = loose.get(key) ?? { categoryId: co.categoryId, categoryName: co.category.name, gradeId: g.gradeId, gradeName: g.grade.name, rank: g.grade.rank, availableKg: ZERO, availablePieces: 0 };
      l.availableKg = l.availableKg.add(g.remainingAmount);
      loose.set(key, l);
    }
    const baleKinds = new Map<string, { categoryId: string; categoryName: string; gradeId: string | null; gradeName: string | null; rank: number; bales: number; kg: Decimal; todayBales: number }>();
    for (const u of units.values()) {
      const key = `${u.categoryId}:${u.gradeId ?? ''}`;
      const b = baleKinds.get(key) ?? { categoryId: u.categoryId, categoryName: u.category.name, gradeId: u.gradeId, gradeName: u.grade?.name ?? null, rank: u.grade?.rank ?? 0, bales: 0, kg: ZERO, todayBales: 0 };
      b.bales += 1;
      b.kg = b.kg.add(u.weightKg);
      if (u.createdAt >= today) b.todayBales += 1;
      baleKinds.set(key, b);
    }
    const byName = <T extends { categoryName: string; rank: number }>(a: T, b: T) => a.categoryName.localeCompare(b.categoryName) || a.rank - b.rank;
    const kindRows = [...kinds.values()]
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.rank - b.rank)
      .map(({ rank: _rank, cost: _cost, ...k }) => ({ ...k, kg: k.kg.toString(), todayKg: k.todayKg.toString() }));
    const closed = session.status === SortStatus.CLOSED;
    return {
      session: {
        ...session,
        computedWasteWeight: computedWasteWeight.toString(),
        declaredWasteAmount: declaredWasteAmount.toString(),
        remainingWasteAmount: computedWasteWeight.sub(declaredWasteAmount).toString(),
      },
      buckets,
      wasteLineItems,
      kinds: kindRows,
      ready: [...loose.values()].sort(byName).map(({ rank: _r, ...l }) => ({ ...l, availableKg: l.availableKg.toString() })),
      madeBales: [...baleKinds.values()].sort(byName).map(({ rank: _r, ...b }) => ({ ...b, kg: b.kg.toString() })),
      // Pieces: sorted so far and today (a lot bought by the piece counts in pieces).
      pieces: kindRows.reduce((s, k) => s + k.pieces, 0),
      today: { kg: kindRows.reduce((s, k) => s.add(k.todayKg), ZERO).toString(), pieces: kindRows.reduce((s, k) => s + k.todayPieces, 0), bales: [...units.values()].filter((u) => u.createdAt >= today).length },
      bales: units.size,
      // After closing: each kind with its share of the lot cost (the yield screen), and the kat put into stock.
      outputs: closed
        ? [...kinds.values()]
            .sort((a, b) => b.kg.comparedTo(a.kg))
            .map((k) => ({ id: `${k.categoryId}:${k.gradeId ?? ''}`, name: k.gradeName ? `${k.categoryName} · ${k.gradeName}` : k.categoryName, categoryId: k.categoryId, gradeId: k.gradeId, weightKg: k.kg.toString(), bales: k.bales, cost: k.cost.toString(), costPerKg: costPerKg(k.cost, k.kg).toString() }))
        : [],
      kat: kat ? { id: kat.id, name: kat.name, kg: kat.quantity.toString(), leftKg: kat.quantity.sub(kat.usedQuantity).toString(), status: kat.status } : null,
      // The lot itself (who sold it, what is inside, when, its cost per kg) and every entry, newest first (v2 review).
      lot: await this.lotInfo(tenantId, session.rag.id),
      entries: [...outputs].reverse().map((o) => {
        const unitIds = [...new Set(o.baleAllocations.map((a) => a.repackUnitId))];
        const ownBales = o.entryBales > 0;
        // Can be taken back while the lot is open and nothing from it is used (same rule as the server's undo).
        const used = ownBales
          ? o.baleAllocations.some((a) => a.repackUnit._count.inputAllocations > 1 || a.repackUnit.inventoryItems.some((i) => i.usedQuantity.greaterThan(0) || i.status !== InventoryStatus.AVAILABLE))
          : o.usedKg.greaterThan(0) || o.usedPieces > 0 || o._count.gradeSessions > 0;
        return {
          id: o.id,
          at: o.createdAt,
          categoryId: o.categoryId,
          categoryName: o.category.name,
          gradeName: o.grade?.name ?? null,
          kg: o.weightKg.toString(),
          pieces: o.count,
          bales: o.entryBales,
          baleIds: ownBales ? unitIds : [],
          removable: !closed && !used,
        };
      }),
    };
  }

  /**
   * One entry's kg, bales and pieces. A lot bought by the piece takes pieces (its kg is pieces × the lot's kg per piece;
   * the last pieces take the kg that is left, so nothing is lost to rounding). A lot bought by kg takes kg or bales,
   * with an optional count of pieces.
   */
  private async entryFor(tx: Tx, tenantId: string, dto: AddCategoryKgDto, remainingKg: Decimal): Promise<{ kg: Decimal; bales: number; baleKg: Decimal | null; pieces: number }> {
    const session = await tx.sortSession.findFirstOrThrow({ where: { id: dto.sessionId, tenantId }, select: { rag: { select: { pieces: true, weightKg: true } } } });
    const lotPieces = session.rag.pieces;
    if (!lotPieces) return { ...entryOf(dto), pieces: dto.pieces ?? dto.outputCount ?? 0 };
    if (!dto.pieces) throw new BadRequestException('This lot was bought by the piece: enter how many pieces');
    if (dto.bales) throw new BadRequestException('This lot was bought by the piece: enter pieces, then make bales of them');
    const done = await tx.categoryOutput.aggregate({ where: { tenantId, sortSessionId: dto.sessionId }, _sum: { count: true } });
    const left = lotPieces - (done._sum.count ?? 0);
    if (dto.pieces > left) throw new BadRequestException(`Only ${Math.max(left, 0)} pieces are left in this lot`);
    const kg = dto.pieces === left ? remainingKg : session.rag.weightKg.mul(dto.pieces).div(lotPieces).toDecimalPlaces(2);
    return { kg, bales: 0, baleKg: null, pieces: dto.pieces };
  }

  /** What the sorting screen shows about a lot: code, supplier, raw type, day bought, weight and cost per kg. */
  private async lotInfo(tenantId: string, lotId: string) {
    const r = await this.prisma.rag.findFirst({
      where: { id: lotId, tenantId },
      select: {
        id: true, ragCode: true, weightKg: true, allocatedCost: true, createdAt: true, status: true, pieces: true,
        vendor: { select: { name: true } }, rawCategory: { select: { name: true } }, container: { select: { containerNumber: true, vendor: { select: { name: true } } } },
      },
    });
    if (!r) return null;
    return {
      id: r.id, code: r.ragCode, status: r.status, weightKg: r.weightKg.toString(), boughtAt: r.createdAt,
      supplier: r.vendor?.name ?? r.container?.vendor?.name ?? null, rawType: r.rawCategory?.name ?? null, container: r.container?.containerNumber ?? null,
      costPerKg: r.weightKg.greaterThan(0) ? r.allocatedCost.div(r.weightKg).toDecimalPlaces(2).toString() : null,
      // Bought by the piece: sorted in pieces (how many, and the cost of one).
      pieces: r.pieces,
      costPerPiece: r.pieces ? r.allocatedCost.div(r.pieces).toDecimalPlaces(2).toString() : null,
    };
  }

  /** Takes one entry back by its id (the list on the sorting screen): its bales too, if none is used. */
  async removeEntry(tenantId: string, outputId: string, userId: string) {
    const removed = await this.prisma.$transaction(async (tx) => {
      const output = await tx.categoryOutput.findFirst({
        where: { id: outputId, tenantId },
        include: { baleAllocations: { select: { repackUnitId: true } }, _count: { select: { gradeSessions: true } } },
      });
      if (!output) throw new NotFoundException('Entry not found');
      const session = await tx.sortSession.findFirstOrThrow({ where: { id: output.sortSessionId, tenantId }, select: { status: true } });
      if (session.status !== SortStatus.OPEN) throw new ConflictException('This lot is closed; its entries cannot change');
      if (output._count.gradeSessions) throw new ConflictException('This entry was graded separately; it cannot be taken back');
      const capacity = await this.waste.capacity(tx, tenantId, WasteStage.STAGE_1, output.sortSessionId);
      await this.deleteEntry(tx, tenantId, output);
      await tx.sortCategoryBucket.update({ where: { id: output.sortCategoryBucketId }, data: { outputWeightKg: { decrement: output.weightKg } } });
      const outputKg = capacity.outputKg.sub(output.weightKg);
      await tx.sortSession.update({ where: { id: output.sortSessionId }, data: { totalOutputWeight: outputKg, wasteWeight: capacity.inputKg.sub(outputKg) } });
      return output;
    }, LONG_TX);
    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_OUTPUT_REMOVED',
      entityType: 'SortSession',
      entityId: removed.sortSessionId,
      metadataJson: { categoryId: removed.categoryId, gradeId: removed.gradeId, amountKg: removed.weightKg.toString(), bales: removed.entryBales, outputId },
    });
    return this.summary(tenantId, removed.sortSessionId);
  }

  /**
   * One sorting entry: loose kg (usable in Make bale at once) or bales made on the spot — each bale goes into stock
   * with its QR sticker. Costed at the lot's cost per kg until the lot closes.
   */
  async addKg(tenantId: string, dto: AddCategoryKgDto, userId: string) {
    const made = await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.capacity(tx, tenantId, WasteStage.STAGE_1, dto.sessionId);
      const entry = await this.entryFor(tx, tenantId, dto, capacity.remainingKg);
      this.waste.assertFits(capacity, entry.kg);
      const category = await tx.category.findFirst({ where: { id: dto.categoryId, tenantId, isActive: true }, select: { id: true } });
      if (!category) throw new BadRequestException('Invalid category');
      if (dto.workerId && !(await tx.worker.findFirst({ where: { id: dto.workerId, tenantId, isActive: true }, select: { id: true } }))) {
        throw new BadRequestException('Worker not found');
      }
      if (dto.gradeId && !(await tx.grade.findFirst({ where: { id: dto.gradeId, tenantId, isActive: true }, select: { id: true } }))) {
        throw new BadRequestException('Invalid grade');
      }
      const bucket = await tx.sortCategoryBucket.upsert({
        where: { sortSessionId_categoryId: { sortSessionId: dto.sessionId, categoryId: category.id } },
        create: { sortSessionId: dto.sessionId, categoryId: category.id, outputWeightKg: entry.kg, outputCount: entry.pieces },
        update: { outputWeightKg: { increment: entry.kg }, outputCount: { increment: entry.pieces } },
      });
      const outputKg = capacity.outputKg.add(entry.kg);
      const session = await tx.sortSession.update({
        where: { id: dto.sessionId },
        data: { totalOutputWeight: outputKg, wasteWeight: capacity.inputKg.sub(outputKg) },
        select: { ragId: true, rag: { select: { allocatedCost: true, weightKg: true, containerId: true, pieces: true } } },
      });
      const output = await tx.categoryOutput.create({
        data: {
          tenantId,
          sortCategoryBucketId: bucket.id,
          categoryId: category.id,
          gradeId: dto.gradeId ?? null,
          weightKg: entry.kg,
          count: entry.pieces,
          entryBales: entry.bales,
          workerId: dto.workerId ?? null,
          // A lot bought by the piece: its share of the pieces; otherwise its share of the kg.
          allocatedCost: session.rag.pieces
            ? openLotCost(session.rag.allocatedCost, session.rag.pieces, entry.pieces)
            : openLotCost(session.rag.allocatedCost, session.rag.weightKg, entry.kg),
          containerId: session.rag.containerId,
          ragId: session.ragId,
          sortSessionId: dto.sessionId,
        },
      });
      const baleIds: string[] = [];
      for (let i = 0; i < entry.bales; i++) {
        const bale = await this.bales.makeBaleTx(
          tx,
          tenantId,
          { categoryId: category.id, gradeId: dto.gradeId, weightKg: entry.baleKg!.toNumber(), allocations: [{ categoryOutputId: output.id, amountKg: entry.baleKg!.toNumber() }] },
          userId,
        );
        baleIds.push(bale.baleId);
      }
      return { outputId: output.id, baleIds, kg: entry.kg.toString(), bales: entry.bales, pieces: entry.pieces };
    }, LONG_TX);
    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_OUTPUT_ADDED',
      entityType: 'SortSession',
      entityId: dto.sessionId,
      metadataJson: { categoryId: dto.categoryId, gradeId: dto.gradeId ?? null, amountKg: made.kg, bales: made.bales, baleIds: made.baleIds, outputCount: made.pieces },
    });
    return { ...(await this.summary(tenantId, dto.sessionId)), baleIds: made.baleIds };
  }

  /**
   * Undo: takes the latest matching entry back while the lot is open — only if nothing from it was used (loose kg not
   * baled; bales not sold, opened or printed into another entry). Older lots (before v2 6.6) take kg off the category.
   */
  async removeKg(tenantId: string, dto: AddCategoryKgDto, userId: string) {
    const entry = entryOf(dto);
    await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.capacity(tx, tenantId, WasteStage.STAGE_1, dto.sessionId);
      const output = await tx.categoryOutput.findFirst({
        where: { tenantId, sortSessionId: dto.sessionId, categoryId: dto.categoryId, gradeId: dto.gradeId ?? null, entryBales: entry.bales, weightKg: entry.kg },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { baleAllocations: { select: { repackUnitId: true } } },
      });
      if (output) {
        await this.deleteEntry(tx, tenantId, output);
      } else if (!entry.bales) {
        await this.takeLooseKgBack(tx, tenantId, dto.sessionId, dto.categoryId, dto.gradeId ?? null, entry.kg);
      } else {
        throw new BadRequestException('That is more than was recorded for this category');
      }
      const taken = await tx.sortCategoryBucket.updateMany({
        where: { sortSessionId: dto.sessionId, categoryId: dto.categoryId, outputWeightKg: { gte: entry.kg } },
        data: { outputWeightKg: { decrement: entry.kg } },
      });
      if (!taken.count) throw new BadRequestException('That is more than was recorded for this category');
      const outputKg = capacity.outputKg.sub(entry.kg);
      await tx.sortSession.update({ where: { id: dto.sessionId }, data: { totalOutputWeight: outputKg, wasteWeight: capacity.inputKg.sub(outputKg) } });
    }, LONG_TX);
    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_OUTPUT_REMOVED',
      entityType: 'SortSession',
      entityId: dto.sessionId,
      metadataJson: { categoryId: dto.categoryId, gradeId: dto.gradeId ?? null, amountKg: entry.kg.toString(), bales: entry.bales },
    });
    return this.summary(tenantId, dto.sessionId);
  }

  /**
   * Part of the loose kg back (e.g. 12.5 of a 30 kg entry): off the newest unused loose entries of that kind; older
   * lots (before v2 6.6) can also have kg on the category with no entry, which is taken first.
   */
  private async takeLooseKgBack(tx: Tx, tenantId: string, sessionId: string, categoryId: string, gradeId: string | null, kg: Decimal) {
    let left = kg;
    if (!gradeId) {
      const bucket = await tx.sortCategoryBucket.findUnique({ where: { sortSessionId_categoryId: { sortSessionId: sessionId, categoryId } } });
      const covered = await tx.categoryOutput.aggregate({ where: { tenantId, sortSessionId: sessionId, categoryId }, _sum: { weightKg: true } });
      const legacy = bucket ? bucket.outputWeightKg.sub(covered._sum.weightKg ?? ZERO) : ZERO;
      left = left.sub(Decimal.min(left, Decimal.max(legacy, ZERO)));
    }
    if (left.isZero()) return;
    const session = await tx.sortSession.findFirstOrThrow({ where: { id: sessionId, tenantId }, select: { rag: { select: { allocatedCost: true, weightKg: true } } } });
    const loose = await tx.categoryOutput.findMany({
      where: { tenantId, sortSessionId: sessionId, categoryId, gradeId, entryBales: 0, usedKg: 0, usedPieces: 0, gradeSessions: { none: {} } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (loose.reduce((t, o) => t.add(o.weightKg), ZERO).lessThan(left)) {
      throw new BadRequestException('That is more than was recorded for this category');
    }
    for (const o of loose) {
      if (left.isZero()) break;
      const take = Decimal.min(left, o.weightKg);
      const rest = o.weightKg.sub(take);
      if (rest.isZero()) await tx.categoryOutput.delete({ where: { id: o.id } });
      else await tx.categoryOutput.update({ where: { id: o.id }, data: { weightKg: rest, allocatedCost: openLotCost(session.rag.allocatedCost, session.rag.weightKg, rest) } });
      left = left.sub(take);
    }
  }

  /** Deletes a sorting entry and the bales made from it, if none of it has been used. */
  private async deleteEntry(tx: Tx, tenantId: string, output: { id: string; usedKg: Decimal; usedPieces?: number; entryBales: number; baleAllocations: { repackUnitId: string }[] }) {
    if (!output.entryBales && (output.usedPieces ?? 0) > 0) throw new ConflictException('Some of these pieces are already in a bale; it cannot be taken back');
    const unitIds = [...new Set(output.baleAllocations.map((a) => a.repackUnitId))];
    if (!output.entryBales && output.usedKg.greaterThan(0)) throw new ConflictException('Some of these kg are already in a bale; it cannot be taken back');
    if (await tx.gradeSession.count({ where: { tenantId, categoryOutputId: output.id } })) throw new ConflictException('This entry is being graded; it cannot be taken back');
    if (unitIds.length) {
      const units = await tx.repackUnit.findMany({
        where: { id: { in: unitIds }, tenantId },
        select: { id: true, inputAllocations: { select: { categoryOutputId: true } }, inventoryItems: { select: { id: true, usedQuantity: true, status: true } } },
      });
      const busy = units.some((u) => u.inputAllocations.some((a) => a.categoryOutputId !== output.id) || u.inventoryItems.some((i) => i.usedQuantity.greaterThan(0) || i.status !== InventoryStatus.AVAILABLE));
      if (busy) throw new ConflictException('A bale from this entry is already sold or used; it cannot be taken back');
      const itemIds = units.flatMap((u) => u.inventoryItems.map((i) => i.id));
      await tx.stockMovement.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds }, tenantId } });
      await tx.qRLabel.deleteMany({ where: { repackUnitId: { in: unitIds } } });
      await tx.repackInputAllocation.deleteMany({ where: { repackUnitId: { in: unitIds } } });
      await tx.repackUnit.deleteMany({ where: { id: { in: unitIds }, tenantId } });
    }
    await tx.categoryOutput.delete({ where: { id: output.id } });
  }

  /**
   * Closes the lot when its sorting is finished: what is left is kat (booked as waste, and put into stock to sell by
   * kg at no cost); the lot's whole cost is then shared over what came out, re-costing bales made while it was open.
   */
  async close(tenantId: string, sessionId: string, userId: string, wasteCategoryId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.bookRemainder(tx, tenantId, WasteStage.STAGE_1, sessionId, wasteCategoryId);
      const session = await tx.sortSession.findFirstOrThrow({
        where: { id: sessionId, tenantId },
        include: { rag: { select: { id: true, ragCode: true, containerId: true, pieces: true, weightKg: true } }, sortCategoryBuckets: true },
      });
      const sortedPieces = session.rag.pieces ? (await tx.categoryOutput.aggregate({ where: { tenantId, sortSessionId: sessionId }, _sum: { count: true } }))._sum.count ?? 0 : 0;
      // A lot without a weight has no kg: it needs at least one entry of pieces.
      if (capacity.outputKg.equals(ZERO) && !sortedPieces) throw new BadRequestException('Record at least one category before closing');

      // Lots sorted before v2 6.6 keep kg on the category without an entry: give it one now.
      for (const bucket of session.sortCategoryBuckets) {
        const covered = await tx.categoryOutput.aggregate({ where: { tenantId, sortCategoryBucketId: bucket.id }, _sum: { weightKg: true } });
        const missing = bucket.outputWeightKg.sub(covered._sum.weightKg ?? ZERO);
        if (missing.greaterThan(ZERO)) {
          await tx.categoryOutput.create({
            data: { tenantId, sortCategoryBucketId: bucket.id, categoryId: bucket.categoryId, weightKg: missing, count: bucket.outputCount, allocatedCost: ZERO, containerId: session.rag.containerId, ragId: session.ragId, sortSessionId: sessionId },
          });
        }
      }

      // Untouched loose kg of a category without a grade becomes one output (what the separate grading step takes).
      const loose = await tx.categoryOutput.findMany({
        where: { tenantId, sortSessionId: sessionId, gradeId: null, entryBales: 0, usedKg: 0, usedPieces: 0, gradeSessions: { none: {} } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      // One per category and worker: whose kg it was stays known (sorter pay, Phase 8).
      for (const key of new Set(loose.map((o) => `${o.categoryId}|${o.workerId ?? ''}`))) {
        const [keep, ...rest] = loose.filter((o) => `${o.categoryId}|${o.workerId ?? ''}` === key);
        if (!rest.length) continue;
        await tx.categoryOutput.update({
          where: { id: keep.id },
          data: { weightKg: rest.reduce((t, o) => t.add(o.weightKg), keep.weightKg), count: rest.reduce((t, o) => t + o.count, keep.count) },
        });
        await tx.categoryOutput.deleteMany({ where: { id: { in: rest.map((o) => o.id) } } });
      }

      const katKg = capacity.inputKg.sub(capacity.outputKg);
      await tx.rag.update({ where: { id: session.ragId }, data: { status: RagStatus.SORTED } });
      await tx.sortSession.update({
        where: { id: sessionId },
        data: { status: SortStatus.CLOSED, endTime: new Date(), totalOutputWeight: capacity.outputKg, wasteWeight: katKg },
      });
      // Kat: the kg left; a lot without a weight leaves pieces instead (into stock as pieces, at no cost).
      const katPieces = session.rag.pieces && session.rag.weightKg.isZero() ? session.rag.pieces - sortedPieces : 0;
      const katId = katKg.greaterThan(ZERO)
        ? await this.katToStock(tx, tenantId, session, katKg, wasteCategoryId)
        : katPieces > 0 ? await this.katToStock(tx, tenantId, session, new Decimal(katPieces), wasteCategoryId, StockUnit.PIECE) : null;
      // Now closed: the lot's whole cost is shared over what came out (kat carries none).
      const costing = await this.costing.recostLotOutputsTx(tx, tenantId, session.ragId, userId);
      return { katKg, katId, adjustments: costing.adjustments.length };
    }, LONG_TX);

    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_SESSION_CLOSED',
      entityType: 'SortSession',
      entityId: sessionId,
      metadataJson: { wasteWeight: result.katKg.toString(), katItemId: result.katId, costAdjustments: result.adjustments },
    });
    return this.summary(tenantId, sessionId);
  }

  /** Kat into stock: one loose-kg item named after the waste type and lot, at zero cost, to sell or throw away. */
  private async katToStock(tx: Tx, tenantId: string, session: { id: string; ragId: string; rag: { ragCode: string; containerId: string | null } }, kg: Decimal, wasteCategoryId?: string, unit: StockUnit = StockUnit.KG) {
    const pieces = unit === StockUnit.PIECE;
    const type = wasteCategoryId
      ? await tx.wasteCategory.findFirst({ where: { id: wasteCategoryId, tenantId }, select: { name: true } })
      : await tx.wasteCategory.findFirst({ where: { tenantId, isActive: true, linkedCategoryId: null }, orderBy: { createdAt: 'asc' }, select: { name: true } });
    const item = await tx.inventoryItem.create({
      data: {
        tenantId,
        warehouseId: await defaultGodownId(tx, tenantId),
        source: StockSource.KAT,
        name: `${type?.name ?? 'Kat'} · ${session.rag.ragCode}`,
        unit,
        quantity: kg,
        totalCost: ZERO,
        unitCost: ZERO,
        avgCost: money(ZERO),
        weightKg: pieces ? null : kg,
        pcsCount: pieces ? kg.toNumber() : 0,
        status: InventoryStatus.AVAILABLE,
        containerId: session.rag.containerId,
        ragId: session.ragId,
      },
    });
    await tx.stockMovement.create({
      data: { inventoryItemId: item.id, movementType: MovementType.INTAKE, quantityKg: pieces ? 0 : kg, quantityPcs: pieces ? kg.toNumber() : 0, referenceId: session.id, metadataJson: { kind: 'KAT', sortSessionId: session.id } },
    });
    return item.id;
  }

  /** Kat nobody will buy: taken out of stock (it cost nothing, so no cost moves). */
  async throwAwayKat(tenantId: string, itemId: string, userId: string) {
    const kg = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: itemId, tenantId, source: StockSource.KAT } });
      if (!item) throw new NotFoundException('Kat not found');
      const left = item.quantity.sub(item.usedQuantity);
      if (left.lessThanOrEqualTo(ZERO)) throw new ConflictException('This kat is already sold or thrown away');
      const done = await tx.inventoryItem.updateMany({ where: { id: item.id, usedQuantity: item.usedQuantity }, data: { usedQuantity: item.quantity, status: InventoryStatus.SOLD } });
      if (done.count !== 1) throw new ConflictException('This kat changed meanwhile. Please try again.');
      await tx.stockMovement.create({
        data: { inventoryItemId: item.id, movementType: MovementType.ADJUSTMENT, quantityKg: left.neg(), referenceId: item.id, metadataJson: { kind: 'KAT_THROWN_AWAY', kg: left.toString() } },
      });
      return left;
    });
    await this.audit.log({ tenantId, userId, action: 'KAT_THROWN_AWAY', entityType: 'InventoryItem', entityId: itemId, metadataJson: { kg: kg.toString() } });
    return { id: itemId, thrownAwayKg: kg.toString() };
  }

  /** Throughput of the last 100 sessions, overall and per worker (kg per hour). */
  async productivity(tenantId: string) {
    const sessions = await this.prisma.sortSession.findMany({
      where: { tenantId },
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let inputKg = ZERO;
    let outputKg = ZERO;
    let wasteKg = ZERO;
    let activeHours = 0;
    const operators = new Map<string, { id: string; name: string; processedKg: Decimal; activeHours: number; sessionsCount: number }>();

    for (const s of sessions) {
      inputKg = inputKg.add(s.totalInputWeight);
      outputKg = outputKg.add(s.totalOutputWeight);
      wasteKg = wasteKg.add(s.wasteWeight);
      const end = s.endTime ? s.endTime.getTime() : Date.now();
      const hours = Math.max(0.1, (end - s.startTime.getTime()) / 3_600_000);
      if (s.status === SortStatus.CLOSED) activeHours += hours;
      const op = operators.get(s.workerId) ?? { id: s.workerId, name: s.worker?.name || 'Worker', processedKg: ZERO, activeHours: 0, sessionsCount: 0 };
      op.processedKg = op.processedKg.add(s.totalInputWeight);
      op.activeHours += hours;
      op.sessionsCount += 1;
      operators.set(s.workerId, op);
    }

    const perHour = (kg: Decimal, hours: number) => (hours > 0 ? kg.div(hours).toDecimalPlaces(2).toNumber() : 0);
    const pct = (part: Decimal) => (inputKg.greaterThan(ZERO) ? part.div(inputKg).mul(100).toDecimalPlaces(1).toNumber() : 0);

    return {
      totalInputKg: inputKg.toNumber(),
      totalOutputKg: outputKg.toNumber(),
      totalWasteKg: wasteKg.toNumber(),
      totalActiveHours: Number(activeHours.toFixed(2)),
      kgPerHour: perHour(inputKg, activeHours),
      conversionYieldPct: pct(outputKg),
      wasteRatioPct: pct(wasteKg),
      operatorLeaderboard: [...operators.values()]
        .map((op) => ({ ...op, processedKg: op.processedKg.toNumber(), kgPerHour: perHour(op.processedKg, op.activeHours) }))
        .sort((a, b) => b.kgPerHour - a.kgPerHour),
    };
  }
}
