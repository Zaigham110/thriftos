/*
  Maintenance: deterministic recomputation of procurement→sorting→grading→repack→inventory cost chain.

  Why this exists:
  - Reporting is fail-closed when inventory has quantity but non-positive avgCost.
  - This script recomputes cost fields using the same formulas as domain services.

  Safety:
  - Default is DRY RUN (no writes).
  - Set APPLY=1 to perform updates.

  Usage:
    cd server
    node scripts/maintenance/recompute-cost-chain.js

  Optional env:
    TENANT_ID=<tenantId>           (defaults to Demo Thrift Company)
    APPLY=1                        (perform writes)

  Notes:
  - Does not invent data; uses existing charges, weights, and stored lineage.
  - Does not change statuses or quantities; only recomputes cost fields.
*/

const { PrismaClient, Prisma } = require('@prisma/client');

function toDecimal(value) {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value ?? 0);
}

function decToNumber(value) {
  const d = toDecimal(value);
  return d.toNumber();
}

function isApplyMode() {
  return String(process.env.APPLY || '').trim() === '1';
}

async function main() {
  const prisma = new PrismaClient();
  const apply = isApplyMode();

  try {
    const tenantIdFromEnv = process.env.TENANT_ID?.trim();
    const tenant = tenantIdFromEnv
      ? await prisma.tenant.findUnique({ where: { id: tenantIdFromEnv }, select: { id: true, name: true, currency: true } })
      : await prisma.tenant.findFirst({ where: { name: 'Demo Thrift Company' }, select: { id: true, name: true, currency: true } });

    if (!tenant) throw new Error('Tenant not found (set TENANT_ID or ensure Demo Thrift Company exists).');

    const violatingBefore = await prisma.inventoryItem.count({
      where: {
        tenantId: tenant.id,
        avgCost: { lte: 0 },
        OR: [{ weightKg: { gt: 0 } }, { pcsCount: { gt: 0 } }],
      },
    });

    console.log('=== Cost Chain Recompute ===');
    console.log('Tenant:', tenant);
    console.log('Mode:', apply ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)');
    console.log('Violating inventory items (before):', violatingBefore);

    // -------------------------
    // 1) Container charge allocation → Rag.allocatedCost + IncomingBale.cost
    // -------------------------
    const containers = await prisma.container.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        purchaseOrderId: true,
        netWeight: true,
        containerCharges: { select: { amount: true } },
        rags: { select: { id: true, weightKg: true } },
        incomingBales: { select: { id: true, weightKg: true } },
      },
    });

    let updatedRags = 0;
    let updatedContainerBales = 0;

    for (const c of containers) {
      const netWeight = toDecimal(c.netWeight);
      if (netWeight.lte(new Prisma.Decimal(0))) {
        // Skip; cannot allocate without net weight.
        continue;
      }

      const containerTotalCost = c.containerCharges.reduce((sum, ch) => sum.add(toDecimal(ch.amount)), new Prisma.Decimal(0));

      for (const rag of c.rags) {
        const allocated = toDecimal(rag.weightKg).div(netWeight).mul(containerTotalCost);
        updatedRags += 1;
        if (apply) {
          await prisma.rag.update({ where: { id: rag.id }, data: { allocatedCost: allocated } });
        }
      }

      for (const bale of c.incomingBales) {
        const allocated = toDecimal(bale.weightKg).div(netWeight).mul(containerTotalCost);
        updatedContainerBales += 1;
        if (apply) {
          await prisma.incomingBale.update({ where: { id: bale.id }, data: { cost: allocated } });
        }
      }
    }

    console.log('Allocated container costs:');
    console.log('- Containers processed:', containers.length);
    console.log('- Rag updates:', updatedRags);
    console.log('- Incoming bale (linked to container) updates:', updatedContainerBales);

    // -------------------------
    // 1b) Sync PurchaseOrder.totalCost = sum(container charges) + sum(loose bales cost)
    //     (matches CostAllocationService.syncPurchaseOrderTotals)
    // -------------------------
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        containers: { select: { containerCharges: { select: { amount: true } } } },
        incomingBales: { where: { containerId: null }, select: { cost: true } },
      },
    });

    let updatedPurchaseOrders = 0;
    for (const po of purchaseOrders) {
      const containerTotals = po.containers.reduce((sum, container) => {
        const chargesTotal = container.containerCharges.reduce((chargeSum, ch) => chargeSum.add(toDecimal(ch.amount)), new Prisma.Decimal(0));
        return sum.add(chargesTotal);
      }, new Prisma.Decimal(0));

      const looseBaleTotals = po.incomingBales.reduce((sum, b) => sum.add(toDecimal(b.cost)), new Prisma.Decimal(0));
      const total = containerTotals.add(looseBaleTotals);

      updatedPurchaseOrders += 1;
      if (apply) {
        await prisma.purchaseOrder.update({ where: { id: po.id }, data: { totalCost: total } });
      }
    }

    console.log('Synced PurchaseOrder totals:');
    console.log('- PurchaseOrders updated:', updatedPurchaseOrders);

    // -------------------------
    // 2) Sorting Stage 1 allocation → CategoryOutput.allocatedCost
    //    (matches SortSessionService seal formula)
    // -------------------------
    const sortSessions = await prisma.sortSession.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        ragId: true,
        incomingBaleId: true,
        rag: { select: { allocatedCost: true } },
        incomingBale: { select: { cost: true } },
      },
    });

    let updatedCategoryOutputs = 0;

    for (const s of sortSessions) {
      const sourceCost = toDecimal(s.rag?.allocatedCost ?? s.incomingBale?.cost ?? 0);

      const outputs = await prisma.categoryOutput.findMany({
        where: { tenantId: tenant.id, sortSessionId: s.id },
        select: { id: true, weightKg: true },
      });

      const totalOut = outputs.reduce((sum, o) => sum.add(toDecimal(o.weightKg)), new Prisma.Decimal(0));
      if (totalOut.lte(new Prisma.Decimal(0))) {
        // No outputs means nothing to allocate; set to zero
        for (const o of outputs) {
          updatedCategoryOutputs += 1;
          if (apply) {
            await prisma.categoryOutput.update({ where: { id: o.id }, data: { allocatedCost: new Prisma.Decimal(0) } });
          }
        }
        continue;
      }

      for (const o of outputs) {
        const allocated = toDecimal(o.weightKg).div(totalOut).mul(sourceCost);
        updatedCategoryOutputs += 1;
        if (apply) {
          await prisma.categoryOutput.update({ where: { id: o.id }, data: { allocatedCost: allocated } });
        }
      }
    }

    console.log('Recomputed CategoryOutput allocatedCost:');
    console.log('- SortSessions processed:', sortSessions.length);
    console.log('- CategoryOutputs updated:', updatedCategoryOutputs);

    // -------------------------
    // 3) Sorting Stage 2 allocation → GradeOutput.allocatedCost
    //    (matches GradeSessionService close formula)
    // -------------------------
    const gradeSessions = await prisma.gradeSession.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        categoryOutput: { select: { allocatedCost: true } },
        gradeBuckets: { select: { gradeOutputs: { select: { id: true, weightKg: true } } } },
      },
    });

    let updatedGradeOutputs = 0;

    for (const gs of gradeSessions) {
      const sourceCost = toDecimal(gs.categoryOutput?.allocatedCost ?? 0);
      const outputs = gs.gradeBuckets.flatMap((b) => b.gradeOutputs);
      const totalOut = outputs.reduce((sum, o) => sum.add(toDecimal(o.weightKg)), new Prisma.Decimal(0));

      if (totalOut.lte(new Prisma.Decimal(0))) {
        for (const o of outputs) {
          updatedGradeOutputs += 1;
          if (apply) {
            await prisma.gradeOutput.update({ where: { id: o.id }, data: { allocatedCost: new Prisma.Decimal(0) } });
          }
        }
        continue;
      }

      for (const o of outputs) {
        const allocated = toDecimal(o.weightKg).div(totalOut).mul(sourceCost);
        updatedGradeOutputs += 1;
        if (apply) {
          await prisma.gradeOutput.update({ where: { id: o.id }, data: { allocatedCost: allocated } });
        }
      }
    }

    console.log('Recomputed GradeOutput allocatedCost:');
    console.log('- GradeSessions processed:', gradeSessions.length);
    console.log('- GradeOutputs updated:', updatedGradeOutputs);

    // -------------------------
    // 4) Repack allocation cost → RepackInputAllocation.allocatedCost
    //    and RepackUnit.totalCost = sum(allocations)
    //    (matches RepackAllocationService proportional cost formula)
    // -------------------------
    const allocations = await prisma.repackInputAllocation.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        repackUnitId: true,
        amountUsed: true,
        gradingOutput: { select: { allocatedCost: true, totalAmount: true } },
      },
    });

    const unitTotals = new Map();
    let updatedAllocations = 0;

    for (const a of allocations) {
      const totalAmount = toDecimal(a.gradingOutput?.totalAmount ?? 0);
      const sourceCost = toDecimal(a.gradingOutput?.allocatedCost ?? 0);
      const amountUsed = toDecimal(a.amountUsed);

      const allocationCost = totalAmount.lte(new Prisma.Decimal(0)) ? new Prisma.Decimal(0) : sourceCost.div(totalAmount).mul(amountUsed);

      updatedAllocations += 1;
      if (apply) {
        await prisma.repackInputAllocation.update({ where: { id: a.id }, data: { allocatedCost: allocationCost } });
      }

      const prev = unitTotals.get(a.repackUnitId) ?? new Prisma.Decimal(0);
      unitTotals.set(a.repackUnitId, prev.add(allocationCost));
    }

    let updatedRepackUnits = 0;
    for (const [repackUnitId, totalCost] of unitTotals.entries()) {
      updatedRepackUnits += 1;
      if (apply) {
        await prisma.repackUnit.update({ where: { id: repackUnitId }, data: { totalCost } });
      }
    }

    console.log('Recomputed repack allocation costs:');
    console.log('- RepackInputAllocations updated:', updatedAllocations);
    console.log('- RepackUnits totalCost updated:', updatedRepackUnits);

    // -------------------------
    // 5) Inventory avgCost = repackUnit.totalCost / denom
    //    (matches repack-v3 seal logic)
    // -------------------------
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        repackUnitId: true,
        weightKg: true,
        pcsCount: true,
        repackUnit: { select: { totalCost: true, measurementType: true, weightKg: true, pcsCount: true } },
      },
    });

    let updatedInventory = 0;
    for (const item of inventoryItems) {
      const unit = item.repackUnit;
      if (!unit) continue;

      const denom = unit.measurementType === 'QUANTITY' ? new Prisma.Decimal(unit.pcsCount || 0) : toDecimal(unit.weightKg);
      const avgCost = denom.lte(new Prisma.Decimal(0)) ? new Prisma.Decimal(0) : toDecimal(unit.totalCost).div(denom);

      updatedInventory += 1;
      if (apply) {
        await prisma.inventoryItem.update({ where: { id: item.id }, data: { avgCost } });
      }
    }

    console.log('Recomputed InventoryItem avgCost:');
    console.log('- InventoryItems updated:', updatedInventory);

    // -------------------------
    // Audit log (one entry per run)
    // -------------------------
    if (apply) {
      await prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: null,
          action: 'MAINT_COST_CHAIN_RECOMPUTE',
          entityType: 'Tenant',
          entityId: tenant.id,
          metadataJson: {
            updatedRags,
            updatedContainerBales,
            updatedPurchaseOrders,
            updatedCategoryOutputs,
            updatedGradeOutputs,
            updatedAllocations,
            updatedRepackUnits,
            updatedInventory,
          },
        },
      });
    }

    const violatingAfter = await prisma.inventoryItem.count({
      where: {
        tenantId: tenant.id,
        avgCost: { lte: 0 },
        OR: [{ weightKg: { gt: 0 } }, { pcsCount: { gt: 0 } }],
      },
    });

    console.log('Violating inventory items (after):', violatingAfter);

    if (apply && violatingAfter > 0) {
      process.exitCode = 2;
      console.error('FAILED: Still has non-positive cost inventory with quantity. Investigate upstream costs.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
