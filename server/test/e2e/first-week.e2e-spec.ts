import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

/** v2 6.4: the first-week checklist on Home ticks itself from what the business has done; each business sees its own. */
describe('First-week checklist (e2e)', () => {
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

  it('starts with nothing done and ticks supplier, container, sale and team as they happen', async () => {
    expect((await api(app, a).get('/home/first-week').expect(200)).body).toEqual({ show: true, done: 0, total: 4, steps: { supplier: false, container: false, sale: false, team: false } });

    const vendor = (await api(app, a).post('/procurement/vendors', { name: 'Texas Rags', originCountry: 'USA' }).expect(201)).body;
    await prisma.container.create({ data: { tenantId: a.tenantId, containerNumber: `FW-${Date.now()}`, vendorId: vendor.id, grossWeight: 1000, netWeight: 1000 } });
    const stock = (await api(app, a).post('/stock/items', { name: 'Jeans A', unit: 'BALE', quantity: 3, totalCost: 30000 }).expect(201)).body;
    const customer = (await api(app, a).post('/customers', { name: 'Shafiq', phone: '0321 7654000' }).expect(201)).body;
    await api(app, a).post('/sales', { customerId: customer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: stock.id, quantity: 1, unitPrice: 12000 }] }).expect(201);
    expect((await api(app, a).get('/home/first-week').expect(200)).body).toMatchObject({ show: true, done: 3, steps: { supplier: true, container: true, sale: true, team: false } });

    await api(app, a).post('/users/munshi', { name: 'Akram', phone: '0300 765 4001', pin: '4821' }).expect(201);
    expect((await api(app, a).get('/home/first-week').expect(200)).body).toMatchObject({ show: false, done: 4 });

    // The other business is untouched.
    expect((await api(app, b).get('/home/first-week').expect(200)).body).toMatchObject({ show: true, done: 0 });
  });

  it('follows the modules: ready bales count as the first stock in; no munshi step without Munshi (v2 modules)', async () => {
    const t = await createTenantWithOwner(app);
    await prisma.tenant.update({ where: { id: t.tenantId }, data: { sortingStages: 0, enabledModules: ['RECEIVE', 'STOCK', 'SELL', 'READY_STOCK'] } });
    expect((await api(app, t).get('/home/first-week').expect(200)).body).toEqual({ show: true, done: 0, total: 3, steps: { supplier: false, container: false, sale: false } });
    await api(app, t).post('/stock/items', { name: 'Jeans A', unit: 'BALE', quantity: 3, totalCost: 30000 }).expect(201);
    expect((await api(app, t).get('/home/first-week').expect(200)).body).toMatchObject({ done: 1, steps: { container: true } });
  });

  it('the owner can hide it; it also stops after the first 30 days', async () => {
    await api(app, b).post('/home/first-week/hide').expect(200);
    expect((await api(app, b).get('/home/first-week').expect(200)).body.show).toBe(false);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId } })).firstWeekHiddenAt).toBeNull();

    const c = await createTenantWithOwner(app);
    await prisma.tenant.update({ where: { id: c.tenantId }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    expect((await api(app, c).get('/home/first-week').expect(200)).body.show).toBe(false);
  });

  it('needs the owner numbers permission', async () => {
    const worker = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, worker).get('/home/first-week').expect(403);
    await api(app, worker).post('/home/first-week/hide').expect(403);
  });
});
