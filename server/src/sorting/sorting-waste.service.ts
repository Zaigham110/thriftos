import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GradeStatus, Prisma, SortStatus, WasteStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** What a sorting session can still take: input kg minus kg already in outputs and declared waste. */
export interface SessionCapacity {
  sessionId: string;
  inputKg: Decimal;
  outputKg: Decimal;
  declaredWasteKg: Decimal;
  remainingKg: Decimal;
  trace: { containerId: string | null; ragId: string | null; categoryOutputId: string | null };
}

const ZERO = new Decimal(0);

/**
 * Waste lines for both sorting stages. Every write checks, in the same transaction,
 * that outputs + declared waste never exceed the session's input weight.
 */
@Injectable()
export class SortingWasteService {
  constructor(private readonly prisma: PrismaService) {}

  async capacity(tx: Tx, tenantId: string, stage: WasteStage, sessionId: string): Promise<SessionCapacity> {
    const declared = await tx.wasteLineItem.aggregate({
      where: { tenantId, stage, ...(stage === WasteStage.STAGE_1 ? { sortSessionId: sessionId } : { gradeSessionId: sessionId }) },
      _sum: { amount: true },
    });
    const declaredWasteKg = declared._sum.amount ?? ZERO;

    if (stage === WasteStage.STAGE_1) {
      const session = await tx.sortSession.findFirst({
        where: { id: sessionId, tenantId },
        select: {
          id: true,
          status: true,
          ragId: true,
          totalInputWeight: true,
          rag: { select: { containerId: true } },
        },
      });
      if (!session) throw new NotFoundException('Sort session not found');
      if (session.status !== SortStatus.OPEN) throw new ConflictException('This lot is already closed');
      const outputs = await tx.sortCategoryBucket.aggregate({
        where: { sortSessionId: sessionId },
        _sum: { outputWeightKg: true },
      });
      const outputKg = outputs._sum.outputWeightKg ?? ZERO;
      return {
        sessionId,
        inputKg: session.totalInputWeight,
        outputKg,
        declaredWasteKg,
        remainingKg: session.totalInputWeight.sub(outputKg).sub(declaredWasteKg),
        trace: {
          containerId: session.rag.containerId,
          ragId: session.ragId,
          categoryOutputId: null,
        },
      };
    }

    const session = await tx.gradeSession.findFirst({
      where: { id: sessionId, tenantId },
      select: {
        id: true,
        status: true,
        categoryOutput: { select: { id: true, weightKg: true, containerId: true, ragId: true } },
      },
    });
    if (!session) throw new NotFoundException('Grade session not found');
    if (session.status !== GradeStatus.OPEN) throw new ConflictException('This grading is already closed');
    const outputs = await tx.gradeBucket.aggregate({
      where: { gradeSessionId: sessionId },
      _sum: { outputWeightKg: true },
    });
    const outputKg = outputs._sum.outputWeightKg ?? ZERO;
    const inputKg = session.categoryOutput.weightKg;
    return {
      sessionId,
      inputKg,
      outputKg,
      declaredWasteKg,
      remainingKg: inputKg.sub(outputKg).sub(declaredWasteKg),
      trace: {
        containerId: session.categoryOutput.containerId,
        ragId: session.categoryOutput.ragId,
        categoryOutputId: session.categoryOutput.id,
      },
    };
  }

  /** Throws a plain-language error when `kg` does not fit in what is left of the session. */
  assertFits(capacity: SessionCapacity, kg: Decimal): void {
    if (kg.greaterThan(capacity.remainingKg)) {
      const left = capacity.remainingKg.lessThan(ZERO) ? ZERO : capacity.remainingKg;
      throw new BadRequestException(
        `Weight is more than what is left (${left.toFixed(2)} kg). Enter ${left.toFixed(2)} or less.`,
      );
    }
  }

