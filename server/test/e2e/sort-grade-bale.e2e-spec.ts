import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * v2 6.6: sort, grade and bale in one step. A lot (gaari) stays open for days; each entry is a category + grade with
 * bales (straight into stock) or loose kg (usable at once). Closing books the rest as kat — into stock to sell at no
 * cost — and shares the lot cost over what came out.
 */
describe('Sort, grade and bale in one step (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let data: Awaited<ReturnType<typeof seedSortableLot>>;
  let sessionId: string;
  let soldBaleId: string;
  let keptBaleId: string;
  let katId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    data = await seedSortableLot(app, a.tenantId); // 100 kg costing Rs 50,000 → Rs 500 a kg
    sessionId = (await api(app, a).post('/sorting/stage-1/start', { ragId: data.lot.id }).expect(201)).body.session.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('bales entered while sorting go straight into stock, graded, costed at the lot cost per kg', async () => {
    const res = await api(app, a)
      .post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, gradeId: data.gradeA.id, bales: 2, baleWeightKg: 20 })
      .expect(200);
    expect(res.body.baleIds).toHaveLength(2);
    expect(res.body.kinds).toEqual([expect.objectContaining({ categoryId: data.jeans.id, gradeId: data.gradeA.id, gradeName: 'A', kg: '40', bales: 2, todayKg: '40', todayBales: 2 })]);
    expect(res.body.today).toEqual({ kg: '40', bales: 2, pieces: 0 });

    const items = await prisma.inventoryItem.findMany({ where: { tenantId: a.tenantId, repackUnitId: { in: res.body.baleIds } } });
    expect(items).toHaveLength(2);
    for (const i of items) expect(i).toMatchObject({ unit: 'BALE', gradeId: data.gradeA.id, categoryId: data.jeans.id, status: 'AVAILABLE' });
    expect(items.map((i) => i.totalCost.toString())).toEqual(['10000', '10000']); // 20 kg × Rs 500
    expect(await prisma.qRLabel.count({ where: { repackUnitId: { in: res.body.baleIds } } })).toBe(2);
    [soldBaleId, keptBaleId] = res.body.baleIds;
  });

  it('loose kg is ready for Make bale before the lot is closed', async () => {
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.shirts.id, gradeId: data.gradeB.id, amountKg: 30 }).expect(200);
    const kinds = (await api(app, a).get('/stock/bales/kinds').expect(200)).body;
    expect(kinds).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: data.shirts.id, gradeId: data.gradeB.id, availableKg: '30' })]));
    // The jeans bales took all of their kg: nothing loose left of that kind.
    expect(kinds.find((k: any) => k.categoryId === data.jeans.id)).toBeUndefined();
    const bale = await api(app, a).post('/stock/bales', { categoryId: data.shirts.id, gradeId: data.gradeB.id, weightKg: 30 }).expect(201);
    expect(bale.body).toMatchObject({ weightKg: '30' });

    // That kg is baled now, so the entry cannot be taken back.
    await api(app, a).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.shirts.id, gradeId: data.gradeB.id, amountKg: 30 }).expect(409);
  });

  it('undo takes back an unused entry, bales included', async () => {
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, gradeId: data.gradeB.id, bales: 1, baleWeightKg: 10 }).expect(200);
    const undone = await api(app, a).post('/sorting/stage-1/unallocate', { sessionId, categoryId: data.jeans.id, gradeId: data.gradeB.id, bales: 1, baleWeightKg: 10 }).expect(200);
    expect(undone.body.kinds.find((k: any) => k.categoryId === data.jeans.id && k.gradeId === data.gradeB.id)).toBeUndefined();
    expect(undone.body.session.totalOutputWeight).toBe('70');
    expect(await prisma.inventoryItem.count({ where: { tenantId: a.tenantId, categoryId: data.jeans.id, gradeId: data.gradeB.id } })).toBe(0);
    // More than the lot holds is refused.
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, gradeId: data.gradeA.id, bales: 2, baleWeightKg: 20 }).expect(400);
  });

  it('closing books the rest as kat into stock, and shares the lot cost over what came out', async () => {
    // A bale sold before the lot was closed keeps the cost it was sold at.
    const customer = (await api(app, a).post('/customers', { name: 'Early Buyer', phone: '0321 5550001' }).expect(201)).body;
    const soldItem = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: soldBaleId } });
    await api(app, a).post('/sales', { customerId: customer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: soldItem.id, quantity: 1, unitPrice: 16000 }] }).expect(201);

    const closed = await api(app, a).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: data.waste.id }).expect(200);
    expect(closed.body.session.status).toBe('CLOSED');
    expect(closed.body.kat).toMatchObject({ kg: '30', leftKg: '30', name: expect.stringMatching(/^Katran · LOT-/) });
    katId = closed.body.kat.id;
    expect(closed.body.outputs.map((o: any) => [o.name, o.weightKg, o.bales])).toEqual([
      ['Jeans · A', '40', 2],
      ['Shirts · B', '30', 1], // baled from its loose kg before the close
    ]);

    const kat = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: katId } });
    expect(kat).toMatchObject({ source: 'KAT', unit: 'KG', ragId: data.lot.id, status: 'AVAILABLE' });
    expect(kat.totalCost.toString()).toBe('0');

    // Rs 50,000 over the 70 kg that came out: the two 20 kg bales share Rs 28,571.43 (to the paisa).
    const kept = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: keptBaleId } });
    const sold = await prisma.repackUnit.findUniqueOrThrow({ where: { id: soldBaleId } });
    expect(kept.totalCost.add(sold.totalCost).toString()).toBe('28571.43');
    expect(['14285.71', '14285.72']).toContain(kept.totalCost.toString());
    const outputs = await prisma.categoryOutput.aggregate({ where: { tenantId: a.tenantId, ragId: data.lot.id }, _sum: { allocatedCost: true } });
    expect(outputs._sum.allocatedCost!.toString()).toBe('50000');
    // The sold one is reported as a cost adjustment; its sale keeps the cost it was sold at.
    const adjustment = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'COST_ADJUSTMENT', entityId: soldBaleId } });
    expect(adjustment.metadataJson).toMatchObject({ previousCost: '10000.00', newCost: sold.totalCost.toFixed(2) });
    const line = await prisma.saleLine.findFirstOrThrow({ where: { inventoryItemId: soldItem.id } });
    expect(line.lineCost.toString()).toBe('10000');
  });

  it('kat sells by kg at no cost, and what is left can be thrown away', async () => {
    const customer = (await api(app, a).post('/customers', { name: 'Kat Buyer', phone: '0321 5550002' }).expect(201)).body;
    const sale = await api(app, a).post('/sales', { customerId: customer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: katId, quantity: 10, unitPrice: 40 }] }).expect(201);
    expect(sale.body.totalAmount).toBe('400');
    expect(sale.body.totalProfit).toBe('400');

    const thrown = await api(app, a).post(`/sorting/stage-1/kat/${katId}/throw-away`).expect(200);
    expect(thrown.body.thrownAwayKg).toBe('20');
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: katId } })).toMatchObject({ status: 'SOLD' });
    await api(app, a).post(`/sorting/stage-1/kat/${katId}/throw-away`).expect(409);
    expect(await prisma.auditLog.count({ where: { tenantId: a.tenantId, action: 'KAT_THROWN_AWAY', entityId: katId } })).toBe(1);
  });

  it('keeps businesses apart', async () => {
    await api(app, b).post('/sorting/stage-1/allocate', { sessionId, categoryId: data.jeans.id, amountKg: 1 }).expect((r) => expect([400, 404]).toContain(r.status));
    await api(app, b).post(`/sorting/stage-1/kat/${katId}/throw-away`).expect(404);
    const other = await seedSortableLot(app, b.tenantId);
    const bSession = (await api(app, b).post('/sorting/stage-1/start', { ragId: other.lot.id }).expect(201)).body.session.id;
    // Another business's category or grade cannot be used.
    await api(app, b).post('/sorting/stage-1/allocate', { sessionId: bSession, categoryId: data.jeans.id, amountKg: 5 }).expect(400);
    await api(app, b).post('/sorting/stage-1/allocate', { sessionId: bSession, categoryId: other.jeans.id, gradeId: data.gradeA.id, amountKg: 5 }).expect(400);
    expect((await api(app, b).get('/stock/bales/kinds').expect(200)).body).toEqual([]);
  });

  it('a category remembers its usual bale weight', async () => {
    await api(app, a).patch(`/admin/categories/${data.jeans.id}`, { baleWeightKg: 45 }).expect(200);
    const list = (await api(app, a).get('/tenant/categories').expect(200)).body;
    expect(list.find((c: any) => c.id === data.jeans.id).baleWeightKg).toBe('45');
    await api(app, a).patch(`/admin/categories/${data.jeans.id}`, { baleWeightKg: null }).expect(200);
    await api(app, a).patch(`/admin/categories/${data.jeans.id}`, { baleWeightKg: 0 }).expect(400);
  });

  it('graded-while-sorting outputs are not offered for separate grading', async () => {
    const queue = (await api(app, a).get('/sorting/stage-2/queue').expect(200)).body;
    const rows = queue.data ?? queue;
    expect(rows.filter((r: any) => r.rag?.id === data.lot.id || r.ragId === data.lot.id)).toEqual([]);
  });

  it("the vendor's week: grade optional while sorting, bales made from sorted kg while the gaari is still open, sold at once", async () => {
    const prisma_ = prisma;
    const lot = await prisma_.rag.create({ data: { tenantId: a.tenantId, ragCode: `GAARI-${Date.now().toString().slice(-6)}`, ragBaleType: 'BALE', weightKg: 1000, allocatedCost: 300000, sourceType: 'LOOSE_BALE' } });
    const blanket = await prisma_.category.create({ data: { tenantId: a.tenantId, name: `Baby blanket ${Date.now()}`, baleWeightKg: 40 } });
    const children = await prisma_.category.create({ data: { tenantId: a.tenantId, name: `Children mix ${Date.now()}` } });
    const s = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session.id;

    // 5 Nov: 200 kg baby blanket, sorted without a grade. 6 Nov: 60 kg more, and 512 kg children.
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: blanket.id, amountKg: 200 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: blanket.id, amountKg: 60 }).expect(200);
    const sorted = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: children.id, amountKg: 512 }).expect(200)).body;
    expect(sorted.session.totalOutputWeight).toBe('772');
    expect(sorted.ready.map((r: any) => [r.categoryId, r.gradeId, r.availableKg])).toEqual(
      expect.arrayContaining([[blanket.id, null, '260'], [children.id, null, '512']]),
    );

    // While 228 kg is still waiting: 5 bales of 40 kg baby blanket, graded A as they are baled; 12 of children.
    const baby = await api(app, a).post('/stock/bales', { categoryId: blanket.id, gradeId: data.gradeA.id, fromUngraded: true, ragId: lot.id, count: 5, weightKg: 40 }).expect(201);
    expect(baby.body.baleIds).toHaveLength(5);
    const kids = await api(app, a).post('/stock/bales', { categoryId: children.id, fromUngraded: true, ragId: lot.id, count: 12, weightKg: 40 }).expect(201);
    expect(kids.body.baleIds).toHaveLength(12);
    // Not more than this gaari has sorted.
    await api(app, a).post('/stock/bales', { categoryId: children.id, fromUngraded: true, ragId: lot.id, count: 1, weightKg: 40 }).expect(400);

    const items = await prisma_.inventoryItem.findMany({ where: { tenantId: a.tenantId, repackUnitId: { in: baby.body.baleIds } } });
    expect(items.map((i) => [i.gradeId, i.categoryId, i.status, i.totalCost.toString()])).toEqual(Array(5).fill([data.gradeA.id, blanket.id, 'AVAILABLE', '12000'])); // 40 kg × Rs 300

    const summary = (await api(app, a).get(`/sorting/stage-1/sessions/${s}`).expect(200)).body;
    expect(summary.session.status).toBe('OPEN');
    expect(summary.bales).toBe(17);
    expect(summary.today.bales).toBe(17);
    expect(summary.ready.map((r: any) => [r.categoryId, r.availableKg])).toEqual(expect.arrayContaining([[blanket.id, '60'], [children.id, '32']]));
    expect(summary.madeBales).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: blanket.id, gradeId: data.gradeA.id, bales: 5, kg: '200' }), expect.objectContaining({ categoryId: children.id, gradeId: null, bales: 12, kg: '480' })]));
    expect(summary.kinds.find((k: any) => k.categoryId === blanket.id)).toMatchObject({ kg: '260', bales: 5 });
    expect((await prisma_.rag.findUniqueOrThrow({ where: { id: lot.id } })).status).toBe('IN_SORTING');

    // A bale sells while the gaari is still being sorted.
    const customer = (await api(app, a).post('/customers', { name: 'Week Buyer', phone: '0321 5550009' }).expect(201)).body;
    await api(app, a).post('/sales', { customerId: customer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: items[0].id, quantity: 1, unitPrice: 15000 }] }).expect(201);

    // Another business cannot bale this gaari's kg.
    await api(app, b).post('/stock/bales', { categoryId: children.id, fromUngraded: true, ragId: lot.id, weightKg: 10 }).expect(400);
  });
});
