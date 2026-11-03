import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, login, TestTenant } from './fixtures';

/**
 * Task 4.5: reports, export, warehouses, purchase orders and super admin billing are not part of v1. They are
 * refused (403, code MODULE_DISABLED) unless turned on in Tenant.enabledModules — the screens hide them too.
 */
describe('Modules that are off are refused by the server (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestTenant;
  let superAdmin: TestTenant;

  const OFF_ROUTES: [string, string][] = [
    ['REPORTS', '/reports/dashboard/summary'],
    ['REPORTS', '/reports/inventory/snapshot'],
    ['WAREHOUSES', '/admin/warehouses'],
    ['PURCHASE_ORDERS', '/procurement/purchase-orders'],
  ];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    owner = await createTenantWithOwner(app);
    superAdmin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('a new business has only the five v1 modules', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } });
    expect(tenant.enabledModules).toEqual(['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA']);
  });

  it.each(OFF_ROUTES)('%s off: GET %s is 403', async (module, url) => {
    const res = await api(app, owner).get(url).expect(403);
    expect(res.body).toMatchObject({ code: 'MODULE_DISABLED', module });
  });

  it('EXPORT off: an export sale is 403 and nothing is written', async () => {
    const customer = await prisma.customer.create({ data: { tenantId: owner.tenantId, name: 'Overseas buyer' } });
    const before = await prisma.sale.count({ where: { tenantId: owner.tenantId } });
    const res = await api(app, owner)
      .post('/sales', { customerId: customer.id, paymentMode: 'CASH', type: 'EXPORT', lines: [{ inventoryItemId: '00000000-0000-0000-0000-000000000000', quantity: 1, unitPrice: 1 }] })
      .expect(403);
    expect(res.body).toMatchObject({ code: 'MODULE_DISABLED', module: 'EXPORT' });
    expect(await prisma.sale.count({ where: { tenantId: owner.tenantId } })).toBe(before);
  });

  it('turned on in the settings: the same routes work', async () => {
    await api(app, owner)
      .patch('/tenant/settings', { enabledModules: ['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA', 'REPORTS', 'WAREHOUSES', 'PURCHASE_ORDERS'] })
      .expect(200);
    for (const [, url] of OFF_ROUTES) {
      const res = await api(app, owner).get(url);
      expect({ url, status: res.status }).toEqual({ url, status: 200 });
    }
  });

  it('the v1 screens never depend on an advanced module', async () => {
    await api(app, owner).patch('/tenant/settings', { enabledModules: ['RECEIVE', 'STOCK', 'SELL', 'KHATA'] }).expect(200);
    for (const url of ['/home', '/home/containers', '/khata', '/stock/bales', '/procurement/containers', '/sales', '/tenant']) {
      const res = await api(app, owner).get(url);
      expect({ url, status: res.status }).toEqual({ url, status: 200 });
    }
  });

  it('a module the business turned off for one business stays on for another', async () => {
    const other = await createTenantWithOwner(app);
    await prisma.tenant.update({ where: { id: other.tenantId }, data: { enabledModules: { push: 'WAREHOUSES' } } });
    await api(app, other).get('/admin/warehouses').expect(200);
    await api(app, owner).get('/admin/warehouses').expect(403);
  });

  it('super admin billing and plans follow the SYSTEM business; tenants are unaffected', async () => {
    const system = await prisma.tenant.findUniqueOrThrow({ where: { companyCode: 'SYSTEM' } });
    const original = system.enabledModules;
    try {
      await prisma.tenant.update({ where: { id: system.id }, data: { enabledModules: original.filter((m) => m !== 'BILLING') } });
      for (const url of ['/superadmin/billing', '/superadmin/plans']) {
        const res = await api(app, superAdmin).get(url).expect(403);
        expect(res.body).toMatchObject({ code: 'MODULE_DISABLED', module: 'BILLING' });
      }
      expect((await api(app, superAdmin).get('/superadmin/modules').expect(200)).body.enabledModules).not.toContain('BILLING');
      await api(app, superAdmin).get('/superadmin/summary').expect(200);

      await prisma.tenant.update({ where: { id: system.id }, data: { enabledModules: [...original.filter((m) => m !== 'BILLING'), 'BILLING'] } });
      await api(app, superAdmin).get('/superadmin/billing').expect(200);
      await api(app, superAdmin).get('/superadmin/plans').expect(200);
      expect((await api(app, superAdmin).get('/superadmin/modules').expect(200)).body.enabledModules).toContain('BILLING');
    } finally {
      await prisma.tenant.update({ where: { id: system.id }, data: { enabledModules: original } });
    }
    // A business owner can never reach super admin routes, module or not.
    await api(app, owner).get('/superadmin/modules').expect(403);
  });
});
