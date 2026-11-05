import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * v2 review, Purchasing: a gaari or loose lot is a purchase too (its own list next to containers, with price per
 * kg and how far sorting has got), and a container moves to "cleared" by itself once its lots are being sorted.
 */
describe('Purchasing review: gaari lots list and container status (e2e)', () => {
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

  it('lists gaari lots only (no container lots), with price per kg and sorted %, per business', async () => {
    const m = await seedSortableLot(app, a.tenantId); // 100 kg for Rs 50,000
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Shershah Gaari Wala' }).expect(201);
    await prisma.rag.update({ where: { id: m.lot.id }, data: { vendorId: supplier.body.id } });
    const container = await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, containerNumber: `C-${Date.now()}`, netWeightKg: 1000, purchaseCost: 100000 }).expect(201);
    const inContainer = await api(app, a).post('/procurement/rags', { containerId: container.body.id, ragBaleType: 'BALE', weightKg: 1000 }).expect(201);

    // Sorting has started: 40 kg sorted so far.
    const s = (await api(app, a).post('/sorting/stage-1/start', { ragId: m.lot.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: m.jeans.id, amountKg: 40 }).expect(200);

    const list = (await api(app, a).get('/lists/purchase-lots').expect(200)).body;
    const ids = list.rows.map((r: { id: string }) => r.id);
    expect(ids).toContain(m.lot.id);
    expect(ids).not.toContain(inContainer.body.id);
    expect(list.rows.find((r: { id: string }) => r.id === m.lot.id)).toMatchObject({ code: m.lot.ragCode, supplier: 'Shershah Gaari Wala', status: 'IN_SORTING', kg: '100', cost: '50000', costPerKg: '500', sortedPercent: 40 });
    expect((await api(app, a).get('/lists/purchase-lots?q=Shershah').expect(200)).body.rows.map((r: { id: string }) => r.id)).toEqual([m.lot.id]);

    // Another business sees none of it.
    expect((await api(app, b).get('/lists/purchase-lots').expect(200)).body.rows.map((r: { id: string }) => r.id)).not.toContain(m.lot.id);
  });

  it('a container "on the way" is cleared once one of its lots is being sorted; closing stays the owner\'s step', async () => {
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Busan Rag Trading', originCountry: 'Korea' }).expect(201);
    const container = await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, containerNumber: `C2-${Date.now()}`, netWeightKg: 500, purchaseCost: 50000 }).expect(201);
    expect(container.body.status).toBe('IN_TRANSIT');
    const lot = await api(app, a).post('/procurement/rags', { containerId: container.body.id, ragBaleType: 'BALE', weightKg: 500 }).expect(201);
    await api(app, a).post('/sorting/stage-1/start', { ragId: lot.body.id }).expect(201);

    const c = await prisma.container.findUniqueOrThrow({ where: { id: container.body.id } });
    expect(c.status).toBe('CLEARED');
    expect(c.arrivedAt).not.toBeNull();
    expect(c.clearedAt).not.toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'CONTAINER_STATUS_CHANGED', entityId: c.id } });
    expect(log.metadataJson).toMatchObject({ previousStatus: 'IN_TRANSIT', newStatus: 'CLEARED', reason: 'SORTING_STARTED' });
    // Late bills can still be added.
    await api(app, a).post(`/procurement/containers/${c.id}/charges`, { chargeType: 'TRANSPORT', amount: 5000 }).expect(201);
  });
});
