import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * v2 review, Stock: sorted kg not in bales yet is stock (stock value, Home, Inventory by item), and a price can
 * be set for one bale or for every bale of a kind — each business only its own.
 */
describe('Stock review: sorted kg is stock, inventory by item, prices (e2e)', () => {
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

  it('counts sorted kg in stock value and by item, next to the bales made', async () => {
    const m = await seedSortableLot(app, a.tenantId); // 100 kg for Rs 50,000
    const s = (await api(app, a).post('/sorting/stage-1/start', { ragId: m.lot.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: m.jeans.id, amountKg: 80 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${s}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
    // 80 kg Jeans carries the lot's Rs 50,000; one 40 kg bale is made, 40 kg stays sorted.
    const bale = (await api(app, a).post('/stock/bales', { categoryId: m.jeans.id, weightKg: 40 }).expect(201)).body;

    const value = (await api(app, a).get('/workspace/stock/summary').expect(200)).body;
    expect(value.sorted).toMatchObject({ kg: '40', value: '25000' });
    // Plus the 20 kg left over at close, which went into stock as leftovers (kat, no cost).
    expect(value.total).toMatchObject({ items: 2, kg: '100', value: '50000' });

    const byItem = (await api(app, a).get('/workspace/stock/by-item').expect(200)).body;
    expect(byItem.find((r: { name: string }) => r.name === 'Jeans')).toMatchObject({ bales: '1', stockKg: '40', sortedKg: '40', kg: '80', value: '50000' });

    // A price for every Jeans bale in stock; one bale's price can change on its own.
    await api(app, a).patch('/workspace/stock/price', { categoryId: m.jeans.id, salePrice: 30000 }).expect(200);
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: bale.id } });
    expect(Number(item.salePrice)).toBe(30000);
    await api(app, a).patch(`/workspace/stock/items/${item.id}/price`, { salePrice: 32000 }).expect(200);
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).salePrice)).toBe(32000);

    // Another business: nothing of A's, and cannot price A's stock.
    expect((await api(app, b).get('/workspace/stock/by-item').expect(200)).body).toEqual([]);
    await api(app, b).patch(`/workspace/stock/items/${item.id}/price`, { salePrice: 1 }).expect(404);
    await api(app, b).patch('/workspace/stock/price', { categoryId: m.jeans.id, salePrice: 1 }).expect(404);
  });
});
