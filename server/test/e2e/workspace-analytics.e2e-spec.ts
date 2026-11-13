import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, seedSortableLot, TestTenant } from './fixtures';

/**
 * Enterprise plan E4: owner dashboard, supplier & origin scorecard, sales analytics, sorting and stock ageing
 * additions. Acceptance: the numbers match the lists and other screens for the same period, and each answer
 * comes back well under 2 s.
 */
describe('Workspace dashboards and analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const ids: Record<string, string> = {};

  const timed = async (url: string, who = a) => {
    const t = Date.now();
    const res = await api(app, who).get(url).expect(200);
    expect(Date.now() - t).toBeLessThan(2000);
    return res.body;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const m = await seedSortableLot(app, a.tenantId);

    // Two suppliers' containers, each 1,000 kg for Rs 1,00,000, sorted and graded, one A bale sold from each.
    async function chain(supplier: string, country: string, number: string, jeansKg: number, price: number, customerId: string) {
      const v = (await api(app, a).post('/procurement/vendors', { name: supplier, originCountry: country }).expect(201)).body;
      const c = (await api(app, a).post('/procurement/containers', { vendorId: v.id, containerNumber: number, netWeightKg: 1000, purchaseCost: 100000 }).expect(201)).body;
      const lot = (await api(app, a).post('/procurement/rags', { containerId: c.id, ragBaleType: 'BALE', rawCategoryId: m.lot.rawCategoryId, weightKg: 1000 }).expect(201)).body;
      const s1 = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session.id;
      await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s1, categoryId: m.jeans.id, amountKg: jeansKg }).expect(200);
      await api(app, a).patch(`/sorting/stage-1/${s1}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
      const out = await prisma.categoryOutput.findFirstOrThrow({ where: { tenantId: a.tenantId, containerId: c.id } });
      const s2 = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: out.id }).expect(201)).body.session.id;
      await api(app, a).post('/sorting/stage-2/allocate', { sessionId: s2, gradeId: m.gradeA.id, amountKg: jeansKg }).expect(200);
      await api(app, a).patch(`/sorting/stage-2/${s2}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
      const bale = (await api(app, a).post('/stock/bales', { categoryId: m.jeans.id, gradeId: m.gradeA.id, weightKg: 100 }).expect(201)).body;
      const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: bale.id } });
      await api(app, a).post('/sales', { customerId, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: price }] }).expect(201);
      return c.id;
    }
    ids.rafiq = (await api(app, a).post('/customers', { name: 'Haji Rafiq Traders', phone: '03001112233', city: 'Lahore' }).expect(201)).body.id;
    ids.imran = (await api(app, a).post('/customers', { name: 'Imran Landa Centre', phone: '03001239876', city: 'Karachi' }).expect(201)).body.id;
    ids.usa = await chain('Global Textile Recyclers', 'USA', 'MSKU-401', 900, 30000, ids.rafiq);
    ids.canada = await chain('Atlantic Rags', 'Canada', 'TGHU-402', 700, 18000, ids.imran);
    await api(app, a).post('/khata/payments', { customerId: ids.rafiq, amount: 10000, method: 'JAZZCASH' }).expect(201);
    await api(app, a).post('/workspace/expenses', { category: 'RENT', amount: 5000 }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('dashboard: sales, margin, cash, udhaar, stock and containers match their own screens', async () => {
    const d = await timed('/workspace/dashboard');
    const sales = (await api(app, a).get(`/lists/sales?f=date:between:${d.period.from}..${d.period.to}`).expect(200)).body;
    expect(d.sales).toMatchObject({ count: 2, revenue: sales.totals.total, grossProfit: sales.totals.profit });
    expect(d.sales.revenue).toBe('48000');
    expect(d.sales.trend.by).toBe('day');
    expect(d.sales.trend.points.reduce((t: number, p: { revenue: string }) => t + Number(p.revenue), 0)).toBe(48000);
    const book = (await api(app, a).get('/workspace/finance/book?method=JAZZCASH').expect(200)).body;
    expect(d.cash.collected).toBe(book.in);
    const rec = (await api(app, a).get('/workspace/receivables').expect(200)).body;
    expect(d.udhaar).toMatchObject({ owed: rec.totals.owed, customers: 2 });
    expect(d.udhaar.owed).toBe('38000');
    const stock = (await api(app, a).get('/workspace/stock/summary').expect(200)).body;
    expect(d.stock).toMatchObject({ items: stock.total.items, value: stock.total.value });
    expect(d.containers.count).toBe(2);
    expect(d.expenses).toMatchObject({ total: '5000' });
    expect(Number(d.expenses.netProfit)).toBe(Number(d.sales.grossProfit) - 5000);
    expect(d.today).toMatchObject({ sales: 2, revenue: '48000' });
    expect(d.activity.length).toBeGreaterThan(0);
    expect(d.activity[0]).toHaveProperty('action');
    // A longer period trends by month.
    expect((await timed('/workspace/dashboard?from=2026-01-01&to=2026-12-31')).sales.trend.by).toBe('month');
  });

  it('supplier & origin scorecard: ranked by profit per kg, with sorted % and A grade', async () => {
    const s = await timed('/workspace/analytics/suppliers');
    expect(s.rows.map((r: { key: string; rank: number }) => [r.rank, r.key])).toEqual([[1, 'Global Textile Recyclers'], [2, 'Atlantic Rags'], [3, '']]); // last: the loose lot bought without a supplier
    // Bales are made first-in first-out, so both sold bales came from the first (USA) container.
    expect(s.rows[0]).toMatchObject({ containers: 1, yieldPercent: 90, topGradePercent: 100, revenue: '48000' });
    expect(s.rows[1]).toMatchObject({ yieldPercent: 70, revenue: '0' });
    const supplier = (await api(app, a).get(`/workspace/suppliers/${s.rows[0].id}`).expect(200)).body;
    expect(s.rows[0].profitPerKg).toBe(supplier.totals.profitPerKg);
    const byOrigin = await timed('/workspace/analytics/suppliers?by=origin');
    expect(byOrigin.rows.map((r: { key: string }) => r.key)).toEqual(['USA', 'Canada', '']);
    expect((await timed('/workspace/analytics/suppliers?from=2020-01-01&to=2020-12-31')).rows).toEqual([]);
  });

  it('sales analytics: by customer, category, grade, city and month add up to the sales list; price per kg by grade', async () => {
    const list = (await api(app, a).get('/lists/sales').expect(200)).body;
    for (const by of ['customer', 'category', 'grade', 'city', 'month']) {
      const r = await timed(`/workspace/analytics/sales?by=${by}`);
      expect(r.totals.revenue).toBe(list.totals.total);
      expect(r.rows.reduce((t: number, x: { revenue: string }) => t + Number(x.revenue), 0)).toBe(Number(list.totals.total));
    }
    const byCustomer = await timed('/workspace/analytics/sales?by=customer');
    expect(byCustomer.rows[0]).toMatchObject({ key: 'Haji Rafiq Traders', revenue: '30000', sales: 1, kg: '100', perKg: '300', sharePercent: 63 });
    expect(byCustomer.topCustomers.map((c: { name: string }) => c.name)).toEqual(['Haji Rafiq Traders', 'Imran Landa Centre']);
    const byGrade = await timed('/workspace/analytics/sales?by=grade');
    expect(byGrade.rows).toEqual([expect.objectContaining({ key: 'A', revenue: '48000', kg: '200' })]);
    expect(byGrade.priceTrend.grades).toEqual([{ grade: 'A', points: [expect.objectContaining({ perKg: '240' })] }]);
    await api(app, a).get('/workspace/analytics/sales?by=colour').expect(400);
  });

  it('sorting yield has waste by type and a monthly trend; stock ageing by category', async () => {
    const y = await timed('/workspace/sorting/yield');
    expect(y.trend).toEqual([expect.objectContaining({ inputKg: '2000', outputKg: '1600', yieldPercent: 80 })]);
    expect(y.waste.reduce((t: number, w: { kg: string; stage: string }) => t + (w.stage === 'STAGE_1' ? Number(w.kg) : 0), 0)).toBe(400);
    // One bale still in stock (both sold bales are gone from the stock summary).
    const cat = await prisma.category.findFirstOrThrow({ where: { tenantId: a.tenantId, name: 'Jeans' } });
    const gradeA = await prisma.grade.findFirstOrThrow({ where: { tenantId: a.tenantId, name: 'A' } });
    await api(app, a).post('/stock/bales', { categoryId: cat.id, gradeId: gradeA.id, weightKg: 50 }).expect(201);
    const st = await timed('/workspace/stock/summary');
    const jeans = st.ageByCategory.find((c: { name: string }) => c.name === 'Jeans');
    expect(jeans.buckets['0-30'].kg).not.toBe('0');
    expect(jeans.buckets['90+']).toMatchObject({ kg: '0' });
  });

  it('cost and profit need cost.view; dashboards need REPORTS_VIEW; another business sees nothing', async () => {
    const viewer = await createUserWithoutPermissions(app, a.tenantId);
    const role = await prisma.role.create({ data: { tenantId: a.tenantId, name: `Reports ${Date.now()}` } });
    const perm = await prisma.permission.findFirstOrThrow({ where: { code: 'REPORTS_VIEW' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: viewer.userId, roleId: role.id } });
    const d = await timed('/workspace/dashboard', viewer);
    expect(d.sales.grossProfit).toBeNull();
    expect(d.expenses).toBeNull();
    expect(d.stock.value).toBeNull();
    expect((await timed('/workspace/analytics/suppliers', viewer)).rows[0].profitPerKg).toBeNull();
    expect((await timed('/workspace/analytics/sales', viewer)).totals.profit).toBeNull();

    const nobody = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, nobody).get('/workspace/dashboard').expect(403);
    await api(app, nobody).get('/workspace/analytics/sales').expect(403);

    const other = await timed('/workspace/dashboard', b);
    expect(other.sales).toMatchObject({ count: 0, revenue: '0' });
    expect(other.containers.count).toBe(0);
    expect((await timed('/workspace/analytics/suppliers', b)).rows).toEqual([]);
    expect((await timed('/workspace/analytics/sales', b)).rows).toEqual([]);
  });
});
