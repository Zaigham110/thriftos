import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

/** Task 3.6: owner home — profit per container, udhaar owed, stock ready, today's sales, and the lists behind them. */
describe('Owner home (e2e)', () => {
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

  it('shows the three numbers and today, each backed by its list, for this tenant only', async () => {
    const t = a.tenantId;
    const jeans = await prisma.category.create({ data: { tenantId: t, name: 'Jeans' } });
    const shirts = await prisma.category.create({ data: { tenantId: t, name: 'Shirts' } });
    const gradeA = await prisma.grade.create({ data: { tenantId: t, name: 'A', rank: 1 } });
    const gradeB = await prisma.grade.create({ data: { tenantId: t, name: 'B', rank: 2 } });
    const katran = await prisma.wasteCategory.findFirstOrThrow({ where: { tenantId: t, name: 'Waste/Katran' } });
    const usa = await api(app, a).post('/procurement/vendors', { name: 'Global USA', originCountry: 'USA' }).expect(201);
    const korea = await api(app, a).post('/procurement/vendors', { name: 'Seoul Rags', originCountry: 'Korea' }).expect(201);
    const customer = await api(app, a).post('/customers', { name: 'Haji Rafiq', phone: '03001234567' }).expect(201);

    // Container 1 (USA): 1,000 kg for Rs 100,000 → Jeans 800 kg (200 kg waste) → A 300 / B 500 → 100 kg bale from A.
    const c1 = await api(app, a).post('/procurement/containers', { vendorId: usa.body.id, netWeightKg: 1000, purchaseCost: 100000, withLot: true }).expect(201);
    const s1 = await api(app, a).post('/sorting/stage-1/start', { ragId: c1.body.rags[0].id }).expect(201);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s1.body.session.id, categoryId: jeans.id, amountKg: 800 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${s1.body.session.id}/seal`, { wasteCategoryId: katran.id }).expect(200);
    const out1 = await prisma.categoryOutput.findFirstOrThrow({ where: { tenantId: t, containerId: c1.body.id } });
    const g1 = await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: out1.id }).expect(201);
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g1.body.session.id, gradeId: gradeA.id, amountKg: 300 }).expect(200);
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g1.body.session.id, gradeId: gradeB.id, amountKg: 500 }).expect(200);
    await api(app, a).patch(`/sorting/stage-2/${g1.body.session.id}/seal`, {}).expect(200);
    const bale1 = await api(app, a).post('/stock/bales', { categoryId: jeans.id, gradeId: gradeA.id, weightKg: 100 }).expect(201);

    // Container 2 (Korea): 500 kg for Rs 60,000 → Shirts 500 kg → 100 kg bale (one stage).
    const c2 = await api(app, a).post('/procurement/containers', { vendorId: korea.body.id, netWeightKg: 500, purchaseCost: 60000, withLot: true }).expect(201);
    const s2 = await api(app, a).post('/sorting/stage-1/start', { ragId: c2.body.rags[0].id }).expect(201);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s2.body.session.id, categoryId: shirts.id, amountKg: 500 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${s2.body.session.id}/seal`, {}).expect(200);
    const bale2 = await api(app, a).post('/stock/bales', { categoryId: shirts.id, weightKg: 100 }).expect(201);

    const item = (bale: { id: string }) => prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: bale.id } });
    // Bale 1 cost: 100,000 × 300/800 × 100/300 = 12,500 → sold on udhaar for 50,000 (profit 37,500).
    await api(app, a).post('/sales', { customerId: customer.body.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: (await item(bale1.body)).id, unit: 'BALE', quantity: 1, unitPrice: 50000 }] }).expect(201);
    // Bale 2 cost: 60,000 × 100/500 = 12,000 → sold for cash 20,000 (profit 8,000).
    await api(app, a).post('/sales', { customerId: customer.body.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: (await item(bale2.body)).id, unit: 'BALE', quantity: 1, unitPrice: 20000 }] }).expect(201);

    const home = await api(app, a).get('/home').expect(200);
    expect(home.body).toEqual({
      profitPerContainer: { average: '22750', containers: 2 }, // (37,500 + 8,000) / 2
      udhaar: { owed: '50000', customers: 1 },
      stockReady: { kg: '0', bales: '0', items: 0, value: '0' },
      today: { sales: 2, total: '70000', profit: '45500' },
    });

    const list = await api(app, a).get('/home/containers').expect(200);
    expect(list.body.containers.map((c: any) => [c.supplier, c.origin, c.kg, c.revenue, c.profit, c.yieldPercent, c.topGradePercent])).toEqual([
      ['Seoul Rags', 'Korea', '500', '20000', '8000', 100, null],
      ['Global USA', 'USA', '1000', '50000', '37500', 80, 38],
    ]);
    // Profit per kg of maal bought: USA 37,500 / 1,000 = 37.5; Korea 8,000 / 500 = 16.
    expect(list.body.bySupplier.map((s: any) => [s.name, s.profitPerKg, s.topGradePercent])).toEqual([
      ['Global USA', '37.5', 38],
      ['Seoul Rags', '16', null],
    ]);
    expect(list.body.byOrigin.map((s: any) => s.name)).toEqual(['USA', 'Korea']);

    const today = await api(app, a).get('/home/today').expect(200);
    expect(today.body).toHaveLength(2);
    expect(today.body[0].customer.name).toBe('Haji Rafiq');

    // Stock ready counts what is left: a new bought bale of 45 kg.
    await api(app, a).post('/stock/items', { name: 'Jackets', unit: 'BALE', quantity: 2, totalCost: 50000, weightKg: 90 }).expect(201);
    const stock = await api(app, a).get('/home/stock').expect(200);
    expect(stock.body).toEqual({ kg: '90', bales: '2', items: 1, value: '50000' });

    // Another tenant sees none of it.
    const other = await api(app, b).get('/home').expect(200);
    expect(other.body).toMatchObject({ profitPerContainer: { containers: 0 }, udhaar: { owed: '0' }, today: { sales: 0 } });
    expect((await api(app, b).get('/home/containers').expect(200)).body.containers).toEqual([]);
    expect((await api(app, b).get('/home/today').expect(200)).body).toEqual([]);
  });

  it('is for people who may see the numbers (REPORTS_VIEW)', async () => {
    const plain = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, plain).get('/home').expect(403);
    await api(app, plain).get('/home/containers').expect(403);
  });
});
