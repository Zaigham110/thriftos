import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, seedSortableLot, TestTenant } from './fixtures';

/**
 * Enterprise plan E3.1: containers and suppliers in the workspace — list columns worked out per page (profit,
 * yield, A grade), the container traceability page (landed cost → lots → sorting → grades → bales → sales),
 * the supplier scorecard; cost and profit only with cost.view; every endpoint per business.
 */
describe('Workspace purchasing: containers, traceability and supplier scorecard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const m = await seedSortableLot(app, a.tenantId);
    Object.assign(ids, { jeans: m.jeans.id, shirts: m.shirts.id, gradeA: m.gradeA.id, gradeB: m.gradeB.id, waste: m.waste.id, raw: m.lot.rawCategoryId! });

    // Container from a supplier: Rs 10,00,000 + Rs 1,00,000 clearing = 11,00,000 for 10,000 kg.
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Global Textile Recyclers', originCountry: 'USA' }).expect(201);
    ids.supplier = supplier.body.id;
    const container = await api(app, a).post('/procurement/containers', { vendorId: ids.supplier, containerNumber: 'MSKU-001', netWeightKg: 10000, purchaseCost: 1000000 }).expect(201);
    ids.container = container.body.id;
    await api(app, a).post(`/procurement/containers/${ids.container}/charges`, { chargeType: 'CLEARING', amount: 100000 }).expect(201);
    const lot = await api(app, a).post('/procurement/rags', { containerId: ids.container, ragBaleType: 'BALE', rawCategoryId: ids.raw, weightKg: 10000 }).expect(201);

    // Sort: Jeans 6,000 + Shirts 3,000, the other 1,000 kg is waste (no cost).
    const s1 = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.body.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s1, categoryId: ids.jeans, amountKg: 6000 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s1, categoryId: ids.shirts, amountKg: 3000 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${s1}/seal`, { wasteCategoryId: ids.waste }).expect(200);
    // Grade Jeans: A 4,000 + B 2,000.
    const jeansOut = await prisma.categoryOutput.findFirstOrThrow({ where: { tenantId: a.tenantId, containerId: ids.container, categoryId: ids.jeans } });
    const s2 = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: jeansOut.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: s2, gradeId: ids.gradeA, amountKg: 4000 }).expect(200);
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: s2, gradeId: ids.gradeB, amountKg: 2000 }).expect(200);
    await api(app, a).patch(`/sorting/stage-2/${s2}/seal`, { wasteCategoryId: ids.waste }).expect(200);
    // One 1,000 kg grade-A bale, sold as a bale for Rs 2,00,000.
    const bale = await api(app, a).post('/stock/bales', { categoryId: ids.jeans, gradeId: ids.gradeA, weightKg: 1000 }).expect(201);
    ids.bale = bale.body.id;
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: ids.bale } });
    const customer = await api(app, a).post('/customers', { name: 'Imran Landa Centre', phone: '03001239876' }).expect(201);
    const sale = await api(app, a).post('/sales', { customerId: customer.body.id, paymentMode: 'CASH', paidAmount: 200000, paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 200000 }] }).expect(201);
    ids.sale = sale.body.id;
    ids.saleNumber = sale.body.saleNumber;
  });

  afterAll(async () => {
    await app.close();
  });

  it('container overview traces landed cost to lots, sorting, grades, bales, sales and profit', async () => {
    const o = (await api(app, a).get(`/workspace/containers/${ids.container}`).expect(200)).body;
    expect(o.container).toMatchObject({ number: 'MSKU-001', supplier: { id: ids.supplier, name: 'Global Textile Recyclers' } });
    expect(o.cost).toMatchObject({ purchasePKR: '1000000', chargesTotal: '100000', landed: '1100000' });
    expect(o.cost.charges).toEqual([expect.objectContaining({ type: 'CLEARING', amount: '100000' })]);
    expect(o.lots).toEqual([expect.objectContaining({ kg: '10000', cost: '1100000' })]);
    expect(o.sorting.categories).toEqual([
      { name: 'Jeans', kg: '6000', cost: '733333.33' },
      { name: 'Shirts', kg: '3000', cost: '366666.67' },
    ]);
    expect(o.sorting).toMatchObject({ sortedKg: '9000', wasteKg: '1000', yieldPercent: 90 });
    expect(o.grades).toEqual([{ name: 'A', kg: '4000' }, { name: 'B', kg: '2000' }]);
    expect(o.topGradePercent).toBeGreaterThan(60);
    expect(o.bales).toEqual([expect.objectContaining({ id: ids.bale, category: 'Jeans', grade: 'A', kg: '1000', sold: true, costFromHere: '122222.22' })]);
    expect(o.sales).toEqual([expect.objectContaining({ id: ids.sale, number: ids.saleNumber, customer: 'Imran Landa Centre', revenue: '200000', profit: '77777.78' })]);
    expect(o.totals).toMatchObject({ kg: '10000', bales: 1, balesSold: 1, revenue: '200000', profit: '77777.78', profitPerKg: '7.78' });
  });

  it('containers and suppliers lists show profit, yield and A grade per row; cost needs cost.view', async () => {
    const list = (await api(app, a).get('/lists/containers').expect(200)).body;
    expect(list.rows).toEqual([expect.objectContaining({ id: ids.container, number: 'MSKU-001', supplier: 'Global Textile Recyclers', origin: 'USA', status: 'IN_TRANSIT', landedCost: '1100000', revenue: '200000', profit: '77777.78', yield: 90 })]);
    expect(list.totals).toEqual({ kg: '10000', landedCost: '1100000' });
    await api(app, a).get('/lists/containers?sort=profit:desc').expect(400);
    await api(app, a).get('/lists/containers?f=yield:gt:50').expect(400);
    const grouped = (await api(app, a).get('/lists/containers?groupBy=supplierId').expect(200)).body;
    expect(grouped.groups).toEqual([expect.objectContaining({ label: 'Global Textile Recyclers', count: 1 })]);

    const sup = (await api(app, a).get('/lists/suppliers').expect(200)).body;
    expect(sup.rows).toEqual([expect.objectContaining({ id: ids.supplier, name: 'Global Textile Recyclers', containers: 1, kg: '10000', profit: '77777.78', profitPerKg: '7.78', yield: 90 })]);

    const card = (await api(app, a).get(`/workspace/suppliers/${ids.supplier}`).expect(200)).body;
    expect(card.totals).toMatchObject({ containers: 1, kg: '10000', landed: '1100000', revenue: '200000', profit: '77777.78', profitPerKg: '7.78', yieldPercent: 90 });
    expect(card.containers).toEqual([expect.objectContaining({ id: ids.container, profit: '77777.78' })]);
  });

  it('without cost.view: no landed cost, charges or profit anywhere; without container.read: no page', async () => {
    const viewer = await createUserWithoutPermissions(app, a.tenantId);
    // container.read and vendor.read only (no cost.view).
    const role = await prisma.role.create({ data: { tenantId: a.tenantId, name: `Viewer ${Date.now()}` } });
    const perms = await prisma.permission.findMany({ where: { code: { in: ['container.read', 'vendor.read'] } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    await prisma.userRole.create({ data: { userId: viewer.userId, roleId: role.id } });

    const o = (await api(app, viewer).get(`/workspace/containers/${ids.container}`).expect(200)).body;
    expect(o.cost).toBeNull();
    expect(o.totals.profit).toBeNull();
    expect(o.sales[0].profit).toBeNull();
    expect(o.lots[0].cost).toBeNull();
    expect(o.bales[0].costFromHere).toBeNull();
    const row = (await api(app, viewer).get('/lists/containers').expect(200)).body.rows[0];
    expect(row).not.toHaveProperty('landedCost');
    expect(row).not.toHaveProperty('profit');
    expect((await api(app, viewer).get(`/workspace/suppliers/${ids.supplier}`).expect(200)).body.totals.profit).toBeNull();

    const nobody = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, nobody).get(`/workspace/containers/${ids.container}`).expect(403);
    await api(app, nobody).get('/lists/containers').expect(403);
  });

  it('another business sees nothing', async () => {
    await api(app, b).get(`/workspace/containers/${ids.container}`).expect(404);
    await api(app, b).get(`/workspace/suppliers/${ids.supplier}`).expect(404);
    expect((await api(app, b).get('/lists/containers').expect(200)).body.rows).toEqual([]);
    expect((await api(app, b).get('/lists/suppliers').expect(200)).body.rows).toEqual([]);
  });
});
