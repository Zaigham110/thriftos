import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SortStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { costPerKg, landedCost, lotCosts, money, openLotCost, outputCosts, sum, takeCost } from './costing';

type Tx = Prisma.TransactionClient;

/** A bale whose cost changed after it was sold. */
export interface CostAdjustment {
  repackUnitId: string;
  previousCost: Decimal;
  newCost: Decimal;
}

/** What a recalculation changed (rows whose stored cost differed from the rules). */
export interface RecalculationResult {
  changed: {
    containers: number;
    lots: number;
    categoryOutputs: number;
    gradeOutputs: number;
    baleInputs: number;
    bales: number;
  };
  adjustments: CostAdjustment[];
}

const emptyResult = (): RecalculationResult => ({
  changed: { containers: 0, lots: 0, categoryOutputs: 0, gradeOutputs: 0, baleInputs: 0, bales: 0 },
  adjustments: [],
});

/**
 * Applies the costing rules (./costing.ts) to stored data, top-down:
 * container → lots → category outputs → grade outputs → bale inputs → bales → stock items.
 * Sorting and baling use the same rules when they create rows, so recalculating unchanged data
 * changes nothing. Only rows whose cost differs are written. Sold lines keep their cost; a bale
 * whose cost changes after it was sold or opened is reported as a cost adjustment
 * (AuditLog COST_ADJUSTMENT).
 */
