import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GradeStatus, WasteStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeSessionDto, UpdateGradeSessionDto } from './dto';

@Injectable()
export class GradeSessionService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, dto: CreateGradeSessionDto, currentUserId: string) {
    const workerId = dto.workerId || currentUserId;
    const supervisorId = dto.supervisorId || currentUserId;

    const categoryOutput = await this.prisma.categoryOutput.findFirst({
      where: { id: dto.categoryOutputId, tenantId },
      select: { id: true, weightKg: true, count: true, allocatedCost: true },
    });
    if (!categoryOutput) {
      throw new BadRequestException('CategoryOutput not found');
    }

    // Check if any grade session exists for this CategoryOutput
    const existing = await this.prisma.gradeSession.findFirst({
      where: { tenantId, categoryOutputId: dto.categoryOutputId },
      select: { id: true, status: true },
    });
    
    // If session exists and is OPEN, return it (resume behavior)
    if (existing && existing.status === GradeStatus.OPEN) {
      return this.prisma.gradeSession.findFirst({
        where: { id: existing.id },
      });
    }
    
    // If session exists and is CLOSED, block (already fully graded)
    if (existing && existing.status === GradeStatus.CLOSED) {
      throw new ConflictException('CategoryOutput already fully graded');
    }

    const session = await this.prisma.gradeSession.create({
      data: {
        tenantId,
        categoryOutputId: dto.categoryOutputId,
        workerId,
        supervisorId,
        status: GradeStatus.OPEN,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'GRADE_SESSION_CREATED',
      entityType: 'GradeSession',
      entityId: session.id,
      metadataJson: {
        categoryOutputId: dto.categoryOutputId,
        inputWeightKg: categoryOutput.weightKg.toString(),
        inputCount: categoryOutput.count,
        sourceCost: categoryOutput.allocatedCost.toString(),
        workerId,
        supervisorId,
      },
    });

    return session;
  }

