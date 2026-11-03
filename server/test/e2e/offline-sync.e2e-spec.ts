import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * Task 3.2: every write the phone can queue offline (receive, sort line, bale, customer, sale, payment)
 * is safe to send again with the same Idempotency-Key: a repeat returns the first answer and writes nothing.
 */
describe('Offline sync: idempotent writes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;

  const send = (t: TestTenant, url: string, body: object, key: string) => api(app, t).post(url, body).set('Idempotency-Key', key);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a container, its charge and a lot are recorded once however often they are sent', async () => {
    const vendor = await prisma.vendor.create({ data: { tenantId: a.tenantId, name: 'Karachi Imports' } });
    const k = randomUUID();
    const body = { vendorId: vendor.id, originCountry: 'USA', netWeightKg: 20000, purchaseCost: 1_000_000 };
    const first = await send(a, '/procurement/containers', body, k).expect(201);
    const again = await send(a, '/procurement/containers', body, k).expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect(await prisma.container.count({ where: { tenantId: a.tenantId, vendorId: vendor.id } })).toBe(1);

    const kc = randomUUID();
    const charge = { chargeType: 'DUTY', amount: 50_000 };
    await send(a, `/procurement/containers/${first.body.id}/charges`, charge, kc).expect(201);
    await send(a, `/procurement/containers/${first.body.id}/charges`, charge, kc).expect(201);
    expect(await prisma.containerCharge.count({ where: { containerId: first.body.id } })).toBe(1);

    const raw = await prisma.rawCategory.create({ data: { tenantId: a.tenantId, name: 'Mixed', rawType: 'BALE' } });
    const kl = randomUUID();
    const lot = { containerId: first.body.id, rawCategoryId: raw.id, ragBaleType: 'BALE', weightKg: 1000 };
    const l1 = await send(a, '/procurement/rags', lot, kl).expect(201);
    const l2 = await send(a, '/procurement/rags', lot, kl).expect(201);
    expect(l2.body.id).toBe(l1.body.id);
    expect(await prisma.rag.count({ where: { containerId: first.body.id } })).toBe(1);
  });

  it('a sort line sent twice (one after another, or at the same moment) adds its kg once', async () => {
    const data = await seedSortableLot(app, a.tenantId);
    const ks = randomUUID();
    const s1 = await send(a, '/sorting/stage-1/start', { ragId: data.lot.id }, ks).expect(201);
    const s2 = await send(a, '/sorting/stage-1/start', { ragId: data.lot.id }, ks).expect(201);
    expect(s2.body).toEqual(s1.body);
    const sessionId = s1.body.session.id;

    const line = { sessionId, categoryId: data.jeans.id, amountKg: 30 };
    const k1 = randomUUID();
    await send(a, '/sorting/stage-1/allocate', line, k1).expect(200);
    await send(a, '/sorting/stage-1/allocate', line, k1).expect(200);

    const k2 = randomUUID();
    const together = await Promise.all([1, 2, 3].map(() => send(a, '/sorting/stage-1/allocate', { ...line, categoryId: data.shirts.id, amountKg: 20 }, k2)));
    for (const r of together) expect([200, 409]).toContain(r.status);
    expect(together.some((r) => r.status === 200)).toBe(true);

    const buckets = await prisma.sortCategoryBucket.findMany({ where: { sortSessionId: sessionId }, include: { category: true } });
    const kg = Object.fromEntries(buckets.map((o) => [o.category.name, o.outputWeightKg.toFixed(1)]));
    expect(kg).toEqual({ Jeans: '30.0', Shirts: '20.0' });

    // A rejected line frees its key, so the corrected line can be sent with the same key.
    const k3 = randomUUID();
    await send(a, '/sorting/stage-1/allocate', { ...line, amountKg: 999 }, k3).expect(400);
    await send(a, '/sorting/stage-1/allocate', { ...line, amountKg: 10 }, k3).expect(200);
    const jeans = await prisma.sortCategoryBucket.findFirst({ where: { sortSessionId: sessionId, categoryId: data.jeans.id } });
    expect(jeans!.outputWeightKg.toFixed(1)).toBe('40.0');
  });

  it('ready stock, a bale and a new customer are created once', async () => {
    const ki = randomUUID();
    const item = { name: 'Mixed tops', unit: 'KG', quantity: 100, totalCost: 20_000 };
    const i1 = await send(a, '/stock/items', item, ki).expect(201);
    const i2 = await send(a, '/stock/items', item, ki).expect(201);
    expect(i2.body.id).toBe(i1.body.id);
    expect(await prisma.inventoryItem.count({ where: { tenantId: a.tenantId, name: 'Mixed tops' } })).toBe(1);

    const data = await seedSortableLot(app, a.tenantId);
    const started = await api(app, a).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201);
    const sessionId = started.body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, amountKg: 100 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: data.waste.id }).expect(200);
    const kb = randomUUID();
    const before = await prisma.repackUnit.count({ where: { tenantId: a.tenantId } });
    const b1 = await send(a, '/stock/bales', { categoryId: data.jeans.id, weightKg: 25 }, kb).expect(201);
    const b2 = await send(a, '/stock/bales', { categoryId: data.jeans.id, weightKg: 25 }, kb).expect(201);
    expect(b2.body).toEqual(b1.body);
    expect(await prisma.repackUnit.count({ where: { tenantId: a.tenantId } })).toBe(before + 1);

    const kcu = randomUUID();
    const c1 = await send(a, '/customers', { name: 'Haji Rafiq', phone: '0300 1234567' }, kcu).expect(201);
    const c2 = await send(a, '/customers', { name: 'Haji Rafiq', phone: '0300 1234567' }, kcu).expect(201);
    expect(c2.body.id).toBe(c1.body.id);
    expect(await prisma.customer.count({ where: { tenantId: a.tenantId, name: 'Haji Rafiq' } })).toBe(1);
  });

  it('keys belong to one tenant: another tenant with the same key gets its own record', async () => {
    const k = randomUUID();
    const ra = await send(a, '/customers', { name: 'Same key', phone: '03001112222' }, k).expect(201);
    const rb = await send(b, '/customers', { name: 'Same key', phone: '03001112222' }, k).expect(201);
    expect(rb.body.id).not.toBe(ra.body.id);
    expect(rb.body.tenantId ?? b.tenantId).toBe(b.tenantId);
  });

  it('a key longer than 200 characters is refused', async () => {
    await send(a, '/customers', { name: 'Long key', phone: '03001112223' }, 'x'.repeat(201)).expect(400);
  });
});
