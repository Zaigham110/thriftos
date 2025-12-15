import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSortSessionDto, UpdateSortSessionDto } from './dto';
import { Decimal } from '@prisma/client/runtime/library';
import { SortStatus } from '@prisma/client';

@Injectable()
export class SortSessionService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateSortSessionDto, currentUserId: string) {
    const ragId = dto.ragId;
    const incomingBaleId = dto.incomingBaleId;

    if (!!ragId === !!incomingBaleId) {
      throw new BadRequestException('Exactly one of ragId or incomingBaleId must be provided');
    }

    const workerId = dto.workerId || currentUserId;
    const supervisorId = dto.supervisorId || currentUserId;

    const inputWeight = await this.getInputWeight(tenantId, { ragId, incomingBaleId });

    const existingOpen = await this.prisma.sortSession.findFirst({
      where: {
        tenantId,
        status: SortStatus.OPEN,
        ...(ragId ? { ragId } : {}),
        ...(incomingBaleId ? { incomingBaleId } : {}),
      },
      select: { id: true },
    });
    if (existingOpen) {
      throw new ConflictException('An OPEN sort session already exists for this source');
    }

    const session = await this.prisma.sortSession.create({
      data: {
        tenantId,
        ragId: ragId || null,
        incomingBaleId: incomingBaleId || null,
        workerId,
        supervisorId,
        totalInputWeight: inputWeight,
        totalOutputWeight: new Decimal(0),
        wasteWeight: new Decimal(0),
        status: SortStatus.OPEN,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'SORT_SESSION_CREATED',
      entityType: 'SortSession',
      entityId: session.id,
      metadataJson: {
        ragId,
        incomingBaleId,
        workerId,
        supervisorId,
        totalInputWeight: inputWeight.toString(),
      },
    });

    return session;
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
   * - create immutable CategoryOutput records (Level-2 allocation)
   * - lock session (CLOSED)
   */
  async close(tenantId: string, sessionId: string, currentUserId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.sortSession.findFirst({
        where: { id: sessionId, tenantId },
        include: {
          rag: { select: { allocatedCost: true } },
          incomingBale: { select: { cost: true } },
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

      const wasteWeight = session.totalInputWeight.sub(totalOutputWeight);

      const yieldPercent = session.totalInputWeight.equals(new Decimal(0))
        ? new Decimal(0)
        : totalOutputWeight.div(session.totalInputWeight).mul(new Decimal(100));

      const sourceCost = session.rag?.allocatedCost ?? session.incomingBale?.cost ?? new Decimal(0);

      const outputs = [];
      for (const bucket of buckets) {
        if (bucket.outputWeightKg.equals(new Decimal(0)) && bucket.outputCount === 0) continue;
        const allocatedCost = bucket.outputWeightKg.div(totalOutputWeight).mul(sourceCost);

        outputs.push(
          await tx.categoryOutput.create({
            data: {
              tenantId,
              sortCategoryBucketId: bucket.id,
              categoryId: bucket.categoryId,
              weightKg: bucket.outputWeightKg,
              count: bucket.outputCount,
              allocatedCost,
            },
          }),
        );
      }

      const updatedSession = await tx.sortSession.update({
        where: { id: sessionId },
        data: {
          status: SortStatus.CLOSED,
          endTime: new Date(),
          totalOutputWeight,
          wasteWeight,
        },
      });

      return { session: updatedSession, outputs, yieldPercent: yieldPercent.toNumber() };
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
        wasteWeight: result.session.wasteWeight?.toString(),
      },
    });

    return result;
  }

  private async getInputWeight(
    tenantId: string,
    ids: { ragId?: string; incomingBaleId?: string },
  ): Promise<Decimal> {
    if (ids.ragId) {
      const rag = await this.prisma.rag.findFirst({
        where: { id: ids.ragId, tenantId },
        select: { weightKg: true },
      });
      if (!rag) throw new BadRequestException('Source not found: ragId');
      return rag.weightKg;
    }
    if (ids.incomingBaleId) {
      const bale = await this.prisma.incomingBale.findFirst({
        where: { id: ids.incomingBaleId, tenantId },
        select: { weightKg: true },
      });
      if (!bale) throw new BadRequestException('Source not found: incomingBaleId');
      return bale.weightKg;
    }
    throw new BadRequestException('Missing source');
  }
}