  async add(tenantId: string, stage: WasteStage, sessionId: string, wasteCategoryId: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const capacity = await this.capacity(tx, tenantId, stage, sessionId);
      const kg = new Decimal(amount);
      this.assertFits(capacity, kg);
      return this.createLine(tx, tenantId, stage, capacity, wasteCategoryId, kg);
    });
  }

  async update(tenantId: string, stage: WasteStage, lineId: string, wasteCategoryId: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const line = await this.findOpenLine(tx, tenantId, stage, lineId);
      const capacity = await this.capacity(tx, tenantId, stage, line.sessionId);
      const kg = new Decimal(amount);
      // The line being edited frees up its own amount.
      this.assertFits({ ...capacity, remainingKg: capacity.remainingKg.add(line.amount) }, kg);
      const category = await this.activeCategory(tx, tenantId, wasteCategoryId);
      await tx.wasteLineItem.update({
        where: { id: line.id },
        data: {
          wasteCategoryId: category.id,
          amount: kg,
          unitType: category.unitType,
          estimatedValue: kg.mul(category.defaultResalePrice),
        },
      });
      return line.sessionId;
    });
  }

  async remove(tenantId: string, stage: WasteStage, lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const line = await this.findOpenLine(tx, tenantId, stage, lineId);
      await this.capacity(tx, tenantId, stage, line.sessionId); // asserts the session is still open
      await tx.wasteLineItem.delete({ where: { id: line.id } });
      return line.sessionId;
    });
  }

  /** Books whatever is left of the session as waste (used when closing with a remainder). */
  async bookRemainder(tx: Tx, tenantId: string, stage: WasteStage, sessionId: string, wasteCategoryId?: string) {
    const capacity = await this.capacity(tx, tenantId, stage, sessionId);
    if (capacity.remainingKg.lessThan(ZERO)) {
      throw new BadRequestException('Outputs and waste are more than the input weight');
    }
    if (capacity.remainingKg.equals(ZERO)) return capacity;
    if (!wasteCategoryId) {
      throw new BadRequestException(
        `${capacity.remainingKg.toFixed(2)} kg is not recorded yet. Pick a waste type to close.`,
      );
    }
    await this.createLine(tx, tenantId, stage, capacity, wasteCategoryId, capacity.remainingKg);
    return capacity;
  }

  async listLines(tenantId: string, stage: WasteStage, sessionId: string) {
    return this.prisma.wasteLineItem.findMany({
      where: { tenantId, stage, ...(stage === WasteStage.STAGE_1 ? { sortSessionId: sessionId } : { gradeSessionId: sessionId }) },
      orderBy: { updatedAt: 'desc' },
      include: { wasteCategory: true },
    });
  }

  private async createLine(tx: Tx, tenantId: string, stage: WasteStage, capacity: SessionCapacity, wasteCategoryId: string, kg: Decimal) {
    const category = await this.activeCategory(tx, tenantId, wasteCategoryId);
    return tx.wasteLineItem.create({
      data: {
        tenantId,
        stage,
        wasteCategoryId: category.id,
        amount: kg,
        unitType: category.unitType,
        estimatedValue: kg.mul(category.defaultResalePrice),
        sortSessionId: stage === WasteStage.STAGE_1 ? capacity.sessionId : null,
        gradeSessionId: stage === WasteStage.STAGE_2 ? capacity.sessionId : null,
        containerId: capacity.trace.containerId,
        ragId: capacity.trace.ragId,
        categoryOutputId: capacity.trace.categoryOutputId,
      },
    });
  }

  private async activeCategory(tx: Tx, tenantId: string, wasteCategoryId: string) {
    const category = await tx.wasteCategory.findFirst({ where: { id: wasteCategoryId, tenantId, isActive: true } });
    if (!category) throw new BadRequestException('Invalid waste category');
    return category;
  }

  private async findOpenLine(tx: Tx, tenantId: string, stage: WasteStage, lineId: string) {
    const line = await tx.wasteLineItem.findFirst({
      where: { id: lineId, tenantId, stage },
      select: { id: true, amount: true, sortSessionId: true, gradeSessionId: true },
    });
    const sessionId = stage === WasteStage.STAGE_1 ? line?.sortSessionId : line?.gradeSessionId;
    if (!line || !sessionId) throw new NotFoundException('Waste line not found');
    return { id: line.id, amount: line.amount, sessionId };
  }
}
