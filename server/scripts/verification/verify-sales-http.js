/*
 * Sales HTTP Verifier (Phase-1 Sell foundation)
 *
 * Validates core non-negotiables via real auth + tenant impersonation, then
 * cross-checks with Prisma for inventory status/reservations and profit math.
 *
 * Preconditions:
 * - API server running (e.g. `npm run start:dev`) and DB reachable
 * - Target tenant has at least 1 AVAILABLE inventory item with a QR label
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000/api \
 *   SUPERADMIN_EMAIL=superadmin@thriftos.com SUPERADMIN_PASSWORD=SuperAdmin@123 \
 *   TENANT_ID=... \
 *   node scripts/verification/verify-sales-http.js
 */

const { PrismaClient } = require('@prisma/client');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000/api';
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@thriftos.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
const TENANT_ID = process.env.TENANT_ID;

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
    const err = new Error(`${method} ${path} failed ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

async function httpJsonExpectError(method, path, token, body) {
  try {
    const ok = await httpJson(method, path, token, body);
    return { ok: true, status: 200, body: ok };
  } catch (e) {
    return { ok: false, status: e.status || 0, body: e.body || null, message: String(e.message || e) };
  }
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

  const prisma = new PrismaClient();
  await prisma.$connect();

  const login = await httpJson('POST', '/auth/login', null, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  const superToken = login.accessToken;

  const imp = await httpJson('POST', `/superadmin/tenants/${TENANT_ID}/impersonate`, superToken);
  const token = imp.accessToken;

  const checks = [];

  // Find one AVAILABLE inventory item with a QR label.
  const inv = await prisma.inventoryItem.findFirst({
    where: {
      tenantId: TENANT_ID,
      status: 'AVAILABLE',
      repackUnit: { qrLabel: { isNot: null } },
    },
    include: { repackUnit: { include: { qrLabel: true } } },
  });

  if (!inv) {
    throw new Error(
      'No AVAILABLE inventory item with QR label found for tenant. Create at least one repack unit + inventory item first.',
    );
  }

  const qrCode = inv.repackUnit.qrLabel.qrCode;
  const measurementType = inv.repackUnit.measurementType;

  const qty =
    measurementType === 'WEIGHT'
      ? Number(inv.weightKg)
      : Number(inv.pcsCount);

  if (!qty || qty <= 0) {
    throw new Error('Selected inventory item has invalid quantity (weightKg/pcsCount).');
  }

  // 1) Create a customer
  let customer;
  checks.push(
    await runCheck('POST /customers', async () => {
      customer = await httpJson('POST', '/customers', token, {
        name: `Verify Customer ${Date.now()}`,
        companyName: 'Verify Co',
        billingAddress: 'Verify Billing',
        shippingAddress: 'Verify Shipping',
        contactEmail: `verify-${Date.now()}@example.com`,
        contactPhone: '+10000000000',
        taxId: 'TAX-VERIFY',
      });
      return { customerId: customer.id };
    }),
  );

  // 2) Create sale
  let sale;
  checks.push(
    await runCheck('POST /sales', async () => {
      sale = await httpJson('POST', '/sales', token, {
        customerId: customer.id,
        type: 'WHOLESALE',
      });
      return { saleId: sale.id, saleNumber: sale.saleNumber };
    }),
  );

  // 3) Scan QR -> should resolve AVAILABLE item
  checks.push(
    await runCheck('GET /sales/scan/qr/:code (AVAILABLE only)', async () => {
      const scanned = await httpJson('GET', `/sales/scan/qr/${encodeURIComponent(qrCode)}`, token);
      if (scanned.id !== inv.id) throw new Error('Scan did not return expected inventory item');
      if (scanned.status !== 'AVAILABLE') throw new Error(`Expected AVAILABLE, got ${scanned.status}`);
      return { inventoryItemId: scanned.id, status: scanned.status };
    }),
  );

  // 4) Add line -> reserves inventory
  let updatedAfterLine;
  checks.push(
    await runCheck('POST /sales/:id/lines reserves inventory', async () => {
      updatedAfterLine = await httpJson('POST', `/sales/${sale.id}/lines`, token, {
        inventoryItemId: inv.id,
        measurementType,
        quantity: qty,
        unitPrice: 10,
      });

      const dbInv = await prisma.inventoryItem.findFirst({ where: { id: inv.id }, select: { status: true } });
      const dbRes = await prisma.inventoryReservation.findFirst({
        where: { tenantId: TENANT_ID, inventoryItemId: inv.id },
        select: { id: true, saleId: true },
      });

      if (!dbInv || dbInv.status !== 'RESERVED') {
        throw new Error(`Expected DB inventory status RESERVED; got ${dbInv ? dbInv.status : 'missing'}`);
      }
      if (!dbRes || dbRes.saleId !== sale.id) {
        throw new Error('Expected an InventoryReservation for this sale');
      }

      return { ok: true, reservationId: dbRes.id };
    }),
  );

  // 5) Scan QR again -> should fail (RESERVED not allowed)
  checks.push(
    await runCheck('GET /sales/scan/qr/:code blocks RESERVED/SOLD', async () => {
      const res = await httpJsonExpectError('GET', `/sales/scan/qr/${encodeURIComponent(qrCode)}`, token);
      if (res.ok) throw new Error('Expected scan to fail once item is RESERVED');
      if (![404, 409].includes(res.status)) {
        throw new Error(`Expected 404/409, got ${res.status}: ${res.message}`);
      }
      return { status: res.status };
    }),
  );

  // 6) Oversell prevention: create second sale and attempt to add same item -> conflict
  let sale2;
  checks.push(
    await runCheck('Oversell prevention (same inventory cannot be reserved twice)', async () => {
      sale2 = await httpJson('POST', '/sales', token, {
        customerId: customer.id,
        type: 'WHOLESALE',
      });

      const res = await httpJsonExpectError('POST', `/sales/${sale2.id}/lines`, token, {
        inventoryItemId: inv.id,
        measurementType,
        quantity: qty,
        unitPrice: 10,
      });

      if (res.ok) throw new Error('Expected conflict when reserving already RESERVED inventory');
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}: ${res.message}`);

      return { status: res.status };
    }),
  );

  // 7) Issue sale -> RESERVED -> SOLD, reservations removed, edits blocked
  checks.push(
    await runCheck('POST /sales/:id/issue locks and marks SOLD', async () => {
      const issued = await httpJson('POST', `/sales/${sale.id}/issue`, token);

      const dbInv = await prisma.inventoryItem.findFirst({ where: { id: inv.id }, select: { status: true } });
      const dbRes = await prisma.inventoryReservation.findFirst({ where: { tenantId: TENANT_ID, inventoryItemId: inv.id } });

      if (!dbInv || dbInv.status !== 'SOLD') throw new Error(`Expected SOLD; got ${dbInv ? dbInv.status : 'missing'}`);
      if (dbRes) throw new Error('Expected reservation to be deleted on issue');
      if (issued.status !== 'ISSUED') throw new Error(`Expected sale status ISSUED; got ${issued.status}`);

      // Edits blocked
      const patchRes = await httpJsonExpectError('PATCH', `/sales/${sale.id}`, token, { type: 'EXPORT' });
      if (patchRes.ok) throw new Error('Expected PATCH to be blocked after issue');
      if (patchRes.status !== 403) throw new Error(`Expected 403 on edit; got ${patchRes.status}`);

      const addRes = await httpJsonExpectError('POST', `/sales/${sale.id}/lines`, token, {
        inventoryItemId: inv.id,
        measurementType,
        quantity: qty,
        unitPrice: 10,
      });
      if (addRes.ok) throw new Error('Expected addLine to be blocked after issue');
      if (addRes.status !== 403) throw new Error(`Expected 403 on addLine; got ${addRes.status}`);

      const cancelRes = await httpJsonExpectError('POST', `/sales/${sale.id}/cancel`, token);
      if (cancelRes.ok) throw new Error('Expected cancel to be blocked after issue');
      if (cancelRes.status !== 403) throw new Error(`Expected 403 on cancel; got ${cancelRes.status}`);

      return { ok: true };
    }),
  );

  // 8) Profit correctness: lineCost = qty * avgCost, profit = lineTotal - lineCost
  checks.push(
    await runCheck('Profit correctness (backend-derived)', async () => {
      const line = await prisma.saleLine.findFirst({
        where: { saleId: sale.id, inventoryItemId: inv.id },
        select: { quantity: true, unitPrice: true, lineTotal: true, lineCost: true, profit: true },
      });
      if (!line) throw new Error('Missing sale line in DB');

      const avgCost = toNum(inv.avgCost);
      const q = toNum(line.quantity);
      const unitPrice = toNum(line.unitPrice);

      const expectedTotal = Number((q * unitPrice).toFixed(2));
      const expectedCost = Number((q * avgCost).toFixed(2));
      const expectedProfit = Number((expectedTotal - expectedCost).toFixed(2));

      const ok =
        near(toNum(line.lineTotal), expectedTotal, 1e-6) &&
        near(toNum(line.lineCost), expectedCost, 1e-6) &&
        near(toNum(line.profit), expectedProfit, 1e-6);

      if (!ok) {
        return {
          ok,
          expected: { expectedTotal, expectedCost, expectedProfit },
          actual: {
            lineTotal: toNum(line.lineTotal),
            lineCost: toNum(line.lineCost),
            profit: toNum(line.profit),
          },
        };
      }

      return { ok };
    }),
  );

  // 9) Payments: partially then fully paid
  checks.push(
    await runCheck('POST /sales/:id/payments sets PARTIALLY_PAID/PAID', async () => {
      const dbSaleBefore = await prisma.sale.findFirst({ where: { id: sale.id }, select: { totalAmount: true } });
      const total = toNum(dbSaleBefore.totalAmount);
      if (!total || total <= 0) throw new Error('Sale totalAmount invalid');

      const p1 = await httpJson('POST', `/sales/${sale.id}/payments`, token, { amount: Number((total / 2).toFixed(2)), method: 'CASH' });
      if (p1.status !== 'PARTIALLY_PAID' && p1.status !== 'PAID') {
        throw new Error(`Unexpected status after first payment: ${p1.status}`);
      }

      const p2 = await httpJson('POST', `/sales/${sale.id}/payments`, token, { amount: total, method: 'CASH' });
      if (p2.status !== 'PAID') throw new Error(`Expected PAID after second payment; got ${p2.status}`);

      return { ok: true, finalStatus: p2.status };
    }),
  );

  const failed = checks.filter((c) => !c.ok);

  // Print summary
  console.log('=== Sales Verification Results ===');
  for (const c of checks) {
    if (c.ok) console.log(`OK   ${c.name}`);
    else console.log(`FAIL ${c.name} :: ${c.error}`);
  }

  if (failed.length) {
    console.log('\nFailures detail:');
    for (const f of failed) console.log(JSON.stringify(f, null, 2));
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed.');
  }

  await prisma.$disconnect();
})();
