import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, seedSortableLot, TestTenant } from './fixtures';

/**
 * Enterprise plan E3.3: stock list (left, value, age), a stock item's record with its lineage back to the
 * container, stock ageing and valuation, stock counts that change the books only when approved (cost written
 * off by position so the cost chain still adds up), godown transfers; all per business.
 */
describe('Workspace inventory: stock list, lineage, ageing, counts with approval, transfers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const ids: Record<string, string> = {};

  const costChain = async () =>
    (await prisma.$queryRawUnsafe<unknown[]>(fs.readFileSync(path.resolve(__dirname, '../../../prisma/checks/cost-chain-check.sql'), 'utf8'))).filter(
      (r) => (r as { tenantId: string }).tenantId === a.tenantId,
    );

  /** A user with exactly these permission codes. */
  async function userWith(codes: string[]): Promise<TestTenant> {
    const u = await createUserWithoutPermissions(app, a.tenantId);
    const role = await prisma.role.create({ data: { tenantId: a.tenantId, name: `Role ${Date.now()}-${Math.random()}` } });
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    await prisma.userRole.create({ data: { userId: u.userId, roleId: role.id } });
    return u;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const m = await seedSortableLot(app, a.tenantId);
    // Container → lot → Jeans → grade A → one 500 kg bale.
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Global Textile Recyclers', originCountry: 'USA' }).expect(201);
    const container = await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, containerNumber: 'MSKU-200', netWeightKg: 1000, purchaseCost: 100000 }).expect(201);
    ids.container = container.body.id;
    const lot = await api(app, a).post('/procurement/rags', { containerId: ids.container, ragBaleType: 'BALE', rawCategoryId: m.lot.rawCategoryId, weightKg: 1000 }).expect(201);
    ids.lot = lot.body.id;
    const s1 = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.body.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s1, categoryId: m.jeans.id, amountKg: 1000 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${s1}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
    const out = await prisma.categoryOutput.findFirstOrThrow({ where: { tenantId: a.tenantId, containerId: ids.container } });
    const s2 = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: out.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: s2, gradeId: m.gradeA.id, amountKg: 1000 }).expect(200);
    await api(app, a).patch(`/sorting/stage-2/${s2}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
    const bale = await api(app, a).post('/stock/bales', { categoryId: m.jeans.id, gradeId: m.gradeA.id, weightKg: 500 }).expect(201);
    ids.bale = (await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: bale.body.id } })).id;
    ids.baleCode = bale.body.unitCode;
    // Bought stock: 10 pieces for Rs 1,000; 3 sold.
    const tops = await api(app, a).post('/stock/items', { name: 'Ladies tops', unit: 'PIECE', quantity: 10, totalCost: 1000 }).expect(201);
    ids.tops = tops.body.id;
    const customer = await api(app, a).post('/customers', { name: 'Shabbir Cloth House', phone: '03004567123' }).expect(201);
    ids.customer = customer.body.id;
    await api(app, a).post('/sales', { customerId: ids.customer, paymentMode: 'CASH', paidAmount: 600, paymentMethod: 'CASH', lines: [{ inventoryItemId: ids.tops, unit: 'PIECE', quantity: 3, unitPrice: 200 }] }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('stock list: what is left, its value and age; grouped by category; cost only with cost.view', async () => {
    const list = (await api(app, a).get('/lists/stock?sort=name:asc').expect(200)).body;
    const tops = list.rows.find((r: { id: string }) => r.id === ids.tops);
    expect(tops).toMatchObject({ name: 'Ladies tops', unit: 'PIECE', quantity: '10', left: '7', cost: '1000', value: '700', age: 0, source: 'PURCHASED' });
    const bale = list.rows.find((r: { id: string }) => r.id === ids.bale);
    expect(bale).toMatchObject({ code: ids.baleCode, category: 'Jeans', grade: 'A', left: '1', value: '50000' });
    const grouped = (await api(app, a).get('/lists/stock?groupBy=categoryId').expect(200)).body;
    expect(grouped.groups).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Jeans', count: 1 })]));
    await api(app, a).get('/lists/stock?sort=value:desc').expect(400);

    const viewer = await userWith(['INVENTORY_VIEW']);
    const row = (await api(app, viewer).get('/lists/stock').expect(200)).body.rows[0];
    expect(row).not.toHaveProperty('cost');
    expect(row).not.toHaveProperty('value');
    expect((await api(app, viewer).get(`/workspace/stock/${ids.bale}`).expect(200)).body.cost).toBeNull();
    await api(app, await createUserWithoutPermissions(app, a.tenantId)).get('/lists/stock').expect(403);
  });

  it('stock record: lineage back to container and lot, sales, QR; ageing and valuation', async () => {
    const r = (await api(app, a).get(`/workspace/stock/${ids.bale}`).expect(200)).body;
    expect(r.item).toMatchObject({ code: ids.baleCode, unit: 'BALE', left: '1', leftKg: '500', category: { name: 'Jeans' }, grade: { name: 'A' } });
    expect(r.item.qrCode).toBeTruthy();
    expect(r.lineage).toEqual([expect.objectContaining({ container: { id: ids.container, number: 'MSKU-200' }, supplier: expect.objectContaining({ name: 'Global Textile Recyclers' }), lot: expect.objectContaining({ id: ids.lot }), category: 'Jeans', grade: 'A', amount: '500', cost: '50000' })]);
    expect(r.cost).toMatchObject({ total: '50000', valueLeft: '50000' });

    const tops = (await api(app, a).get(`/workspace/stock/${ids.tops}`).expect(200)).body;
    expect(tops.sales).toEqual([expect.objectContaining({ customer: 'Shabbir Cloth House', quantity: '3', total: '600', cost: '300', profit: '300' })]);

    const s = (await api(app, a).get('/workspace/stock/summary').expect(200)).body;
    // The other 500 kg of graded Jeans A is sorted but not in a bale yet: stock too (v2 review), worth Rs 50,000.
    expect(s.sorted).toMatchObject({ kg: '500', value: '50000' });
    expect(s.total).toMatchObject({ items: 2, value: '100700' });
    expect(s.ageing[0]).toMatchObject({ bucket: '0-30', items: 2, value: '100700' });
    expect(s.ageing.slice(1).every((x: { items: number }) => x.items === 0)).toBe(true);
    expect(s.byCategory).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Jeans', items: 1, kg: '1000', value: '100000' })]));
  });

  it('a count changes nothing until approved; approval writes off cost by position and keeps the cost chain whole', async () => {
    // 7 on the books, 5 counted.
    const c1 = (await api(app, a).post(`/workspace/stock/${ids.tops}/counts`, { counted: 5, reason: 'Two missing after stock take' }).expect(201)).body;
    expect(c1).toMatchObject({ status: 'PENDING', bookQuantity: '7', countedQuantity: '5' });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.tops } })).usedQuantity.toString()).toBe('3');
    await api(app, a).post(`/workspace/stock/${ids.tops}/counts`, { counted: 4, reason: 'again' }).expect(409);
    await api(app, a).post(`/workspace/stock/${ids.tops}/counts`, { counted: 2.5, reason: 'half piece' }).expect(400);

    // Someone who may count but not approve.
    const munshi = await userWith(['INVENTORY_VIEW', 'INVENTORY_ADJUST']);
    await api(app, munshi).post(`/workspace/stock-counts/${c1.id}/approve`, {}).expect(403);

    const ok = (await api(app, a).post(`/workspace/stock-counts/${c1.id}/approve`, { note: 'Checked' }).expect(200)).body;
    expect(ok).toMatchObject({ status: 'APPROVED', costChange: '-200' });
    await api(app, a).post(`/workspace/stock-counts/${c1.id}/reject`, {}).expect(409);
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.tops } });
    expect(item.usedQuantity.toString()).toBe('5');
    const rec = (await api(app, a).get(`/workspace/stock/${ids.tops}`).expect(200)).body;
    expect(rec.counts[0]).toMatchObject({ status: 'APPROVED', difference: '-2', costChange: '-200' });
    expect(rec.movements[0]).toMatchObject({ type: 'ADJUSTMENT', pcs: -2 });

    // A count, then a sale before approval: the books moved, so approval is refused.
    const c2 = (await api(app, a).post(`/workspace/stock/${ids.tops}/counts`, { counted: 0, reason: 'All gone' }).expect(201)).body;
    await api(app, a).post('/sales', { customerId: ids.customer, paymentMode: 'CASH', paidAmount: 200, paymentMethod: 'CASH', lines: [{ inventoryItemId: ids.tops, unit: 'PIECE', quantity: 1, unitPrice: 200 }] }).expect(201);
    await api(app, a).post(`/workspace/stock-counts/${c2.id}/approve`, {}).expect(409);
    await api(app, a).post(`/workspace/stock-counts/${c2.id}/reject`, { note: 'Count again' }).expect(200);

    // Write off the rest: the item is used up and its sales + write-offs carry its whole cost.
    const c3 = (await api(app, munshi).post(`/workspace/stock/${ids.tops}/counts`, { counted: 0, reason: 'Damaged in rain' }).expect(201)).body;
    expect((await api(app, a).post(`/workspace/stock-counts/${c3.id}/approve`, {}).expect(200)).body.costChange).toBe('-400');
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.tops } })).status).toBe('SOLD');
    expect(await costChain()).toEqual([]);

    const counts = (await api(app, a).get('/lists/stock-counts?f=status:eq:APPROVED').expect(200)).body;
    expect(counts.rows).toHaveLength(2);
    expect(counts.totals).toEqual({ costChange: '-600' });
  });

  it('godown transfer moves what is left and records it', async () => {
    const main = await prisma.warehouse.create({ data: { tenantId: a.tenantId, name: 'Main godown', code: 'MAIN' } });
    const shop = await prisma.warehouse.create({ data: { tenantId: a.tenantId, name: 'Shershah shop', code: 'SHOP' } });
    await api(app, a).post(`/workspace/stock/${ids.bale}/transfer`, { godownId: main.id }).expect(200);
    await api(app, a).post(`/workspace/stock/${ids.bale}/transfer`, { godownId: shop.id }).expect(200);
    await api(app, a).post(`/workspace/stock/${ids.bale}/transfer`, { godownId: shop.id }).expect(400);
    const r = (await api(app, a).get(`/workspace/stock/${ids.bale}`).expect(200)).body;
    expect(r.item.godown).toEqual({ id: shop.id, name: 'Shershah shop' });
    expect(r.movements[0]).toMatchObject({ type: 'TRANSFER', details: expect.objectContaining({ from: 'Main godown', to: 'Shershah shop' }) });
    expect((await api(app, a).get('/workspace/stock/summary').expect(200)).body.byGodown).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Shershah shop', items: 1 })]),
    );
    const otherGodown = await prisma.warehouse.create({ data: { tenantId: b.tenantId, name: 'Their godown', code: 'B1' } });
    await api(app, a).post(`/workspace/stock/${ids.bale}/transfer`, { godownId: otherGodown.id }).expect(404);
  });

  it('another business sees and changes nothing', async () => {
    await api(app, b).get(`/workspace/stock/${ids.bale}`).expect(404);
    await api(app, b).post(`/workspace/stock/${ids.bale}/counts`, { counted: 0, reason: 'x y' }).expect(404);
    const pending = (await api(app, a).post(`/workspace/stock/${ids.bale}/counts`, { counted: 0, reason: 'Missing bale' }).expect(201)).body;
    await api(app, b).post(`/workspace/stock-counts/${pending.id}/approve`, {}).expect(404);
    expect((await api(app, b).get('/lists/stock').expect(200)).body.rows).toEqual([]);
    expect((await api(app, b).get('/lists/stock-counts').expect(200)).body.rows).toEqual([]);
    expect((await api(app, b).get('/workspace/stock/summary').expect(200)).body.total.items).toBe(0);
  });
});