@Injectable()
export class CostingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recalculates a container's whole chain in one transaction. */
  async recalculateContainer(tenantId: string, containerId: string, userId?: string) {
    return this.prisma.$transaction((tx) => this.recalculateContainerTx(tx, tenantId, containerId, userId));
  }

  async recalculateContainerTx(tx: Tx, tenantId: string, containerId: string, userId?: string): Promise<RecalculationResult> {
    const container = await tx.container.findFirst({
      where: { id: containerId, tenantId },
      include: { containerCharges: true, rags: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!container) throw new NotFoundException('Container not found');

    const result = emptyResult();
    const landed = landedCost({
      purchaseCost: container.purchaseCost,
      purchaseCurrency: container.purchaseCurrency,
      fxRate: container.fxRate,
      charges: container.containerCharges.map((c) => c.amount),
    });
    const lotKg = sum(container.rags.map((r) => r.weightKg));
    const perKg = costPerKg(landed, container.rags.length ? lotKg : container.netWeight);
    if (!landed.equals(container.landedCostPKR) || !container.landedCostPerKg?.equals(perKg)) {
      await tx.container.update({ where: { id: container.id }, data: { landedCostPKR: landed, landedCostPerKg: perKg } });
      result.changed.containers += 1;
    }

    if (container.rags.length) {
      for (const lot of lotCosts(landed, container.rags.map((r) => ({ key: r, weightKg: r.weightKg })))) {
        await this.recalculateLotTx(tx, tenantId, lot.key, lot.amount, result);
      }
    }
    await this.logAdjustments(tx, tenantId, result.adjustments, userId);
    if (container.purchaseOrderId) await this.syncPurchaseOrderTotalTx(tx, container.purchaseOrderId);
    return result;
  }

  /** Recalculates everything made from a lot: its container's chain, or for a loose lot its own. */
  async recalculateLot(tenantId: string, ragId: string, userId?: string) {
    return this.prisma.$transaction((tx) => this.recalculateLotChainTx(tx, tenantId, ragId, userId));
  }

  async recalculateLotChainTx(tx: Tx, tenantId: string, ragId: string, userId?: string): Promise<RecalculationResult> {
    const lot = await tx.rag.findFirst({ where: { id: ragId, tenantId } });
    if (!lot) throw new NotFoundException('Lot not found');
    if (lot.containerId) return this.recalculateContainerTx(tx, tenantId, lot.containerId, userId);
    const result = emptyResult();
    // A loose lot costs its purchase price; one recorded without a price keeps its current cost.
    await this.recalculateLotTx(tx, tenantId, lot, lot.purchaseCost ? money(lot.purchaseCost) : lot.allocatedCost, result);
    await this.logAdjustments(tx, tenantId, result.adjustments, userId);
    return result;
  }

  /**
   * Re-costs what a lot gave (its outputs, bales from them) at the lot's current cost — used while sorting, when
   * outputs are added, and when the lot closes (v2 6.6). Sold bales keep their cost; changes are logged.
   */
  async recostLotOutputsTx(tx: Tx, tenantId: string, ragId: string, userId?: string): Promise<RecalculationResult> {
    const lot = await tx.rag.findFirst({ where: { id: ragId, tenantId } });
    if (!lot) throw new NotFoundException('Lot not found');
    const result = emptyResult();
    await this.recalculateLotTx(tx, tenantId, lot, lot.allocatedCost, result);
    await this.logAdjustments(tx, tenantId, result.adjustments, userId);
    return result;
  }

  private async recalculateLotTx(
    tx: Tx,
    tenantId: string,
    lot: { id: string; allocatedCost: Decimal; weightKg: Decimal },
    lotCost: Decimal,
    result: RecalculationResult,
  ) {
    if (!lotCost.equals(lot.allocatedCost)) {
      await tx.rag.update({ where: { id: lot.id }, data: { allocatedCost: lotCost } });
      result.changed.lots += 1;
    }
    const outputs = await tx.categoryOutput.findMany({
      where: { tenantId, ragId: lot.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, weightKg: true, allocatedCost: true },
    });
    if (!outputs.length) return;
    const units = new Set<string>();
    // Still being sorted: each output costs its kg at the lot's cost per kg; the kat's cost is shared at close.
    const open = await tx.sortSession.count({ where: { tenantId, ragId: lot.id, status: SortStatus.OPEN } });
    const shares = open
      ? outputs.map((o) => ({ key: o, amount: openLotCost(lotCost, lot.weightKg, o.weightKg) }))
      : outputCosts(lotCost, outputs.map((o) => ({ key: o, kg: o.weightKg })));
    for (const share of shares) {
      const output = share.key;
      if (!share.amount.equals(output.allocatedCost)) {
        await tx.categoryOutput.update({ where: { id: output.id }, data: { allocatedCost: share.amount } });
        result.changed.categoryOutputs += 1;
      }
      await this.recalculateCategoryOutputTx(tx, tenantId, output.id, share.amount, output.weightKg, units, result);
    }
    await this.recalculateBalesTx(tx, [...units], result);
  }

  private async recalculateCategoryOutputTx(
    tx: Tx,
    tenantId: string,
    categoryOutputId: string,
    cost: Decimal,
    kg: Decimal,
    units: Set<string>,
    result: RecalculationResult,
  ) {
    // Stage 2: grades share the category output's cost by kg.
    const grades = await tx.gradeOutput.findMany({
      where: { tenantId, gradeBucket: { gradeSession: { categoryOutputId } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, weightKg: true, allocatedCost: true },
    });
    if (grades.length) {
      for (const share of outputCosts(cost, grades.map((g) => ({ key: g, kg: g.weightKg })))) {
        const grade = share.key;
        if (!share.amount.equals(grade.allocatedCost)) {
          await tx.gradeOutput.update({ where: { id: grade.id }, data: { allocatedCost: share.amount } });
          result.changed.gradeOutputs += 1;
        }
        await this.recalculateTakesTx(tx, { gradingOutputId: grade.id }, share.amount, grade.weightKg, units, result);
      }
    }
    // One-stage sorting: bales taken straight from the category output.
    await this.recalculateTakesTx(tx, { categoryOutputId }, cost, kg, units, result);
  }

  /** Re-costs every bale input taken from one source, in the order they were taken. */
  private async recalculateTakesTx(
    tx: Tx,
    source: { gradingOutputId: string } | { categoryOutputId: string },
    cost: Decimal,
    kg: Decimal,
    units: Set<string>,
    result: RecalculationResult,
  ) {
    const takes = await tx.repackInputAllocation.findMany({
      where: source,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, amountUsed: true, allocatedCost: true, repackUnitId: true },
    });
    let used = new Decimal(0);
    for (const take of takes) {
      const cost_ = takeCost({ cost, kg }, used, take.amountUsed);
      used = used.add(take.amountUsed);
      if (!cost_.equals(take.allocatedCost)) {
        await tx.repackInputAllocation.update({ where: { id: take.id }, data: { allocatedCost: cost_ } });
        result.changed.baleInputs += 1;
      }
      units.add(take.repackUnitId);
    }
  }

  private async recalculateBalesTx(tx: Tx, unitIds: string[], result: RecalculationResult) {
    for (const unitId of unitIds) {
      const unit = await tx.repackUnit.findUniqueOrThrow({
        where: { id: unitId },
        select: {
          totalCost: true,
          weightKg: true,
          inputAllocations: { select: { allocatedCost: true } },
          inventoryItems: { select: { usedQuantity: true } },
        },
      });
      const total = money(sum(unit.inputAllocations.map((a) => a.allocatedCost)));
      if (total.equals(unit.totalCost)) continue;
      await tx.repackUnit.update({ where: { id: unitId }, data: { totalCost: total } });
      await tx.inventoryItem.updateMany({
        where: { repackUnitId: unitId },
        data: { totalCost: total, unitCost: total, avgCost: money(costPerKg(total, unit.weightKg)) },
      });
      result.changed.bales += 1;
      // Sold (or opened into pieces): those keep the cost they had, so the change is reported.
      if (unit.inventoryItems.some((i) => i.usedQuantity.greaterThan(0))) {
        result.adjustments.push({ repackUnitId: unitId, previousCost: unit.totalCost, newCost: total });
      }
    }
  }

  private async logAdjustments(tx: Tx, tenantId: string, adjustments: CostAdjustment[], userId?: string) {
    for (const a of adjustments) {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
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
    // Called for a container's own purchase order, so the sum is never empty.
    const totals = await tx.container.aggregate({ where: { purchaseOrderId }, _sum: { landedCostPKR: true } });
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { totalCost: totals._sum.landedCostPKR! } });
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
    return {
      containerId: container.id,
      containerNumber: container.containerNumber,
      currency: 'PKR',
      purchaseCost: container.purchaseCost,
      purchaseCurrency: container.purchaseCurrency,
      fxRate: container.fxRate,
      totalCost: container.landedCostPKR,
      totalWeight: container.rags.length ? sum(container.rags.map((r) => r.weightKg)) : container.netWeight,
      costPerKg: container.landedCostPerKg,
      charges: container.containerCharges,
      rags: container.rags.map((r) => ({ id: r.id, code: r.ragCode, weightKg: r.weightKg, allocatedCost: r.allocatedCost })),
    };
  }
}
