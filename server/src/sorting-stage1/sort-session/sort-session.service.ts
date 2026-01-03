import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSortSessionDto, UpdateSortSessionDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { SortStatus, RagStatus, WasteStage } from '@prisma/client';

@Injectable()
export class SortSessionService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Create a new sorting session for a Rag/Bale.
   * 
   * Phase 2.5 Domain Rules (LOCKED):
   * - Sorting MUST operate on a single Rag/Bale
   * - Rag status must be NOT_STARTED
   * - On creation, Rag status transitions to IN_SORTING
   * - Each Rag can only be sorted ONCE (enforced by @unique constraint)
   */
  async create(tenantId: string, dto: CreateSortSessionDto, currentUserId: string) {
    const ragId = dto.ragId;
    const incomingBaleId = dto.incomingBaleId;

    if (!!ragId === !!incomingBaleId) {
      throw new BadRequestException('Exactly one of ragId or incomingBaleId must be provided');
    }

    const workerId = dto.workerId || currentUserId;
    const supervisorId = dto.supervisorId || currentUserId;

    // Phase 2.5: Validate Rag status and get input weight in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      let inputWeight: Decimal;
      let containerId: string | null = null;

      if (ragId) {
        // Fetch Rag and validate status
        const rag = await tx.rag.findFirst({
          where: { id: ragId, tenantId },
          select: { id: true, weightKg: true, status: true, containerId: true },
        });

        if (!rag) {
          throw new BadRequestException('Source not found: ragId');
        }

        // Phase 2.5: STRICT - Only NOT_STARTED rags can be sorted
        if (rag.status !== RagStatus.NOT_STARTED) {
          throw new ConflictException(
            `Rag cannot be sorted: status is ${rag.status}. Only NOT_STARTED rags can be sorted.`
          );
        }

        inputWeight = rag.weightKg;
        containerId = rag.containerId;

        // Phase 2.5: Transition Rag status to IN_SORTING
        await tx.rag.update({
          where: { id: ragId },
          data: { status: RagStatus.IN_SORTING },
        });
      } else if (incomingBaleId) {
        // Legacy IncomingBale support
        const bale = await tx.incomingBale.findFirst({
          where: { id: incomingBaleId, tenantId },
          select: { weightKg: true, containerId: true },
        });
        if (!bale) {
          throw new BadRequestException('Source not found: incomingBaleId');
        }
        inputWeight = bale.weightKg;
        containerId = bale.containerId;
      } else {
        throw new BadRequestException('Missing source');
      }

      // Create session with traceability
      const session = await tx.sortSession.create({
        data: {
          tenantId,
          ragId: ragId || undefined,
          incomingBaleId: incomingBaleId || undefined,
          workerId,
          supervisorId,
          totalInputWeight: inputWeight,
          totalOutputWeight: new Decimal(0),
          wasteWeight: new Decimal(0),
          status: SortStatus.OPEN,
        },
      });

      return { session, containerId };
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'SORT_SESSION_CREATED',
      entityType: 'SortSession',
      entityId: result.session.id,
      metadataJson: {
        ragId,
        incomingBaleId,
        workerId,
        supervisorId,
        totalInputWeight: result.session.totalInputWeight.toString(),
        ragStatusTransition: ragId ? 'NOT_STARTED → IN_SORTING' : null,
      },
    });

    return result.session;
  }

  async findAll(
    tenantId: string,
    options?: { status?: SortStatus; page?: number; limit?: number },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(options?.status && { status: options.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.sortSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rag: { select: { id: true, ragCode: true, weightKg: true, allocatedCost: true } },
          incomingBale: { select: { id: true, baleCode: true, weightKg: true, cost: true } },
          worker: { select: { id: true, name: true, email: true } },
          supervisor: { select: { id: true, name: true, email: true } },
          _count: { select: { sortCategoryBuckets: true } },
        },
      }),
      this.prisma.sortSession.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const session = await this.prisma.sortSession.findFirst({
      where: { id, tenantId },
      include: {
        rag: { select: { id: true, ragCode: true, weightKg: true, allocatedCost: true } },
        incomingBale: { select: { id: true, baleCode: true, weightKg: true, cost: true } },
        worker: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
        sortCategoryBuckets: {
          orderBy: { updatedAt: 'desc' },
          include: {
            category: { select: { id: true, name: true } },
            categoryOutputs: true,
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Sort session not found');

    const yieldPercent =
      session.totalInputWeight.equals(new Decimal(0))
        ? new Decimal(0)
        : session.totalOutputWeight.div(session.totalInputWeight).mul(new Decimal(100));

    return { ...session, yieldPercent: yieldPercent.toNumber() };
  }

  async update(tenantId: string, id: string, dto: UpdateSortSessionDto, currentUserId: string) {
    const session = await this.prisma.sortSession.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('Sort session not found');
    if (session.status !== SortStatus.OPEN) {
      throw new ConflictException('Cannot update a CLOSED sort session');
    }

    const updated = await this.prisma.sortSession.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'SORT_SESSION_UPDATED',
      entityType: 'SortSession',
      entityId: id,
      metadataJson: { changes: dto },
    });

    return updated;
  }

  /**
   * Close a session:
   * - validate buckets exist and totalOutputWeight > 0
   * - compute waste + yield
   * - create immutable CategoryOutput records (Level-2 allocation) with full traceability
   * - lock session (CLOSED)
   * 
   * Phase 2.5 Domain Rules (LOCKED):
   * - On close, Rag status transitions to SORTED (permanently closed)
   * - CategoryOutput MUST carry containerId, ragId, sortSessionId for traceability
   * 
   * Waste Rules (LOCKED):
   * - Waste is recorded explicitly via categorized WasteLineItem entries
   * - At seal, declaredWaste must exactly equal computed waste
   * - If remaining waste > 0 at seal, wasteCategoryId must be provided to create the final remainder line
   */
  async close(
    tenantId: string,
    sessionId: string,
    currentUserId: string,
    options?: { wasteCategoryId?: string },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.sortSession.findFirst({
        where: { id: sessionId, tenantId },
        include: {
          rag: { select: { id: true, allocatedCost: true, containerId: true } },
          incomingBale: { select: { cost: true, containerId: true } },
          sortCategoryBuckets: true,
        },
      });

      if (!session) throw new NotFoundException('Sort session not found');
      if (session.status !== SortStatus.OPEN) throw new ConflictException('Cannot close session twice');

      const buckets = session.sortCategoryBuckets;
      if (!buckets || buckets.length === 0) {
        throw new BadRequestException('At least one bucket is required to close');
      }

      const totalOutputWeight = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), new Decimal(0));
      if (totalOutputWeight.equals(new Decimal(0))) {
        throw new BadRequestException('totalOutputWeight must be > 0 to close');
      }

      if (totalOutputWeight.greaterThan(session.totalInputWeight)) {
        throw new BadRequestException('wasteWeight cannot be negative (output exceeds input)');
      }

      const computedWasteWeight = session.totalInputWeight.sub(totalOutputWeight);

      const existingWasteAgg = await tx.wasteLineItem.aggregate({
        where: { tenantId, stage: WasteStage.STAGE_1, sortSessionId: sessionId },
        _sum: { amount: true },
      });
      const declaredWasteAmount = existingWasteAgg._sum.amount || new Decimal(0);

      if (declaredWasteAmount.greaterThan(computedWasteWeight)) {
        throw new BadRequestException('Declared waste exceeds computed waste');
      }

      const remainingWasteAmount = computedWasteWeight.sub(declaredWasteAmount);
      if (remainingWasteAmount.greaterThan(new Decimal(0))) {
        if (!options?.wasteCategoryId) {
          throw new BadRequestException('wasteCategoryId is required to seal when remaining waste > 0');
        }

        const category = await tx.wasteCategory.findFirst({
          where: { id: options.wasteCategoryId, tenantId, isActive: true },
        });
        if (!category) {
          throw new BadRequestException('Invalid waste category');
        }

        // Phase 2.5: Get traceability chain (for waste line)
        const containerId = session.rag?.containerId ?? session.incomingBale?.containerId ?? null;
        const ragId = session.ragId;

        await tx.wasteLineItem.create({
          data: {
            tenantId,
            stage: WasteStage.STAGE_1,
            wasteCategoryId: category.id,
            amount: remainingWasteAmount,
            unitType: category.unitType,
            estimatedValue: remainingWasteAmount.mul(category.defaultResalePrice),
            sortSessionId: sessionId,
            containerId,
            ragId: ragId || null,
            categoryOutputId: null,
          },
        });
      }

      const yieldPercent = session.totalInputWeight.equals(new Decimal(0))
        ? new Decimal(0)
        : totalOutputWeight.div(session.totalInputWeight).mul(new Decimal(100));

      const sourceCost = session.rag?.allocatedCost ?? session.incomingBale?.cost ?? new Decimal(0);

      // Phase 2.5: Get traceability chain
      const containerId = session.rag?.containerId ?? session.incomingBale?.containerId ?? null;
      const ragId = session.ragId;

      const outputs = [];
      for (const bucket of buckets) {
        if (bucket.outputWeightKg.equals(new Decimal(0)) && bucket.outputCount === 0) continue;
        const allocatedCost = bucket.outputWeightKg.div(totalOutputWeight).mul(sourceCost);

        // Phase 2.5: Create CategoryOutput with full traceability chain
        outputs.push(
          await tx.categoryOutput.create({
            data: {
              tenantId,
              sortCategoryBucketId: bucket.id,
              categoryId: bucket.categoryId,
              weightKg: bucket.outputWeightKg,
              count: bucket.outputCount,
              allocatedCost,
              // Phase 2.5: Traceability fields (MANDATORY)
              containerId,
              ragId: ragId!,
              sortSessionId: sessionId,
            },
          }),
        );
      }

      // Phase 2.5: Transition Rag status to SORTED (permanently closed)
      if (ragId) {
        await tx.rag.update({
          where: { id: ragId },
          data: { status: RagStatus.SORTED },
        });
      }

      const updatedSession = await tx.sortSession.update({
        where: { id: sessionId },
        data: {
          status: SortStatus.CLOSED,
          endTime: new Date(),
          totalOutputWeight,
          // Keep wasteWeight as computed waste for legacy fields
          wasteWeight: computedWasteWeight,
        },
      });

      return {
        session: updatedSession,
        outputs,
        yieldPercent: yieldPercent.toNumber(),
        wasteWeight: computedWasteWeight,
      };
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'SORT_SESSION_CLOSED',
      entityType: 'SortSession',
      entityId: sessionId,
      metadataJson: {
        outputsCreated: result.outputs.length,
        yieldPercent: result.yieldPercent,
        wasteWeight: result.wasteWeight?.toString(),
        ragStatusTransition: 'IN_SORTING → SORTED',
      },
    });

    return result;
  }
}
