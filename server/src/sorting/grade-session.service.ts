import { costPerKg } from '../costing/costing';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GradeStatus, GradingOutputStatus, MeasurementType, SortStatus, WasteStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../audit/audit.service';
import { outputCosts } from '../costing/costing';
import { PrismaService } from '../prisma/prisma.service';
import { AddGradeKgDto, PageQueryDto, StartGradingDto } from './sorting.dto';
import { SortingWasteService } from './sorting-waste.service';

const ZERO = new Decimal(0);

/** Stage 2: grade a sorted category output (A / B / C / Cream ...). */
@Injectable()
export class GradeSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly waste: SortingWasteService,
  ) {}

  /** Category outputs from closed lots that are not graded yet (in-progress first). */
  async queue(tenantId: string, query: PageQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      tenantId,
      sortCategoryBucket: { is: { sortSession: { is: { status: SortStatus.CLOSED } } } },
      usedKg: 0,
      gradeId: null, // graded while sorting (v2 6.6)
      OR: [{ gradeSessions: { none: {} } }, { gradeSessions: { some: { status: GradeStatus.OPEN } } }],
    };
    const [rows, total] = await Promise.all([
      this.prisma.categoryOutput.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          container: { select: { id: true, containerNumber: true } },
          rag: { select: { id: true, ragCode: true } },
          gradeSessions: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          sortCategoryBucket: {
            include: {
              sortSession: { select: { id: true, status: true, startTime: true, endTime: true, worker: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      this.prisma.categoryOutput.count({ where }),
    ]);
    const data = rows
      .map((row) => ({ ...row, gradeStatus: row.gradeSessions.length ? 'IN_PROGRESS' : 'NOT_STARTED' }))
      .sort((a, b) => Number(b.gradeStatus === 'IN_PROGRESS') - Number(a.gradeStatus === 'IN_PROGRESS'));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * One sorted entry for the grading screen (v2): its name, kg, lot, open grading if any, and whether it can be
   * graded — and if not, why (graded while sorting, already in bales, already graded). A lot still being sorted
   * can be graded already.
   */
  async output(tenantId: string, id: string) {
    const o = await this.prisma.categoryOutput.findFirst({
      where: { id, tenantId },
      select: {
        id: true, weightKg: true, usedKg: true, gradeId: true,
        category: { select: { id: true, name: true } },
        grade: { select: { name: true } },
        rag: { select: { id: true, ragCode: true } },
        gradeSessions: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!o) throw new NotFoundException('Sorted output not found');
    const last = o.gradeSessions[0] ?? null;
    const blocked = o.gradeId ? 'GRADED_WHILE_SORTING' : last?.status === GradeStatus.CLOSED ? 'ALREADY_GRADED' : o.usedKg.greaterThan(ZERO) ? 'IN_BALES' : null;
    return {
      id: o.id, weightKg: o.weightKg, category: o.category, grade: o.grade?.name ?? null, lot: o.rag ? { id: o.rag.id, code: o.rag.ragCode } : null,
      gradeSession: last, canGrade: !blocked, blocked,
    };
  }

  /** Starts grading, or resumes the open grading for the same output. */
  async start(tenantId: string, dto: StartGradingDto, userId: string) {
    const output = await this.prisma.categoryOutput.findFirst({
      where: { id: dto.categoryOutputId, tenantId },
      select: { id: true, weightKg: true, allocatedCost: true, usedKg: true, gradeId: true },
    });
    if (!output) throw new BadRequestException('Sorted output not found');
    if (output.gradeId) throw new ConflictException('This output was graded while sorting');
    if (output.usedKg.greaterThan(ZERO)) {
      throw new ConflictException('Part of this output is already in bales, so it cannot be graded');
    }

    const existing = await this.prisma.gradeSession.findFirst({
      where: { tenantId, categoryOutputId: output.id },
      select: { id: true, status: true },
    });
    if (existing?.status === GradeStatus.CLOSED) throw new ConflictException('This output is already graded');
    if (existing) return this.summary(tenantId, existing.id);

    const session = await this.prisma.gradeSession.create({
      data: {
        tenantId,
        categoryOutputId: output.id,
        workerId: dto.workerId || userId,
        supervisorId: dto.supervisorId || userId,
        status: GradeStatus.OPEN,
      },
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'GRADE_SESSION_CREATED',
      entityType: 'GradeSession',
      entityId: session.id,
      metadataJson: { categoryOutputId: output.id, inputWeightKg: output.weightKg.toString() },
    });
    return this.summary(tenantId, session.id);
  }

  async summary(tenantId: string, sessionId: string) {
    const session = await this.prisma.gradeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        categoryOutput: {
          select: {
            id: true,
            weightKg: true,
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
      },
    });
    if (!session) throw new BadRequestException('Grade session not found');
    const [buckets, wasteLineItems] = await Promise.all([
      this.prisma.gradeBucket.findMany({
        where: { gradeSessionId: sessionId },
        orderBy: { updatedAt: 'desc' },
        include: { grade: { select: { id: true, name: true } } },
      }),
      this.waste.listLines(tenantId, WasteStage.STAGE_2, sessionId),
    ]);
    const inputKg = session.categoryOutput.weightKg;
    const outputKg = buckets.reduce((sum, b) => sum.add(b.outputWeightKg), ZERO);
    const wasteWeight = inputKg.sub(outputKg);
    const declaredWasteAmount = wasteLineItems.reduce((sum, line) => sum.add(line.amount), ZERO);
    return {
      session: {
        id: session.id,
        status: session.status,
        categoryOutputId: session.categoryOutputId,
        categoryOutput: session.categoryOutput,
        totalGradeOutputWeight: outputKg.toString(),
        wasteWeight: wasteWeight.toString(),
        declaredWasteAmount: declaredWasteAmount.toString(),
        remainingWasteAmount: wasteWeight.sub(declaredWasteAmount).toString(),
        gradeYieldPercent: inputKg.equals(ZERO) ? 0 : outputKg.div(inputKg).mul(100).toNumber(),
      },
      buckets,
      wasteLineItems,
      // After closing: each grade with its share of the cost (what the phone shows as the result).
      outputs: session.status === GradeStatus.CLOSED ? await this.closedOutputs(tenantId, sessionId) : [],
    };
  }

  private async closedOutputs(tenantId: string, sessionId: string) {
    const rows = await this.prisma.gradeOutput.findMany({
      where: { tenantId, gradeBucket: { gradeSessionId: sessionId } },
      select: { id: true, weightKg: true, allocatedCost: true, grade: { select: { id: true, name: true } } },
      orderBy: { grade: { rank: 'asc' } },
    });
    return rows.map((o) => ({ id: o.id, name: o.grade.name, gradeId: o.grade.id, weightKg: o.weightKg.toString(), cost: o.allocatedCost.toString(), costPerKg: costPerKg(o.allocatedCost, o.weightKg).toString() }));
  }

  /** Undo: takes kg back off a grade (never below zero) while grading is open. */
  async removeKg(tenantId: string, dto: AddGradeKgDto, userId: string) {
    const kg = new Decimal(dto.amountKg);
    await this.prisma.$transaction(async (tx) => {
      await this.waste.capacity(tx, tenantId, WasteStage.STAGE_2, dto.sessionId);
      const taken = await tx.gradeBucket.updateMany({
        where: { gradeSessionId: dto.sessionId, gradeId: dto.gradeId, outputWeightKg: { gte: kg } },
        data: { outputWeightKg: { decrement: kg } },
      });
      if (!taken.count) throw new BadRequestException('That is more than was recorded for this grade');
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'GRADE_OUTPUT_REMOVED',
      entityType: 'GradeSession',
      entityId: dto.sessionId,
      metadataJson: { gradeId: dto.gradeId, amountKg: kg.toString() },
    });
    return this.summary(tenantId, dto.sessionId);
  }

  async addKg(tenantId: string, dto: AddGradeKgDto, userId: string) {
    const kg = new Decimal(dto.amountKg);
    await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.capacity(tx, tenantId, WasteStage.STAGE_2, dto.sessionId);
      this.waste.assertFits(capacity, kg);
      const grade = await tx.grade.findFirst({ where: { id: dto.gradeId, tenantId, isActive: true }, select: { id: true } });
      if (!grade) throw new BadRequestException('Invalid grade');
      await tx.gradeBucket.upsert({
        where: { gradeSessionId_gradeId: { gradeSessionId: dto.sessionId, gradeId: grade.id } },
        create: { gradeSessionId: dto.sessionId, gradeId: grade.id, outputWeightKg: kg, outputCount: dto.outputCount ?? 0 },
        update: { outputWeightKg: { increment: kg }, outputCount: { increment: dto.outputCount ?? 0 } },
      });
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'GRADE_OUTPUT_ADDED',
      entityType: 'GradeSession',
      entityId: dto.sessionId,
      metadataJson: { gradeId: dto.gradeId, amountKg: kg.toString(), outputCount: dto.outputCount ?? 0 },
    });
    return this.summary(tenantId, dto.sessionId);
  }

  /** Closes grading: books any remainder as waste and creates grade outputs ready for bales. */
  async close(tenantId: string, sessionId: string, userId: string, wasteCategoryId?: string) {
    const outputsCreated = await this.prisma.$transaction(async (tx) => {
      const capacity = await this.waste.bookRemainder(tx, tenantId, WasteStage.STAGE_2, sessionId, wasteCategoryId);
      if (capacity.outputKg.equals(ZERO)) {
        throw new BadRequestException('Record at least one grade before closing');
      }
      const session = await tx.gradeSession.findFirstOrThrow({
        where: { id: sessionId, tenantId },
        include: {
          categoryOutput: { select: { allocatedCost: true } },
          gradeBuckets: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      });
      const buckets = session.gradeBuckets.filter((b) => b.outputWeightKg.greaterThan(ZERO));
      const costs = outputCosts(session.categoryOutput.allocatedCost, buckets.map((b) => ({ key: b.id, kg: b.outputWeightKg })));
      let created = 0;
      for (const bucket of buckets) {
        await tx.gradeOutput.create({
          data: {
            tenantId,
            gradeBucketId: bucket.id,
            gradeId: bucket.gradeId,
            weightKg: bucket.outputWeightKg,
            count: bucket.outputCount,
            allocatedCost: costs.find((c) => c.key === bucket.id)!.amount,
            totalAmount: bucket.outputWeightKg,
            usedAmount: ZERO,
            remainingAmount: bucket.outputWeightKg,
            measurementType: MeasurementType.WEIGHT,
            status: GradingOutputStatus.READY_FOR_REPACK,
          },
        });
        created += 1;
      }
      await tx.gradeSession.update({ where: { id: sessionId }, data: { status: GradeStatus.CLOSED, endTime: new Date() } });
      return created;
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'GRADE_SESSION_CLOSED',
      entityType: 'GradeSession',
      entityId: sessionId,
      metadataJson: { outputsCreated },
    });
    return this.summary(tenantId, sessionId);
  }
}
