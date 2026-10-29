import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RagStatus, SortStatus, WasteStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../audit/audit.service';
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
    const ragWhere = {
      tenantId,
      status: query.status ? (query.status as RagStatus) : { in: [RagStatus.NOT_STARTED, RagStatus.IN_SORTING] },
    };
    const baleWhere = {
      tenantId,
      purchaseOrderId: { not: null },
      purchaseOrder: { is: { status: { not: 'CLOSED' as const } } },
      OR: [{ sortSessions: { none: {} } }, { sortSessions: { some: { status: SortStatus.OPEN } } }],
    };

    const [rags, ragTotal, bales, baleTotal] = await Promise.all([
      this.prisma.rag.findMany({
        where: ragWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          container: { select: { id: true, containerNumber: true, purchaseOrder: { select: { id: true, poNumber: true } } } },
          rawCategory: { select: { id: true, name: true, rawType: true } },
        },
      }),
      this.prisma.rag.count({ where: ragWhere }),
      this.prisma.incomingBale.findMany({
        where: baleWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          purchaseOrder: { select: { id: true, poNumber: true } },
          vendor: { select: { id: true, name: true } },
          rawCategory: { select: { id: true, name: true, rawType: true } },
          sortSessions: { select: { id: true, status: true } },
        },
      }),
      this.prisma.incomingBale.count({ where: baleWhere }),
    ]);

    const data = [
      ...rags.map((rag) => ({ ...rag, sourceType: 'RAG' as const, sourceId: rag.id })),
      ...bales
        .map((bale) => ({
          ...bale,
          sourceType: 'LOOSE_BALE' as const,
          sourceId: bale.id,
          status: bale.sortSessions.length === 0 ? 'NOT_STARTED' : 'IN_SORTING',
        }))
        .filter((bale) => !query.status || bale.status === query.status),
    ].sort((a, b) => Number(b.status === 'IN_SORTING') - Number(a.status === 'IN_SORTING'));

    return { data, total: ragTotal + baleTotal, page, limit };
  }

  async start(tenantId: string, dto: StartSortDto, userId: string) {
    if (!!dto.ragId === !!dto.incomingBaleId) {
      throw new BadRequestException('Exactly one of ragId or incomingBaleId must be provided');
    }
    const workerId = dto.workerId || userId;
    const supervisorId = dto.supervisorId || userId;

    const session = await this.prisma.$transaction(async (tx) => {
      let ragId: string;
      let incomingBaleId = dto.incomingBaleId;
      let inputWeight: Decimal;

      if (dto.ragId) {
        const rag = await tx.rag.findFirst({
          where: { id: dto.ragId, tenantId },
          select: { id: true, weightKg: true, status: true, containerId: true, ragCode: true },
        });
        if (!rag) throw new BadRequestException('Lot not found');
        if (rag.status !== RagStatus.NOT_STARTED) {
          throw new ConflictException(`This lot cannot be sorted again (status ${rag.status}).`);
        }
        if (!rag.containerId) {
          const matchingBale = await tx.incomingBale.findFirst({
            where: { tenantId, baleCode: rag.ragCode },
            select: { id: true },
          });
          incomingBaleId = matchingBale?.id;
        }
        await tx.rag.update({ where: { id: rag.id }, data: { status: RagStatus.IN_SORTING } });
        ragId = rag.id;
        inputWeight = rag.weightKg;
      } else {
        const bale = await tx.incomingBale.findFirst({ where: { id: dto.incomingBaleId, tenantId } });
        if (!bale) throw new BadRequestException('Bale not found');
        const marker = `auto_migrated_bale:${bale.id}`;
        let rag = await tx.rag.findFirst({ where: { tenantId, notes: marker } });
        if (rag) {
          await tx.rag.update({ where: { id: rag.id }, data: { status: RagStatus.IN_SORTING } });
        } else {
          const rawCategoryId = bale.rawCategoryId || (await tx.rawCategory.findFirst({ where: { tenantId } }))?.id;
          if (!rawCategoryId) {
            throw new BadRequestException('Add at least one raw category before sorting loose bales');
          }
          rag = await tx.rag.create({
            data: {
              tenantId,
              containerId: bale.containerId,
              sourceType: bale.containerId ? 'CONTAINER' : 'LOOSE_BALE',
              ragCode: `BALE-${bale.baleCode || bale.id.slice(-6)}`,
              ragBaleType: 'BALE',
              rawCategoryId,
              weightKg: bale.weightKg,
              allocatedCost: bale.cost || ZERO,
              status: RagStatus.IN_SORTING,
              notes: marker,
            },
          });
        }
        ragId = rag.id;
        inputWeight = bale.weightKg;
      }

      return tx.sortSession.create({
        data: {
          tenantId,
          ragId,
          incomingBaleId,
          workerId,
          supervisorId,
          totalInputWeight: inputWeight,
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
      metadataJson: { ragId: session.ragId, incomingBaleId: session.incomingBaleId, workerId, supervisorId },
    });
    return this.summary(tenantId, session.id);
  }

  /** The open session for a lot, or an empty summary (used to resume). */
  async openSummaryForLot(tenantId: string, lotId: string) {
    const session = await this.prisma.sortSession.findFirst({
      where: { tenantId, status: SortStatus.OPEN, OR: [{ ragId: lotId }, { incomingBaleId: lotId }] },
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
          incomingBale: { select: { cost: true } },
          sortCategoryBuckets: true,
        },
      });
      if (capacity.outputKg.equals(ZERO)) {
        throw new BadRequestException('Record at least one category before closing');
      }

      const lotCost = session.rag?.allocatedCost ?? session.incomingBale?.cost ?? ZERO;
      const outputs = [];
      for (const bucket of session.sortCategoryBuckets) {
        if (bucket.outputWeightKg.equals(ZERO) && bucket.outputCount === 0) continue;
        outputs.push(
          await tx.categoryOutput.create({
            data: {
              tenantId,
              sortCategoryBucketId: bucket.id,
              categoryId: bucket.categoryId,
              weightKg: bucket.outputWeightKg,
              count: bucket.outputCount,
              allocatedCost: bucket.outputWeightKg.div(capacity.outputKg).mul(lotCost),
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
