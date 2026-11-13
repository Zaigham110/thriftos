import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, seedSortableLot, TestTenant } from './fixtures';

const DAY = 86_400_000;

/**
 * Enterprise plan E3.4: sales grouped by month; price lists by customer group (an agreed group price is
 * suggested first — exact grade before "any grade" — then the customer's last price, anyone's, the item's).
 */
describe('Workspace sales extras: sales by month, price lists by customer group (e2e)', () => {
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
    Object.assign(ids, { jeans: m.jeans.id, gradeA: m.gradeA.id, gradeB: m.gradeB.id });
    ids.itemA = (await api(app, a).post('/stock/items', { name: 'Jeans A bale', unit: 'BALE', quantity: 5, totalCost: 100000, categoryId: m.jeans.id, gradeId: m.gradeA.id, salePrice: 30000 }).expect(201)).body.id;
    ids.itemB = (await api(app, a).post('/stock/items', { name: 'Jeans B bale', unit: 'BALE', quantity: 5, totalCost: 50000, categoryId: m.jeans.id, gradeId: m.gradeB.id }).expect(201)).body.id;
    ids.wholesale = (await api(app, a).post('/customers', { name: 'Haji Rafiq Traders', phone: '03001112233' }).expect(201)).body.id;
    ids.walkin = (await api(app, a).post('/customers', { name: 'Walk-in Ahmed', phone: '03009990001' }).expect(201)).body.id;
    // Two sales: one this month, one moved to an earlier month.
    const s1 = (await api(app, a).post('/sales', { customerId: ids.walkin, paymentMode: 'CASH', paidAmount: 26000, paymentMethod: 'CASH', lines: [{ inventoryItemId: ids.itemA, unit: 'BALE', quantity: 1, unitPrice: 26000 }] }).expect(201)).body;
    const s2 = (await api(app, a).post('/sales', { customerId: ids.walkin, paymentMode: 'CASH', paidAmount: 12000, paymentMethod: 'CASH', lines: [{ inventoryItemId: ids.itemB, unit: 'BALE', quantity: 1, unitPrice: 12000 }] }).expect(201)).body;
    await prisma.sale.update({ where: { id: s2.id }, data: { createdAt: new Date(Date.now() - 40 * DAY), issuedAt: new Date(Date.now() - 40 * DAY) } });
    ids.s1 = s1.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sales list groups by month with counts and totals, newest first', async () => {
    const g = (await api(app, a).get('/lists/sales?groupBy=date').expect(200)).body;
    expect(g.groups).toHaveLength(2);
    expect(g.groups[0]).toMatchObject({ count: 1, totals: expect.objectContaining({ total: '26000' }) });
    expect(g.groups[1]).toMatchObject({ count: 1, totals: expect.objectContaining({ total: '12000' }) });
    expect(g.groups[0].key > g.groups[1].key).toBe(true);
    expect(g.groups[0].key).toMatch(/^\d{4}-\d{2}$/);
    expect((await api(app, a).get('/lists/containers?groupBy=date').expect(200)).body.groups).toEqual([]);
  });

  it('price lists: the group price is suggested first, exact grade before any grade', async () => {
    // Before any list: the item's own price, set in Inventory, beats what was paid before (v2 review);
    // an item without one falls back to the last price paid.
    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.wholesale}&inventoryItemId=${ids.itemA}`).expect(200)).body).toMatchObject({ unitPrice: '30000', from: 'ITEM' });

    await api(app, a).put('/workspace/price-lists/entries', { group: 'Wholesale', categoryId: ids.jeans, unit: 'BALE', price: 20000 }).expect(200);
    const exact = (await api(app, a).put('/workspace/price-lists/entries', { group: 'Wholesale', categoryId: ids.jeans, gradeId: ids.gradeA, unit: 'BALE', price: 24000 }).expect(200)).body;
    // Setting the same combination again updates it.
    expect((await api(app, a).put('/workspace/price-lists/entries', { group: 'Wholesale', categoryId: ids.jeans, gradeId: ids.gradeA, unit: 'BALE', price: 24500 }).expect(200)).body.id).toBe(exact.id);
    await api(app, a).patch(`/workspace/customers/${ids.wholesale}/price-group`, { group: 'Wholesale' }).expect(200);

    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.wholesale}&inventoryItemId=${ids.itemA}`).expect(200)).body).toMatchObject({ unitPrice: '24500', from: 'PRICE_LIST', group: 'Wholesale' });
    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.wholesale}&inventoryItemId=${ids.itemB}`).expect(200)).body).toMatchObject({ unitPrice: '20000', from: 'PRICE_LIST' });
    // Not in the group: unchanged.
    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.walkin}&inventoryItemId=${ids.itemA}`).expect(200)).body).toMatchObject({ unitPrice: '30000', from: 'ITEM' });
    // By kg there is no list price: falls back.
    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.wholesale}&inventoryItemId=${ids.itemA}&unit=KG`).expect(200)).body.from).not.toBe('PRICE_LIST');

    const o = (await api(app, a).get('/workspace/price-lists').expect(200)).body;
    expect(o.groups).toEqual([{ name: 'Wholesale', customers: 1, prices: 2 }]);
    // Who is in the group, and who could be added.
    expect(o.customers).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.wholesale, group: 'Wholesale' }), expect.objectContaining({ id: ids.walkin, group: null })]));

    // Rename: prices and customers move with the name; not onto another group's name; not another business's group.
    await api(app, b).patch('/workspace/price-lists/groups/Wholesale', { name: 'Taken' }).expect(404);
    await api(app, a).patch('/workspace/price-lists/groups/Wholesale', { name: 'Big buyers' }).expect(200);
    await api(app, a).patch('/workspace/price-lists/groups/Wholesale', { name: 'Again' }).expect(404);
    const renamed = (await api(app, a).get('/workspace/price-lists').expect(200)).body;
    expect(renamed.groups).toEqual([{ name: 'Big buyers', customers: 1, prices: 2 }]);
    await api(app, a).put('/workspace/price-lists/entries', { group: 'Retail', categoryId: ids.jeans, unit: 'BALE', price: 31000 }).expect(200);
    await api(app, a).patch('/workspace/price-lists/groups/Retail', { name: 'Big buyers' }).expect(409);
    // Remove: the group's prices go, its customers are in no group; another business cannot.
    await api(app, b).delete('/workspace/price-lists/groups/Retail').expect(404);
    expect((await api(app, a).delete('/workspace/price-lists/groups/Retail').expect(200)).body).toMatchObject({ removed: true, prices: 1, customers: 0 });
    await api(app, a).patch('/workspace/price-lists/groups/Big%20buyers', { name: 'Wholesale' }).expect(200);
    expect(o.entries).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'Jeans', grade: 'A', price: '24500' }), expect.objectContaining({ grade: null, price: '20000' })]));
    expect((await api(app, a).get(`/workspace/customers/${ids.wholesale}`).expect(200)).body.customer.priceGroup).toBe('Wholesale');

    await api(app, a).delete(`/workspace/price-lists/entries/${exact.id}`).expect(200);
    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.wholesale}&inventoryItemId=${ids.itemA}`).expect(200)).body).toMatchObject({ unitPrice: '20000', from: 'PRICE_LIST' });
    await api(app, a).patch(`/workspace/customers/${ids.wholesale}/price-group`, { group: null }).expect(200);
    expect((await api(app, a).get(`/sales/last-price?customerId=${ids.wholesale}&inventoryItemId=${ids.itemA}`).expect(200)).body.from).toBe('ITEM');
  });

  it('price lists need price.manage; another business sees and changes nothing', async () => {
    const munshi = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, munshi).get('/workspace/price-lists').expect(403);
    await api(app, munshi).put('/workspace/price-lists/entries', { group: 'X', categoryId: ids.jeans, unit: 'BALE', price: 1 }).expect(403);

    expect((await api(app, b).get('/workspace/price-lists').expect(200)).body.groups).toEqual([]);
    await api(app, b).put('/workspace/price-lists/entries', { group: 'X', categoryId: ids.jeans, unit: 'BALE', price: 1 }).expect(404);
    await api(app, b).patch(`/workspace/customers/${ids.wholesale}/price-group`, { group: 'X' }).expect(404);
    const entry = await prisma.priceListEntry.findFirstOrThrow({ where: { tenantId: a.tenantId } });
    await api(app, b).delete(`/workspace/price-lists/entries/${entry.id}`).expect(404);
  });
});
