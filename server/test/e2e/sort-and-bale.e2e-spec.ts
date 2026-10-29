import { INestApplication } from '@nestjs/common';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

describe('Sorting → bale (merged sorting + stock modules)', () => {
  let app: INestApplication;
  let owner: TestTenant;
  let other: TestTenant;
  let data: Awaited<ReturnType<typeof seedSortableLot>>;
  let baleId: string;
  let sortSessionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await createTenantWithOwner(app);
    other = await createTenantWithOwner(app);
    data = await seedSortableLot(app, owner.tenantId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sorts a lot into categories, booking the remainder as waste on close', async () => {
    const queue = await api(app, owner).get('/sorting/stage-1/queue').expect(200);
    expect(queue.body.data.map((l: any) => l.id)).toContain(data.lot.id);

    const started = await api(app, owner).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201);
    sortSessionId = started.body.session.id;

    await api(app, owner)
      .post('/sorting/stage-1/allocate', { sessionId: sortSessionId, categoryId: data.jeans.id, amountKg: 50 })
      .expect(200);
    const second = await api(app, owner)
      .post('/sorting/stage-1/allocate', { sessionId: sortSessionId, categoryId: data.jeans.id, amountKg: 10 })
      .expect(200);
    expect(second.body.buckets).toHaveLength(1);
    expect(Number(second.body.buckets[0].outputWeightKg)).toBe(60);

    await api(app, owner)
      .post('/sorting/stage-1/allocate', { sessionId: sortSessionId, categoryId: data.shirts.id, amountKg: 30 })
      .expect(200);

    const closed = await api(app, owner)
      .patch(`/sorting/stage-1/${sortSessionId}/seal`, { wasteCategoryId: data.waste.id })
      .expect(200);
    expect(closed.body.session.status).toBe('CLOSED');
    expect(Number(closed.body.wasteLineItems[0].amount)).toBe(10);
  });

  it('rejects more kg than the lot has left, without saving it', async () => {
    const lot2 = await seedSortableLot(app, owner.tenantId);
    const started = await api(app, owner).post('/sorting/stage-1/start', { ragId: lot2.lot.id }).expect(201);
    const sessionId = started.body.session.id;

    const res = await api(app, owner)
      .post('/sorting/stage-1/allocate', { sessionId, categoryId: lot2.jeans.id, amountKg: 101 })
      .expect(400);
    expect(res.body.message).toContain('100.00 kg');

    const summary = await api(app, owner).get(`/sorting/stage-1/sessions/${sessionId}`).expect(200);
    expect(summary.body.buckets).toHaveLength(0);
  });

  it('grades a category output and makes a FIFO bale costed from it', async () => {
    const queue = await api(app, owner).get('/sorting/stage-2/queue').expect(200);
    const jeansOutput = queue.body.data.find((o: any) => o.categoryId === data.jeans.id && o.sortSessionId === sortSessionId);
    expect(jeansOutput).toBeDefined();
    // 60 kg of 90 kg output carries 60/90 of Rs 50,000.
    expect(Number(jeansOutput.allocatedCost)).toBeCloseTo(33333.33, 2);

    const started = await api(app, owner).post('/sorting/stage-2/start', { categoryOutputId: jeansOutput.id }).expect(201);
    const gradeSessionId = started.body.session.id;
    await api(app, owner)
      .post('/sorting/stage-2/allocate', { sessionId: gradeSessionId, gradeId: data.gradeA.id, amountKg: 40 })
      .expect(200);
    await api(app, owner)
      .post('/sorting/stage-2/allocate', { sessionId: gradeSessionId, gradeId: data.gradeB.id, amountKg: 20 })
      .expect(200);
    await api(app, owner).patch(`/sorting/stage-2/${gradeSessionId}/seal`, {}).expect(200);

    const available = await api(app, owner)
      .get(`/stock/bales/available-stock?categoryId=${data.jeans.id}&gradeId=${data.gradeA.id}`)
      .expect(200);
    expect(available.body).toHaveLength(1);
    expect(Number(available.body[0].remainingAmount)).toBe(40);

    const bale = await api(app, owner)
      .post('/stock/bales', { categoryId: data.jeans.id, gradeId: data.gradeA.id, weightKg: 25 })
      .expect(201);
    baleId = bale.body.id;
    expect(bale.body.status).toBe('SEALED');
    expect(bale.body.qrLabel.qrCode).toContain(bale.body.unitCode);
    expect(bale.body.inventoryItems).toHaveLength(1);
    // Grade A carries 40/60 of the jeans cost; the bale takes 25 of those 40 kg.
    const gradeACost = (33333.33 * 40) / 60;
    expect(Number(bale.body.totalCost)).toBeCloseTo((gradeACost * 25) / 40, 0);

    const after = await api(app, owner)
      .get(`/stock/bales/available-stock?categoryId=${data.jeans.id}&gradeId=${data.gradeA.id}`)
      .expect(200);
    expect(Number(after.body[0].remainingAmount)).toBe(15);

    const tooBig = await api(app, owner)
      .post('/stock/bales', { categoryId: data.jeans.id, gradeId: data.gradeA.id, weightKg: 16 })
      .expect(400);
    expect(tooBig.body.message).toContain('15.00 kg');

    const items = await api(app, owner).get('/stock/items').expect(200);
    expect(JSON.stringify(items.body)).toContain(baleId);

    await api(app, owner).get(`/stock/bales/${baleId}/qr`).expect(200);
  });

  it("hides one tenant's sorting and stock from another tenant", async () => {
    await api(app, other).get(`/stock/bales/${baleId}`).expect(404);
    await api(app, other).get(`/stock/bales/${baleId}/qr`).expect(404);
    await api(app, other).get(`/sorting/stage-1/sessions/${sortSessionId}`).expect(404);

    const bales = await api(app, other).get('/stock/bales').expect(200);
    expect(bales.body).toHaveLength(0);
    const items = await api(app, other).get('/stock/items').expect(200);
    expect(JSON.stringify(items.body)).not.toContain(baleId);
    const stage1 = await api(app, other).get('/sorting/stage-1/queue').expect(200);
    expect(stage1.body.data).toHaveLength(0);
    const stage2 = await api(app, other).get('/sorting/stage-2/queue').expect(200);
    expect(stage2.body.data).toHaveLength(0);
    const available = await api(app, other).get('/stock/bales/available-stock').expect(200);
    expect(available.body).toHaveLength(0);

    await api(app, other)
      .post('/sorting/stage-1/start', { ragId: data.lot.id })
      .expect(400);
    await api(app, other)
      .post('/stock/bales', { categoryId: data.jeans.id, gradeId: data.gradeA.id, weightKg: 1 })
      .expect(400);
  });
});
