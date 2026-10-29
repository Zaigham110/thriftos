import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RagStatus, SortStatus, WasteStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../audit/audit.service';
import { outputCosts } from '../costing/costing';
import { PrismaService } from '../prisma/prisma.service';
import { AddCategoryKgDto, LotQueueQueryDto, StartSortDto } from './sorting.dto';
import { SortingWasteService } from './sorting-waste.service';

const ZERO = new Decimal(0);

/** Stage 1: sort a lot into categories. */
@Injectable()
export class SortSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly waste: SortingWasteService,
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
        select: { id: true, weightKg: true, status: true },
      });
      if (!rag) throw new BadRequestException('Lot not found');
      if (rag.status !== RagStatus.NOT_STARTED) {
        throw new ConflictException(`This lot cannot be sorted again (status ${rag.status}).`);
      }
      await tx.rag.update({ where: { id: rag.id }, data: { status: RagStatus.IN_SORTING } });
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

  /** The open session for a lot, or an empty summary (used to resume). */
  async openSummaryForLot(tenantId: string, lotId: string) {
    const session = await this.prisma.sortSession.findFirst({
      where: { tenantId, status: SortStatus.OPEN, ragId: lotId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!session) return { session: null, buckets: [], wasteLineItems: [] };
    return this.summary(tenantId, session.id);
  }

  async summary(tenantId: string, sessionId: string) {
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
    const [buckets, wasteLineItems] = await Promise.all([
      this.prisma.sortCategoryBucket.findMany({
        where: { sortSessionId: sessionId },
        orderBy: { updatedAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.waste.listLines(tenantId, WasteStage.STAGE_1, sessionId),
    ]);
    const outputKg = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), ZERO);
    const computedWasteWeight = session.totalInputWeight.sub(outputKg);
    const declaredWasteAmount = wasteLineItems.reduce((sum, line) => sum.add(line.amount), ZERO);
    return {
      session: {
        ...session,
        computedWasteWeight: computedWasteWeight.toString(),
        declaredWasteAmount: declaredWasteAmount.toString(),
        remainingWasteAmount: computedWasteWeight.sub(declaredWasteAmount).toString(),
      },
      buckets,
      wasteLineItems,
    };
  }

  /** Adds kg (and optional pieces) to a category in an open session. */
  async addKg(tenantId: string, dto: AddCategoryKgDto, userId: string) {
    const kg = new Decimal(dto.amountKg);
    await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.capacity(tx, tenantId, WasteStage.STAGE_1, dto.sessionId);
      this.waste.assertFits(capacity, kg);
      const category = await tx.category.findFirst({
        where: { id: dto.categoryId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Invalid category');
      await tx.sortCategoryBucket.upsert({
        where: { sortSessionId_categoryId: { sortSessionId: dto.sessionId, categoryId: category.id } },
        create: { sortSessionId: dto.sessionId, categoryId: category.id, outputWeightKg: kg, outputCount: dto.outputCount ?? 0 },
        update: { outputWeightKg: { increment: kg }, outputCount: { increment: dto.outputCount ?? 0 } },
      });
      const outputKg = capacity.outputKg.add(kg);
      await tx.sortSession.update({
        where: { id: dto.sessionId },
        data: { totalOutputWeight: outputKg, wasteWeight: capacity.inputKg.sub(outputKg) },
      });
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_OUTPUT_ADDED',
      entityType: 'SortSession',
      entityId: dto.sessionId,
      metadataJson: { categoryId: dto.categoryId, amountKg: kg.toString(), outputCount: dto.outputCount ?? 0 },
    });
    return this.summary(tenantId, dto.sessionId);
  }

  /**
   * Closes the lot: books any remainder as waste, creates the category outputs with their
   * share of the lot cost (by output weight), and marks the lot SORTED for good.
   */
  async close(tenantId: string, sessionId: string, userId: string, wasteCategoryId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.bookRemainder(tx, tenantId, WasteStage.STAGE_1, sessionId, wasteCategoryId);
      const session = await tx.sortSession.findFirstOrThrow({
        where: { id: sessionId, tenantId },
        include: {
          rag: { select: { allocatedCost: true } },
          sortCategoryBuckets: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      });
      if (capacity.outputKg.equals(ZERO)) {
        throw new BadRequestException('Record at least one category before closing');
      }

      const buckets = session.sortCategoryBuckets.filter((b) => b.outputWeightKg.greaterThan(ZERO));
      const costs = outputCosts(session.rag.allocatedCost, buckets.map((b) => ({ key: b.id, kg: b.outputWeightKg })));
      const outputs = [];
      for (const bucket of buckets) {
        outputs.push(
          await tx.categoryOutput.create({
            data: {
              tenantId,
              sortCategoryBucketId: bucket.id,
              categoryId: bucket.categoryId,
              weightKg: bucket.outputWeightKg,
              count: bucket.outputCount,
              allocatedCost: costs.find((c) => c.key === bucket.id)!.amount,
              containerId: capacity.trace.containerId,
              ragId: session.ragId,
              sortSessionId: sessionId,
            },
          }),
        );
      }
      await tx.rag.update({ where: { id: session.ragId }, data: { status: RagStatus.SORTED } });
      await tx.sortSession.update({
        where: { id: sessionId },
        data: {
          status: SortStatus.CLOSED,
          endTime: new Date(),
          totalOutputWeight: capacity.outputKg,
          wasteWeight: capacity.inputKg.sub(capacity.outputKg),
        },
      });
      return { outputsCreated: outputs.length, wasteWeight: capacity.inputKg.sub(capacity.outputKg) };
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'SORT_SESSION_CLOSED',
      entityType: 'SortSession',
      entityId: sessionId,
      metadataJson: { outputsCreated: result.outputsCreated, wasteWeight: result.wasteWeight.toString() },
    });
    return this.summary(tenantId, sessionId);
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
