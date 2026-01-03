/*
 * Report HTTP Verifier (ERP-grade)
 *
 * Calls the required /api/reports/* endpoints via real auth + tenant impersonation,
 * then reconciles key totals against independent Prisma aggregates.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000/api \
 *   SUPERADMIN_EMAIL=superadmin@thriftos.com SUPERADMIN_PASSWORD=SuperAdmin@123 \
 *   TENANT_ID=cmjhfwhec002eceaqb2htqes4 \
 *   START_DATE=2025-01-03 END_DATE=2026-01-03 \
 *   node scripts/verification/verify-reports-http.js
 */

const { PrismaClient } = require('@prisma/client');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000/api';
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@thriftos.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
const TENANT_ID = process.env.TENANT_ID;
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    u.set(k, String(v));
  }
  return u.toString();
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

async function httpJson(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} expected JSON; got: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} failed ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

async function httpCsv(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`GET ${path} failed ${res.status}: ${text.slice(0, 200)}`);
  if (!ct.includes('text/csv')) throw new Error(`GET ${path} expected text/csv; got ${ct}`);

  const trimmed = text.trim();
  if (!trimmed) throw new Error(`GET ${path} csv empty body`);

  // Header-only CSV is valid when dataset has 0 rows.
  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 1) throw new Error(`GET ${path} csv invalid (${lines.length} lines)`);

  return { lines: lines.length, header: lines[0] };
}

async function runCheck(name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (e) {
    return { name, ok: false, error: String(e && e.message ? e.message : e) };
  }
}

