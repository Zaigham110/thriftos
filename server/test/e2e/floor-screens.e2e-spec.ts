import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/** Task 3.4: what the floor screens need from the API — one-step container receive, default lot type, yield and bale kinds. */
describe('Floor screens API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Maal aya → Container: supplier, weights, cost and charges in one save, with one lot ready to sort', async () => {
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Karachi Imports', originCountry: 'USA' }).set('Idempotency-Key', 'v-1').expect(201);
    await api(app, a).post('/procurement/vendors', { name: 'Karachi Imports', originCountry: 'USA' }).set('Idempotency-Key', 'v-1').expect(201);
    expect(await prisma.vendor.count({ where: { tenantId: a.tenantId, name: 'Karachi Imports' } })).toBe(1);

    const key = randomUUID();
    const body = {
      vendorId: supplier.body.id,
      netWeightKg: 20000,
      weighbridgeKg: 19950,
      purchaseCost: 16000,
      purchaseCurrency: 'USD',
      fxRate: 280,
      charges: [
        { chargeType: 'DUTY', amount: 350000 },
        { chargeType: 'CLEARING', amount: 120000.5 },
      ],
      withLot: true,
    };
    const res = await api(app, a).post('/procurement/containers', body).set('Idempotency-Key', key).expect(201);
    await api(app, a).post('/procurement/containers', body).set('Idempotency-Key', key).expect(201);

    // 16,000 × 280 + 350,000 + 120,000.50 = 4,950,000.50
    expect(res.body).toMatchObject({ originCountry: 'USA', landedCostPKR: '4950000.5', weighbridgeNetWeight: '19950', weightVarianceKg: '-50' });
    expect(res.body.rags).toHaveLength(1);
    const lot = await prisma.rag.findUniqueOrThrow({ where: { id: res.body.rags[0].id }, include: { rawCategory: true } });
    expect(lot).toMatchObject({ status: 'NOT_STARTED', sourceType: 'CONTAINER', vendorId: supplier.body.id, originCountry: 'USA' });
    expect(lot.weightKg.toFixed(2)).toBe('19950.00');
    expect(lot.allocatedCost.toFixed(2)).toBe('4950000.50');
    expect(lot.rawCategory.name).toBe('Mixed');
    expect(await prisma.container.count({ where: { tenantId: a.tenantId, vendorId: supplier.body.id } })).toBe(1);
    expect(await prisma.containerCharge.count({ where: { containerId: res.body.id } })).toBe(2);

    const queue = await api(app, a).get('/sorting/stage-1/queue').expect(200);
    expect(queue.body.data.map((l: any) => l.id)).toContain(lot.id);
    const other = await api(app, b).get('/sorting/stage-1/queue').expect(200);
    expect(other.body.data.map((l: any) => l.id)).not.toContain(lot.id);
  });

  it('refuses a kanta weight above the invoice weight, and nothing is saved', async () => {
    const supplier = await prisma.vendor.create({ data: { tenantId: a.tenantId, name: 'Heavy Kanta' } });
    await api(app, a).post('/procurement/containers', { vendorId: supplier.id, netWeightKg: 1000, weighbridgeKg: 1001, purchaseCost: 1, withLot: true }).expect(400);
    expect(await prisma.container.count({ where: { vendorId: supplier.id } })).toBe(0);
  });

  it('a loose lot needs only a weight and a price (type defaults to Mixed)', async () => {
    const lot = await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 450, purchaseCost: 90000 }).expect(201);
    expect(lot.body).toMatchObject({ rawCategory: { name: 'Mixed' }, sourceType: 'LOOSE_BALE', status: 'NOT_STARTED' });
    expect(await prisma.rawCategory.count({ where: { tenantId: a.tenantId, name: 'Mixed' } })).toBe(1);
  });

  it('a closed lot shows each category with its kg and cost per kg, adding up to the lot cost', async () => {
    const data = await seedSortableLot(app, a.tenantId);
    const started = await api(app, a).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201);
    const sessionId = started.body.session.id;
    expect(started.body.outputs).toEqual([]);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, amountKg: 60 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.shirts.id, amountKg: 30 }).expect(200);
    const closed = await api(app, a).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: data.waste.id }).expect(200);
    // Rs 50,000 over 90 kg of outputs (10 kg waste carries no cost).
    expect(closed.body.outputs.map((o: any) => [o.name, o.weightKg, o.cost, o.costPerKg])).toEqual([
      ['Jeans', '60', '33333.33', '555.5555'],
      ['Shirts', '30', '16666.67', '555.5557'],
    ]);

    // Bale kinds: what can be baled, with kg left, per tenant.
    const kinds = await api(app, a).get('/stock/bales/kinds').expect(200);
    expect(kinds.body).toEqual(expect.arrayContaining([expect.objectContaining({ categoryName: 'Jeans', gradeId: null, availableKg: '60' })]));
    await api(app, a).post('/stock/bales', { categoryId: data.jeans.id, weightKg: 25 }).expect(201);
    const after = await api(app, a).get('/stock/bales/kinds').expect(200);
    expect(after.body.find((k: any) => k.categoryId === data.jeans.id).availableKg).toBe('35');
    const other = await api(app, b).get('/stock/bales/kinds').expect(200);
    expect(other.body.find((k: any) => k.categoryId === data.jeans.id)).toBeUndefined();
  });

  it('a closed grading shows each grade with its cost', async () => {
    const data = await seedSortableLot(app, a.tenantId);
    const s = await api(app, a).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s.body.session.id, categoryId: data.shirts.id, amountKg: 100 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${s.body.session.id}/seal`, {}).expect(200);
    const output = await prisma.categoryOutput.findFirstOrThrow({ where: { sortCategoryBucket: { sortSessionId: s.body.session.id } } });
    const g = await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: output.id }).expect(201);
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g.body.session.id, gradeId: data.gradeA.id, amountKg: 40 }).expect(200);
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g.body.session.id, gradeId: data.gradeB.id, amountKg: 60 }).expect(200);
    const closed = await api(app, a).patch(`/sorting/stage-2/${g.body.session.id}/seal`, {}).expect(200);
    const outputs = (await api(app, a).get(`/sorting/stage-2/sessions/${g.body.session.id}`).expect(200)).body.outputs;
    expect(closed.status).toBe(200);
    expect(outputs.map((o: any) => [o.name, o.weightKg, o.cost])).toEqual([
      ['A', '40', '20000'],
      ['B', '60', '30000'],
    ]);
    const kinds = await api(app, a).get('/stock/bales/kinds').expect(200);
    expect(kinds.body).toEqual(expect.arrayContaining([expect.objectContaining({ categoryName: 'Shirts', gradeName: 'A', availableKg: '40' })]));
  });

  it('Undo takes kg back off a sort line (never below zero), only while the lot is open, and only in this tenant', async () => {
    const data = await seedSortableLot(app, a.tenantId);
    const s = await api(app, a).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201);
    const sessionId = s.body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, amountKg: 30 }).expect(200);
    const undone = await api(app, a).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.jeans.id, amountKg: 12.5 }).set('Idempotency-Key', 'u-1').expect(200);
    await api(app, a).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.jeans.id, amountKg: 12.5 }).set('Idempotency-Key', 'u-1').expect(200);
    expect(undone.body.buckets[0].outputWeightKg).toBe('17.5');
    expect(undone.body.session.totalOutputWeight).toBe('17.5');
    await api(app, a).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.jeans.id, amountKg: 18 }).expect(400);
    await api(app, b).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.jeans.id, amountKg: 1 }).expect(404);
    await api(app, a).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: data.waste.id }).expect(200);
    await api(app, a).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.jeans.id, amountKg: 1 }).expect(409);
  });

  it('bales get short codes (B-0001…) and printable labels with QR, kind, kg and origin; scan finds them', async () => {
    const t = await createTenantWithOwner(app);
    const data = await seedSortableLot(app, t.tenantId);
    await prisma.rag.update({ where: { id: data.lot.id }, data: { originCountry: 'Korea' } });
    const s = await api(app, t).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201);
    await api(app, t).post('/sorting/stage-1/allocate', { sessionId: s.body.session.id, categoryId: data.jeans.id, amountKg: 100 }).expect(200);
    await api(app, t).patch(`/sorting/stage-1/${s.body.session.id}/seal`, {}).expect(200);
    const b1 = await api(app, t).post('/stock/bales', { categoryId: data.jeans.id, weightKg: 45, pieces: 120 }).expect(201);
    const b2 = await api(app, t).post('/stock/bales', { categoryId: data.jeans.id, weightKg: 40 }).expect(201);
    expect([b1.body.unitCode, b2.body.unitCode]).toEqual(['B-0001', 'B-0002']);

    const labels = await api(app, t).get(`/stock/bales/labels?ids=${b2.body.id},${b1.body.id}`).expect(200);
    expect(labels.body.map((l: any) => l.code)).toEqual(['B-0002', 'B-0001']);
    expect(labels.body[1]).toMatchObject({ code: 'B-0001', qr: expect.stringMatching(/^REPACK:T[0-9A-F]+:B-0001$/), category: 'Jeans', grade: null, weightKg: '45', pieces: 120, origin: 'Korea' });
    expect(labels.body[1].business).toMatch(/^Test /);
    expect(labels.body[1].qrSvg).toMatch(/^<svg/);
    const other = await api(app, b).get(`/stock/bales/labels?ids=${b1.body.id}`).expect(200);
    expect(other.body).toEqual([]);

    const byCode = await api(app, t).get('/sales/scan/qr/B-0001').expect(200);
    const byQr = await api(app, t).get(`/sales/scan/qr/${encodeURIComponent(labels.body[1].qr)}`).expect(200);
    expect(byCode.body.id).toBe(byQr.body.id);
    await api(app, b).get('/sales/scan/qr/B-0001').expect(404);
  });
});