  async findAll(tenantId: string, options?: { status?: GradeStatus; page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(options?.status && { status: options.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.gradeSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          categoryOutput: {
            select: {
              id: true,
              weightKg: true,
              count: true,
              allocatedCost: true,
              categoryId: true,
              containerId: true,
              ragId: true,
              sortSessionId: true,
              category: { select: { id: true, name: true } },
              container: { select: { id: true, containerNumber: true } },
              rag: { select: { id: true, ragCode: true } },
            },
          },
          worker: { select: { id: true, name: true, email: true } },
          supervisor: { select: { id: true, name: true, email: true } },
          _count: { select: { gradeBuckets: true } },
        },
      }),
      this.prisma.gradeSession.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const session = await this.prisma.gradeSession.findFirst({
      where: { id, tenantId },
      include: {
        categoryOutput: {
          include: {
            category: { select: { id: true, name: true } },
            container: { select: { id: true, containerNumber: true } },
            rag: { select: { id: true, ragCode: true } },
          },
        },
        worker: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
        gradeBuckets: {
          orderBy: { updatedAt: 'desc' },
          include: {
            grade: { select: { id: true, name: true } },
            gradeOutputs: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Grade session not found');

    const inputWeight = session.categoryOutput.weightKg;
    const totalGradeOutputWeight = session.gradeBuckets.reduce((sum, b) => sum.add(b.outputWeightKg), new Decimal(0));
    const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
    const gradeYieldPercent = inputWeight.equals(new Decimal(0))
      ? new Decimal(0)
      : totalGradeOutputWeight.div(inputWeight).mul(new Decimal(100));

    return {
      ...session,
      totalGradeOutputWeight: totalGradeOutputWeight.toString(),
      wasteWeight: wasteWeight.toString(),
      gradeYieldPercent: gradeYieldPercent.toNumber(),
    };
  }

  async update(tenantId: string, id: string, dto: UpdateGradeSessionDto, currentUserId: string) {
    const session = await this.prisma.gradeSession.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('Grade session not found');
    if (session.status !== GradeStatus.OPEN) throw new ConflictException('Cannot update a CLOSED grade session');

    const { reason, ...changes } = dto;
    if ((changes.workerId || changes.supervisorId) && !reason?.trim()) {
      throw new BadRequestException('A reason is required when reassigning a grading session');
    }

    const updated = await this.prisma.gradeSession.update({
      where: { id },
      data: changes,
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'GRADE_SESSION_UPDATED',
      entityType: 'GradeSession',
      entityId: id,
      metadataJson: { changes, reason: reason?.trim() || null },
    });

    return updated;
  }

  /**
   * Close a grade session:
   * - validate buckets exist and totalGradeOutputWeight > 0
   * - compute waste + yield (must be non-negative waste)
   * - create immutable GradeOutput records (Level-3 cost allocation)
   * - lock session (CLOSED) and mark CategoryOutput graded logically (via session existence)
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
      const session = await tx.gradeSession.findFirst({
        where: { id: sessionId, tenantId },
        include: {
          categoryOutput: { select: { id: true, weightKg: true, count: true, allocatedCost: true, containerId: true, ragId: true } },
          gradeBuckets: true,
        },
      });
      if (!session) throw new NotFoundException('Grade session not found');
      if (session.status !== GradeStatus.OPEN) throw new ConflictException('Cannot close session twice');

      if (!session.gradeBuckets || session.gradeBuckets.length === 0) {
        throw new BadRequestException('At least one grade bucket is required to close');
      }

      const inputWeight = session.categoryOutput.weightKg;
      const sourceCost = session.categoryOutput.allocatedCost;

      const totalGradeOutputWeight = session.gradeBuckets.reduce((sum, b) => sum.add(b.outputWeightKg), new Decimal(0));
      if (totalGradeOutputWeight.equals(new Decimal(0))) {
        throw new BadRequestException('totalGradeOutputWeight must be > 0 to close');
      }

      const wasteWeight = inputWeight.sub(totalGradeOutputWeight);
      if (wasteWeight.lessThan(new Decimal(0))) {
        throw new BadRequestException('wasteWeight cannot be negative (output exceeds input)');
      }

      const existingWasteAgg = await tx.wasteLineItem.aggregate({
        where: { tenantId, stage: WasteStage.STAGE_2, gradeSessionId: sessionId },
        _sum: { amount: true },
      });
      const declaredWasteAmount = existingWasteAgg._sum.amount || new Decimal(0);

      if (declaredWasteAmount.greaterThan(wasteWeight)) {
        throw new BadRequestException('Declared waste exceeds computed waste');
      }

      const remainingWasteAmount = wasteWeight.sub(declaredWasteAmount);
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

        await tx.wasteLineItem.create({
          data: {
            tenantId,
            stage: WasteStage.STAGE_2,
            wasteCategoryId: category.id,
            amount: remainingWasteAmount,
            unitType: category.unitType,
            estimatedValue: remainingWasteAmount.mul(category.defaultResalePrice),
            gradeSessionId: sessionId,
            containerId: session.categoryOutput.containerId ?? null,
            ragId: session.categoryOutput.ragId ?? null,
            categoryOutputId: session.categoryOutput.id,
          },
        });
      }

      const gradeYieldPercent = inputWeight.equals(new Decimal(0))
        ? new Decimal(0)
        : totalGradeOutputWeight.div(inputWeight).mul(new Decimal(100));

      // Level-3 allocation: gradeAllocatedCost = (gradeBucketWeight / totalGradeOutputWeight) × sourceCost
      const outputs = [];
      for (const bucket of session.gradeBuckets) {
        if (bucket.outputWeightKg.equals(new Decimal(0)) && bucket.outputCount === 0) continue;
        const allocatedCost = bucket.outputWeightKg.div(totalGradeOutputWeight).mul(sourceCost);
        outputs.push(
          await tx.gradeOutput.create({
            data: {
              tenantId,
              gradeBucketId: bucket.id,
              gradeId: bucket.gradeId,
              weightKg: bucket.outputWeightKg,
              count: bucket.outputCount,
              allocatedCost,
              totalAmount: bucket.outputWeightKg, // Initialize with output weight
              usedAmount: new Decimal(0), // No allocation yet
              remainingAmount: bucket.outputWeightKg, // All available initially
              measurementType: 'WEIGHT', // Default to weight-based
              status: 'READY_FOR_REPACK', // FIX-2: Explicit ready state for repack
            },
          }),
        );
      }

      const closed = await tx.gradeSession.update({
        where: { id: sessionId },
        data: {
          status: GradeStatus.CLOSED,
          endTime: new Date(),
        },
      });

      return {
        session: closed,
        outputs,
        wasteWeight: wasteWeight.toString(),
        gradeYieldPercent: gradeYieldPercent.toNumber(),
      };
    });

    await this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: 'GRADE_SESSION_CLOSED',
      entityType: 'GradeSession',
      entityId: sessionId,
      metadataJson: {
        outputsCreated: result.outputs.length,
        wasteWeight: result.wasteWeight,
        gradeYieldPercent: result.gradeYieldPercent,
      },
    });

    return result;
  }
}

