import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { costPerKg, landedCost, lotCosts, money, outputCosts, sum, takeCost } from './costing';

type Tx = Prisma.TransactionClient;

/** A bale whose cost changed after part of it was sold. */
export interface CostAdjustment {
  repackUnitId: string;
  previousCost: Decimal;
  newCost: Decimal;
}

/**
 * Applies the costing rules (./costing.ts) to stored data, top-down:
 * container → lots → category outputs → grade outputs → bale inputs → bales → stock items.
 * Sorting and baling use the same rules when they create rows, so recalculating unchanged data
 * reproduces the stored costs exactly. Sold lines keep their cost; a changed bale cost after a sale
 * is reported as a cost adjustment (AuditLog COST_ADJUSTMENT).
 */
@Injectable()
export class CostingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recalculates a container's whole chain in one transaction. */
  async recalculateContainer(tenantId: string, containerId: string, userId?: string) {
    return this.prisma.$transaction((tx) => this.recalculateContainerTx(tx, tenantId, containerId, userId));
  }

  async recalculateContainerTx(tx: Tx, tenantId: string, containerId: string, userId?: string) {
    const container = await tx.container.findFirst({
      where: { id: containerId, tenantId },
      include: { containerCharges: true, rags: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!container) throw new NotFoundException('Container not found');

    const landed = landedCost({
      purchaseCost: container.purchaseCost,
      purchaseCurrency: container.purchaseCurrency,
      fxRate: container.fxRate,
      charges: container.containerCharges.map((c) => c.amount),
    });
    const lotKg = sum(container.rags.map((r) => r.weightKg));
    await tx.container.update({
      where: { id: container.id },
      data: { landedCostPKR: landed, landedCostPerKg: costPerKg(landed, lotKg.isZero() ? container.netWeight : lotKg) },
    });

    const adjustments: CostAdjustment[] = [];
    if (container.rags.length) {
      if (lotKg.isZero()) throw new BadRequestException('Lots in this container have no weight');
      for (const lot of lotCosts(landed, container.rags.map((r) => ({ key: r.id, weightKg: r.weightKg })))) {
        adjustments.push(...(await this.recalculateLotTx(tx, tenantId, lot.key, lot.amount)));
      }
    }
    await this.logAdjustments(tx, tenantId, adjustments, userId);
    if (container.purchaseOrderId) await this.syncPurchaseOrderTotalTx(tx, container.purchaseOrderId);
    return { landedCostPKR: landed, adjustments };
  }

  /** A loose lot's cost is its purchase price; recalculates everything made from it. */
  async recalculateLooseLot(tenantId: string, ragId: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.rag.findFirst({ where: { id: ragId, tenantId }, select: { purchaseCost: true, containerId: true } });
      if (!lot) throw new NotFoundException('Lot not found');
      if (lot.containerId) return this.recalculateContainerTx(tx, tenantId, lot.containerId, userId);
      const adjustments = await this.recalculateLotTx(tx, tenantId, ragId, money(lot.purchaseCost ?? 0));
      await this.logAdjustments(tx, tenantId, adjustments, userId);
      return { adjustments };
    });
  }

  private async recalculateLotTx(tx: Tx, tenantId: string, ragId: string, lotCost: Decimal): Promise<CostAdjustment[]> {
    await tx.rag.update({ where: { id: ragId }, data: { allocatedCost: lotCost } });
    const outputs = await tx.categoryOutput.findMany({
      where: { tenantId, ragId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, weightKg: true },
    });
    if (!outputs.length) return [];
    const adjustments: CostAdjustment[] = [];
    for (const share of outputCosts(lotCost, outputs.map((o) => ({ key: o.id, kg: o.weightKg })))) {
      const output = outputs.find((o) => o.id === share.key)!;
      await tx.categoryOutput.update({ where: { id: output.id }, data: { allocatedCost: share.amount } });
      adjustments.push(...(await this.recalculateCategoryOutputTx(tx, tenantId, output.id, share.amount, output.weightKg)));
    }
    return adjustments;
  }

  private async recalculateCategoryOutputTx(
    tx: Tx,
    tenantId: string,
    categoryOutputId: string,
    cost: Decimal,
    kg: Decimal,
  ): Promise<CostAdjustment[]> {
    const units = new Set<string>();
    // Stage 2: grades share the category output's cost by kg.
    const grades = await tx.gradeOutput.findMany({
      where: { tenantId, gradeBucket: { gradeSession: { categoryOutputId } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, weightKg: true },
    });
    if (grades.length) {
      for (const share of outputCosts(cost, grades.map((g) => ({ key: g.id, kg: g.weightKg })))) {
        const grade = grades.find((g) => g.id === share.key)!;
        await tx.gradeOutput.update({ where: { id: grade.id }, data: { allocatedCost: share.amount } });
        await this.recalculateTakesTx(tx, { gradingOutputId: grade.id }, share.amount, grade.weightKg, units);
      }
    }
    // One-stage sorting: bales taken straight from the category output.
    await this.recalculateTakesTx(tx, { categoryOutputId }, cost, kg, units);
    return this.recalculateBalesTx(tx, [...units]);
  }

  /** Re-costs every bale input taken from one source, in the order they were taken. */
  private async recalculateTakesTx(
    tx: Tx,
    source: { gradingOutputId: string } | { categoryOutputId: string },
    cost: Decimal,
    kg: Decimal,
    units: Set<string>,
  ) {
    const takes = await tx.repackInputAllocation.findMany({
      where: source,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, amountUsed: true, allocatedCost: true, repackUnitId: true },
    });
    let used = new Decimal(0);
    for (const take of takes) {
      const takeCostNow = takeCost({ cost, kg }, used, take.amountUsed);
      used = used.add(take.amountUsed);
      if (!takeCostNow.equals(take.allocatedCost)) {
        await tx.repackInputAllocation.update({ where: { id: take.id }, data: { allocatedCost: takeCostNow } });
      }
      units.add(take.repackUnitId);
    }
  }

  private async recalculateBalesTx(tx: Tx, unitIds: string[]): Promise<CostAdjustment[]> {
    const adjustments: CostAdjustment[] = [];
    for (const unitId of unitIds) {
      const unit = await tx.repackUnit.findUniqueOrThrow({
        where: { id: unitId },
        select: {
          totalCost: true,
          weightKg: true,
          inputAllocations: { select: { allocatedCost: true } },
          inventoryItems: { select: { id: true, _count: { select: { saleLines: true } } } },
        },
      });
      const total = money(sum(unit.inputAllocations.map((a) => a.allocatedCost)));
      if (total.equals(unit.totalCost)) continue;
      await tx.repackUnit.update({ where: { id: unitId }, data: { totalCost: total } });
      await tx.inventoryItem.updateMany({
        where: { repackUnitId: unitId },
        data: { avgCost: money(costPerKg(total, unit.weightKg)) },
      });
      if (unit.inventoryItems.some((i) => i._count.saleLines > 0)) {
        adjustments.push({ repackUnitId: unitId, previousCost: unit.totalCost, newCost: total });
      }
    }
    return adjustments;
  }

  private async logAdjustments(tx: Tx, tenantId: string, adjustments: CostAdjustment[], userId?: string) {
    for (const a of adjustments) {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? null,
          action: 'COST_ADJUSTMENT',
          entityType: 'RepackUnit',
          entityId: a.repackUnitId,
          metadataJson: {
            previousCost: a.previousCost.toFixed(2),
            newCost: a.newCost.toFixed(2),
            difference: a.newCost.sub(a.previousCost).toFixed(2),
          },
        },
      });
    }
  }

  /** A purchase order's total is the landed cost of its containers. */
  private async syncPurchaseOrderTotalTx(tx: Tx, purchaseOrderId: string) {
    const totals = await tx.container.aggregate({ where: { purchaseOrderId }, _sum: { landedCostPKR: true } });
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { totalCost: totals._sum.landedCostPKR ?? 0 } });
  }

  /** Landed cost, charges and each lot's share, for the container screen. */
  async containerBreakdown(tenantId: string, containerId: string) {
    const container = await this.prisma.container.findFirst({
      where: { id: containerId, tenantId },
      include: {
        containerCharges: { orderBy: { createdAt: 'asc' } },
        rags: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, ragCode: true, weightKg: true, allocatedCost: true } },
      },
    });
    if (!container) throw new NotFoundException('Container not found');
    const lotKg = sum(container.rags.map((r) => r.weightKg));
    return {
      containerId: container.id,
      containerNumber: container.containerNumber,
      currency: 'PKR',
      purchaseCost: container.purchaseCost,
      purchaseCurrency: container.purchaseCurrency,
      fxRate: container.fxRate,
      totalCost: container.landedCostPKR,
      totalWeight: lotKg.isZero() ? container.netWeight : lotKg,
      costPerKg: container.landedCostPerKg,
      charges: container.containerCharges,
      rags: container.rags.map((r) => ({ id: r.id, code: r.ragCode, weightKg: r.weightKg, allocatedCost: r.allocatedCost })),
    };
  }
}
