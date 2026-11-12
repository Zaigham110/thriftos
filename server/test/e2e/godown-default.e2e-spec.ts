import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/** Phase 9.3 (owner: "godown work flow is not working"): new stock goes to the business's main godown, so moves add up. */
describe('Godowns: new stock in the main godown (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...row.enabledModules, 'WAREHOUSES'] } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('bales made while sorting and kat at close go to the main godown; a move puts them in the other', async () => {
    const main = await prisma.warehouse.create({ data: { tenantId: a.tenantId, name: 'Main', code: 'M1' } });
    const shop = await prisma.warehouse.create({ data: { tenantId: a.tenantId, name: 'Shop', code: 'S1' } });
    const { lot, jeans, waste } = await seedSortableLot(app, a.tenantId);
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session;
    const made = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, bales: 2, baleWeightKg: 20 }).expect(200)).body;
    await api(app, a).patch(`/sorting/stage-1/${session.id}/seal`, { wasteCategoryId: waste.id }).expect(200);
    const items = await prisma.inventoryItem.findMany({ where: { tenantId: a.tenantId }, select: { id: true, warehouseId: true, repackUnitId: true } });
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((i) => i.warehouseId === main.id)).toBe(true);
    const bales = items.filter((i) => made.baleIds.includes(i.repackUnitId));
    await api(app, a).post('/workspace/stock/transfer', { godownId: shop.id, itemIds: bales.map((b) => b.id) }).expect(200);
    const summary = (await api(app, a).get('/workspace/stock/summary').expect(200)).body;
    expect(summary.byGodown).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Shop', items: 2 }), expect.objectContaining({ name: 'Main' })]));
  });
});
