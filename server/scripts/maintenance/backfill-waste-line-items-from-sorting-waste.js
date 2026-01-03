/*
 * Backfill WasteLineItem(STAGE_1) from legacy SortingWaste
 *
 * Goal: Make waste reporting auditable & tenant-config aligned without guessing numbers.
 *
 * This script:
 * - Creates (if missing) a system-generated WasteCategory named "Legacy Uncategorized Waste"
 *   with unitType=KG and defaultResalePrice=0.
 * - For each SortingWaste record for the tenant where there is no STAGE_1 WasteLineItem
 *   for that sortSession, creates a WasteLineItem with amount=SortingWaste.weightKg.
 * - Validates SortSession.wasteWeight matches SortingWaste.weightKg (within tolerance).
 *
 * Dry-run by default.
 * Apply changes only when APPLY=1.
 *
 * Usage:
 *   TENANT_ID=... node scripts/maintenance/backfill-waste-line-items-from-sorting-waste.js
 *   TENANT_ID=... APPLY=1 node scripts/maintenance/backfill-waste-line-items-from-sorting-waste.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TENANT_ID = process.env.TENANT_ID;
const APPLY = process.env.APPLY === '1';

const CATEGORY_NAME = 'Legacy Uncategorized Waste';

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function toNum(x) {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  if (typeof x === 'string') return Number(x);
  if (typeof x === 'bigint') return Number(x);
  if (typeof x === 'object' && typeof x.toNumber === 'function') return x.toNumber();
  return Number(x);
}

function near(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

(async () => {
  requireEnv('TENANT_ID', TENANT_ID);
  await prisma.$connect();

  const tenant = await prisma.tenant.findFirst({ where: { id: TENANT_ID } });
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_ID}`);

  const sortingWaste = await prisma.sortingWaste.findMany({
    where: { tenantId: TENANT_ID },
    select: {
      id: true,
      sortSessionId: true,
      ragId: true,
      containerId: true,
      weightKg: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (sortingWaste.length === 0) {
    console.log(`No SortingWaste records for tenant ${TENANT_ID}. Nothing to backfill.`);
    await prisma.$disconnect();
    return;
  }

  const existingStage1 = await prisma.wasteLineItem.findMany({
    where: { tenantId: TENANT_ID, stage: 'STAGE_1', sortSessionId: { in: sortingWaste.map((s) => s.sortSessionId) } },
    select: { sortSessionId: true },
  });
  const existingSet = new Set(existingStage1.map((x) => x.sortSessionId).filter(Boolean));

  const toBackfill = sortingWaste.filter((sw) => !existingSet.has(sw.sortSessionId));

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`SortingWaste records: ${sortingWaste.length}`);
  console.log(`SortSessions already having STAGE_1 WasteLineItem: ${existingSet.size}`);
  console.log(`To backfill: ${toBackfill.length}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY_RUN'}`);

  if (toBackfill.length === 0) {
    await prisma.$disconnect();
    return;
  }

  // Ensure system waste category exists.
  const existingCategory = await prisma.wasteCategory.findFirst({
    where: { tenantId: TENANT_ID, name: CATEGORY_NAME },
    select: { id: true, unitType: true },
  });

  let wasteCategoryId = existingCategory?.id;
  const unitType = 'KG';

  if (!wasteCategoryId) {
    if (!APPLY) {
      console.log(`[DRY_RUN] Would create WasteCategory '${CATEGORY_NAME}' (unitType=KG, defaultResalePrice=0)`);
    } else {
      const created = await prisma.wasteCategory.create({
        data: {
          tenantId: TENANT_ID,
          name: CATEGORY_NAME,
          unitType,
          defaultResalePrice: 0,
          isSystemGenerated: true,
          isActive: true,
          linkedCategoryId: null,
        },
        select: { id: true },
      });
      wasteCategoryId = created.id;
      console.log(`Created WasteCategory '${CATEGORY_NAME}' id=${wasteCategoryId}`);
    }
  } else if (existingCategory.unitType !== unitType) {
    throw new Error(`WasteCategory '${CATEGORY_NAME}' exists but unitType=${existingCategory.unitType} (expected KG)`);
  }

  // Validate all SortSession.wasteWeight match SortingWaste.weightKg
  const sessionRows = await prisma.sortSession.findMany({
    where: { tenantId: TENANT_ID, id: { in: toBackfill.map((sw) => sw.sortSessionId) } },
    select: { id: true, wasteWeight: true },
  });
  const sessionWasteById = new Map(sessionRows.map((s) => [s.id, toNum(s.wasteWeight)]));

  const mismatches = [];
  for (const sw of toBackfill) {
    const sessionWaste = sessionWasteById.get(sw.sortSessionId);
    if (sessionWaste == null) {
      mismatches.push({ sortSessionId: sw.sortSessionId, reason: 'SortSession missing' });
      continue;
    }
    const swWaste = toNum(sw.weightKg);
    if (!near(sessionWaste, swWaste, 0.01)) {
      mismatches.push({ sortSessionId: sw.sortSessionId, sortSessionWasteWeight: sessionWaste, sortingWasteWeightKg: swWaste });
    }
  }
  if (mismatches.length) {
    console.error('Refusing to backfill due to waste weight mismatches:');
    console.error(JSON.stringify(mismatches.slice(0, 20), null, 2));
    throw new Error(`Found ${mismatches.length} mismatches; resolve before backfill.`);
  }

  if (!APPLY) {
    console.log(`[DRY_RUN] Would create ${toBackfill.length} WasteLineItem rows using category '${CATEGORY_NAME}'.`);
    await prisma.$disconnect();
    return;
  }

  if (!wasteCategoryId) throw new Error('Internal error: wasteCategoryId not resolved');

  const createdCount = await prisma.$transaction(async (tx) => {
    let created = 0;
    for (const sw of toBackfill) {
      const amount = sw.weightKg;
      // estimatedValue uses defaultResalePrice (0) for this legacy bucket.
      await tx.wasteLineItem.create({
        data: {
          tenantId: TENANT_ID,
          stage: 'STAGE_1',
          wasteCategoryId,
          amount,
          unitType,
          estimatedValue: 0,
          sortSessionId: sw.sortSessionId,
          gradeSessionId: null,
          containerId: sw.containerId,
          ragId: sw.ragId,
          categoryOutputId: null,
        },
        select: { id: true },
      });
      created++;
    }
    return created;
  });

  console.log(`Created WasteLineItem rows: ${createdCount}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