(async () => {
  requireEnv('TENANT_ID', TENANT_ID);
  requireEnv('START_DATE', START_DATE);
  requireEnv('END_DATE', END_DATE);

  const prisma = new PrismaClient();
  await prisma.$connect();

  const login = await httpJson('POST', '/auth/login', null, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  const superToken = login.accessToken;

  const imp = await httpJson('POST', `/superadmin/tenants/${TENANT_ID}/impersonate`, superToken);
  const token = imp.accessToken;

  const commonQ = qs({ startDate: START_DATE, endDate: END_DATE });

  const checks = [];

  // Procurement summary
  checks.push(
    await runCheck('GET /reports/procurement/summary (+export)', async () => {
      const api = await httpJson('GET', `/reports/procurement/summary?${commonQ}`, token);

      const pos = await prisma.purchaseOrder.findMany({
        where: {
          tenantId: TENANT_ID,
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
        },
        select: { id: true, totalCost: true },
      });
      const poIds = pos.map((p) => p.id);
      const totalPoCost = pos.reduce((s, p) => s + toNum(p.totalCost), 0);

      const containers = await prisma.container.findMany({
        where: { purchaseOrderId: { in: poIds } },
        select: { id: true, netWeight: true },
      });
      const containerIds = containers.map((c) => c.id);
      const totalContainerWeightKg = containers.reduce((s, c) => s + toNum(c.netWeight), 0);

      const chargesAgg = await prisma.containerCharge.aggregate({
        where: { containerId: { in: containerIds } },
        _sum: { amount: true },
      });
      const totalContainerCost = toNum(chargesAgg._sum.amount);

      const loose = await prisma.incomingBale.findMany({
        where: {
          tenantId: TENANT_ID,
          purchaseOrderId: { in: poIds },
          containerId: null,
        },
        select: { id: true, weightKg: true, cost: true },
      });
      const totalLooseBaleWeightKg = loose.reduce((s, b) => s + toNum(b.weightKg), 0);
      const totalLooseBaleCost = loose.reduce((s, b) => s + toNum(b.cost), 0);

      const ok =
        api.summary.totalPurchaseOrders === pos.length &&
        near(api.summary.totalPoCost, totalPoCost, 1e-6) &&
        api.summary.totalContainers === containers.length &&
        near(api.summary.totalContainerWeightKg, totalContainerWeightKg, 1e-6) &&
        near(api.summary.totalContainerCost, totalContainerCost, 1e-6) &&
        api.summary.totalLooseBales === loose.length &&
        near(api.summary.totalLooseBaleWeightKg, totalLooseBaleWeightKg, 1e-6) &&
        near(api.summary.totalLooseBaleCost, totalLooseBaleCost, 1e-6);

      if (!ok) {
        return {
          ok,
          api: api.summary,
          db: {
            pos: pos.length,
            totalPoCost,
            containers: containers.length,
            totalContainerWeightKg,
            totalContainerCost,
            loose: loose.length,
            totalLooseBaleWeightKg,
            totalLooseBaleCost,
          },
        };
      }

      const csv = await httpCsv(`/reports/procurement/summary/export?${commonQ}`, token);
      return { ok, csvLines: csv.lines, csvHeader: csv.header };
    }),
  );

  // Sorting outputs
  checks.push(
    await runCheck('GET /reports/sorting/outputs (+export)', async () => {
      const api = await httpJson('GET', `/reports/sorting/outputs?${commonQ}`, token);

      const s1Agg = await prisma.categoryOutput.aggregate({
        where: {
          tenantId: TENANT_ID,
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
        },
        _count: { _all: true },
        _sum: { weightKg: true, allocatedCost: true },
      });
      const s2Agg = await prisma.gradeOutput.aggregate({
        where: {
          tenantId: TENANT_ID,
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
        },
        _count: { _all: true },
        _sum: { weightKg: true, allocatedCost: true },
      });

      const ok =
        api.stage1.summary.totalOutputs === s1Agg._count._all &&
        near(api.stage1.summary.totalWeightKg, toNum(s1Agg._sum.weightKg), 1e-6) &&
        near(api.stage1.summary.totalAllocatedCost, toNum(s1Agg._sum.allocatedCost), 1e-6) &&
        api.stage2.summary.totalOutputs === s2Agg._count._all &&
        near(api.stage2.summary.totalWeightKg, toNum(s2Agg._sum.weightKg), 1e-6) &&
        near(api.stage2.summary.totalAllocatedCost, toNum(s2Agg._sum.allocatedCost), 1e-6);

      if (!ok) {
        return {
          ok,
          api: { s1: api.stage1.summary, s2: api.stage2.summary },
          db: {
            s1: { count: s1Agg._count._all, w: toNum(s1Agg._sum.weightKg), c: toNum(s1Agg._sum.allocatedCost) },
            s2: { count: s2Agg._count._all, w: toNum(s2Agg._sum.weightKg), c: toNum(s2Agg._sum.allocatedCost) },
          },
        };
      }

      const csv = await httpCsv(`/reports/sorting/outputs/export?${commonQ}`, token);
      return { ok, csvLines: csv.lines, csvHeader: csv.header };
    }),
  );

  // Sorting waste (legacy SortingWaste totals)
  checks.push(
    await runCheck('GET /reports/sorting/waste (+export)', async () => {
      const api = await httpJson('GET', `/reports/sorting/waste?${commonQ}`, token);

      const agg = await prisma.sortingWaste.aggregate({
        where: {
          tenantId: TENANT_ID,
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
        },
        _count: { _all: true },
        _sum: { weightKg: true },
      });

      let categorizedOk = true;
      let categorizedDb = null;
      if (api?.categorized?.summary) {
        const wlAggAll = await prisma.wasteLineItem.aggregate({
          where: {
            tenantId: TENANT_ID,
            createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
          },
          _count: { _all: true },
          _sum: { estimatedValue: true },
        });
        const wlAggKg = await prisma.wasteLineItem.aggregate({
          where: {
            tenantId: TENANT_ID,
            createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
            unitType: 'KG',
          },
          _sum: { amount: true },
        });
        categorizedDb = {
          totalRecords: wlAggAll._count._all,
          totalKg: toNum(wlAggKg._sum.amount),
          totalEstimatedValue: toNum(wlAggAll._sum.estimatedValue),
        };

        categorizedOk =
          api.categorized.summary.totalRecords === categorizedDb.totalRecords &&
          near(api.categorized.summary.totalKg, categorizedDb.totalKg, 1e-6) &&
          near(api.categorized.summary.totalEstimatedValue, categorizedDb.totalEstimatedValue, 1e-6);
      }

      const ok =
        api.summary.totalRecords === agg._count._all &&
        near(api.summary.totalWasteKg, toNum(agg._sum.weightKg), 1e-6) &&
        categorizedOk;
      if (!ok) {
        return {
          ok,
          api: { legacy: api.summary, categorized: api?.categorized?.summary ?? null },
          db: { legacy: { count: agg._count._all, wasteKg: toNum(agg._sum.weightKg) }, categorized: categorizedDb },
        };
      }

      const csv = await httpCsv(`/reports/sorting/waste/export?${commonQ}`, token);
      return { ok, csvLines: csv.lines, csvHeader: csv.header };
    }),
  );

  // Repack summary
  checks.push(
    await runCheck('GET /reports/repack/summary (+export)', async () => {
      const api = await httpJson('GET', `/reports/repack/summary?${commonQ}`, token);

      const unitsAgg = await prisma.repackUnit.aggregate({
        where: {
          tenantId: TENANT_ID,
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
        },
        _count: { _all: true },
        _sum: { weightKg: true, pcsCount: true, totalCost: true },
      });

      const ok =
        api.summary.totalUnits === unitsAgg._count._all &&
        near(api.summary.totalWeightKg, toNum(unitsAgg._sum.weightKg), 1e-6) &&
        api.summary.totalPcs === toNum(unitsAgg._sum.pcsCount) &&
        near(api.summary.totalCost, toNum(unitsAgg._sum.totalCost), 1e-6);

      if (!ok) {
        return {
          ok,
          api: api.summary,
          db: {
            count: unitsAgg._count._all,
            w: toNum(unitsAgg._sum.weightKg),
            pcs: toNum(unitsAgg._sum.pcsCount),
            cost: toNum(unitsAgg._sum.totalCost),
          },
        };
      }

      const csv = await httpCsv(`/reports/repack/summary/export?${commonQ}`, token);
      return { ok, csvLines: csv.lines, csvHeader: csv.header };
    }),
  );

  // Inventory stock
  checks.push(
    await runCheck('GET /reports/inventory/stock', async () => {
      const api = await httpJson('GET', `/reports/inventory/stock?${commonQ}`, token);

      const agg = await prisma.inventoryItem.aggregate({
        where: {
          tenantId: TENANT_ID,
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
        },
        _count: { _all: true },
        _sum: { weightKg: true, pcsCount: true },
      });

      const ok =
        api.summary.totalUnits === agg._count._all &&
        near(api.summary.totalWeightKg, toNum(agg._sum.weightKg), 1e-6) &&
        api.summary.totalPcs === toNum(agg._sum.pcsCount);

      if (!ok) {
        return { ok, api: api.summary, db: { count: agg._count._all, w: toNum(agg._sum.weightKg), pcs: toNum(agg._sum.pcsCount) } };
      }

      return { ok };
    }),
  );

  // Inventory movements
  checks.push(
    await runCheck('GET /reports/inventory/movements (+export)', async () => {
      const api = await httpJson('GET', `/reports/inventory/movements?${commonQ}`, token);

      const agg = await prisma.stockMovement.aggregate({
        where: {
          createdAt: { gte: new Date(START_DATE), lte: new Date(END_DATE) },
          inventoryItem: { tenantId: TENANT_ID },
        },
        _count: { _all: true },
        _sum: { quantityKg: true, quantityPcs: true },
      });

      const ok =
        api.summary.totalMovements === agg._count._all &&
        near(api.summary.totalKg, toNum(agg._sum.quantityKg), 1e-6) &&
        api.summary.totalPcs === toNum(agg._sum.quantityPcs);

      if (!ok) {
        return {
          ok,
          api: api.summary,
          db: { count: agg._count._all, kg: toNum(agg._sum.quantityKg), pcs: toNum(agg._sum.quantityPcs) },
        };
      }

      const csv = await httpCsv(`/reports/inventory/movements/export?${commonQ}`, token);
      return { ok, csvLines: csv.lines, csvHeader: csv.header };
    }),
  );

  // Cost final-products
  checks.push(
    await runCheck('GET /reports/cost/final-products (+export)', async () => {
      const api = await httpJson('GET', `/reports/cost/final-products?${commonQ}`, token);

      const rows = await prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT u."id")::int AS "units",
          COALESCE(SUM(u."weightKg"), 0) AS "totalWeightKg",
          COALESCE(SUM(ria."allocatedCost"), 0) AS "totalAllocCost"
        FROM "RepackUnit" u
        LEFT JOIN "RepackInputAllocation" ria ON ria."repackUnitId" = u."id"
        WHERE u."tenantId" = ${TENANT_ID}
          AND u."status" = 'SEALED'
          AND u."updatedAt" >= ${new Date(START_DATE)}
          AND u."updatedAt" <= ${new Date(END_DATE)}
      `;

      const db = {
        totalUnits: Number(rows[0].units ?? 0),
        totalWeightKg: toNum(rows[0].totalWeightKg),
        totalCost: toNum(rows[0].totalAllocCost),
      };

      const ok =
        api.summary.totalUnits === db.totalUnits &&
        near(api.summary.totalWeightKg, db.totalWeightKg, 1e-6) &&
        near(api.summary.totalCost, db.totalCost, 1e-6);

      const csv = await httpCsv(`/reports/cost/final-products/export?${commonQ}`, token);

      if (!ok) return { ok, api: api.summary, db, csvLines: csv.lines, csvHeader: csv.header };
      return { ok, csvLines: csv.lines, csvHeader: csv.header };
    }),
  );

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
    if (!c.ok) console.log(`  ${c.error}`);
  }

  console.log(`\nChecked ${checks.length} endpoints. Failures: ${failed.length}`);

  await prisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
