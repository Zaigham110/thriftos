import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DEFAULT_MODULES, MODULE_KEYS, storedModules } from '../../src/common/modules/modules';
import { api, createTenantWithOwner, createTestApp, login, TestTenant } from './fixtures';

/**
 * v2 modules: every part of ThriftOS is a module the super admin turns on or off per business. A module that is
 * off is refused by the server (403, code MODULE_DISABLED); the owner cannot change the list.
 */
describe('Modules per business (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestTenant;
  let superAdmin: TestTenant;

  const ID = '00000000-0000-0000-0000-000000000000';
  /** One request per module that must be refused while it is off. */
  // Always four items: jest hands a callback to a test with fewer arguments than parameters.
  const ROUTES: [string, 'get' | 'post' | 'put' | 'patch', string, object | null][] = [
    ['CONTAINERS', 'get', '/procurement/containers', null],
    ['CONTAINERS', 'get', `/workspace/containers/${ID}`, null],
    ['READY_STOCK', 'post', '/stock/items', {}],
    ['PURCHASE_ORDERS', 'get', '/procurement/purchase-orders', null],
    ['SORT', 'get', '/sorting/stage-1/queue', null],
    ['SORT', 'get', '/workspace/sorting/yield', null],
    ['WAREHOUSES', 'post', '/admin/warehouses', { name: 'Second', code: 'WH-2' }],
    ['WAREHOUSES', 'post', `/workspace/stock/${ID}/transfer`, {}],
    ['STOCK_COUNTS', 'post', `/workspace/stock/${ID}/counts`, {}],
    ['PRICE_LISTS', 'get', '/workspace/price-lists', null],
    ['KHATA', 'get', '/khata', null],
    ['KHATA', 'get', '/workspace/receivables', null],
    ['EXPENSES', 'post', '/workspace/expenses', {}],
    ['CASH_CLOSE', 'get', '/workspace/finance/close', null],
    ['PNL', 'get', '/workspace/finance/pnl', null],
    ['REPORTS', 'get', '/reports/dashboard/summary', null],
    ['MUNSHI', 'post', '/users/munshi', {}],
    ['IMPORT', 'get', '/import/customers/template', null],
  ];

  const setModules = (tenantId: string, on: string[], sortingStages = 2) =>
    prisma.tenant.update({ where: { id: tenantId }, data: { sortingStages, enabledModules: storedModules(sortingStages, on) } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    owner = await createTenantWithOwner(app);
    superAdmin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('a new business starts with the everyday set; detailed reports, export, godowns and purchase orders are off', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } });
    for (const m of ['RECEIVE', 'STOCK', 'SELL', ...DEFAULT_MODULES]) expect(tenant.enabledModules).toContain(m);
    for (const m of ['REPORTS', 'EXPORT', 'WAREHOUSES', 'PURCHASE_ORDERS']) expect(tenant.enabledModules).not.toContain(m);
  });

  it('the app reads the module list (three languages) and what is on from the server', async () => {
    const res = (await api(app, owner).get('/tenant/modules').expect(200)).body;
    expect(res.modules.map((m: { key: string }) => m.key)).toEqual([...MODULE_KEYS]);
    expect(res.modules[0].name).toEqual(expect.objectContaining({ en: expect.any(String), ur: expect.any(String), roman: expect.any(String) }));
    expect(res.on).toEqual(expect.arrayContaining(['CONTAINERS', 'KHATA']));
    expect(res.on).not.toContain('RECEIVE');
    const console = (await api(app, superAdmin).get('/superadmin/module-catalogue').expect(200)).body;
    expect(console.groups.map((g: { id: string }) => g.id)).toEqual(['buying', 'sorting', 'stock', 'selling', 'money', 'other']);
  });

  it.each(ROUTES)('%s off: %s %s is refused', async (module, method, url, body) => {
    await setModules(owner.tenantId, MODULE_KEYS.filter((m) => m !== module && m !== 'SORT').concat(module === 'SORT' ? [] : ['SORT']), module === 'SORT' ? 0 : 2);
    const res = await (api(app, owner) as any)[method](url, body ?? undefined).expect(403);
    expect(res.body).toMatchObject({ code: 'MODULE_DISABLED', module });
  });

  it('with every module on, none of those requests is refused for a module', async () => {
    await setModules(owner.tenantId, [...MODULE_KEYS]);
    for (const [, method, url, body] of ROUTES) {
      const res = await (api(app, owner) as any)[method](url, body ?? undefined);
      expect({ url, code: res.body?.code }).not.toEqual({ url, code: 'MODULE_DISABLED' });
    }
  });

  it('a loose lot needs Loose lots and a container lot needs Containers', async () => {
    await setModules(owner.tenantId, ['CONTAINERS', 'KHATA']);
    const loose = await api(app, owner).post('/procurement/rags', { ragBaleType: 'RAG', weightKg: 100, purchaseCost: 1000 }).expect(403);
    expect(loose.body).toMatchObject({ code: 'MODULE_DISABLED', module: 'LOOSE_LOTS' });

    await setModules(owner.tenantId, ['LOOSE_LOTS', 'KHATA']);
    const inContainer = await api(app, owner).post('/procurement/rags', { ragBaleType: 'RAG', containerId: ID, weightKg: 100 }).expect(403);
    expect(inContainer.body).toMatchObject({ code: 'MODULE_DISABLED', module: 'CONTAINERS' });
    // Loose lots alone: the lots list still opens.
    await api(app, owner).get('/procurement/rags').expect(200);
  });

  it('khata off: a credit sale is refused and nothing is written; a cash sale is not refused for khata', async () => {
    await setModules(owner.tenantId, ['READY_STOCK'], 0);
    const customer = await prisma.customer.create({ data: { tenantId: owner.tenantId, name: 'Walk-in' } });
    const before = await prisma.sale.count({ where: { tenantId: owner.tenantId } });
    const credit = await api(app, owner)
      .post('/sales', { customerId: customer.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: ID, quantity: 1, unitPrice: 1 }] })
      .expect(403);
    expect(credit.body).toMatchObject({ code: 'MODULE_DISABLED', module: 'KHATA' });
    const cash = await api(app, owner).post('/sales', { customerId: customer.id, paymentMode: 'CASH', lines: [{ inventoryItemId: ID, quantity: 1, unitPrice: 1 }] });
    expect(cash.body?.code).not.toBe('MODULE_DISABLED');
    expect(await prisma.sale.count({ where: { tenantId: owner.tenantId } })).toBe(before);
  });

  it('EXPORT off: an export sale is refused', async () => {
    await setModules(owner.tenantId, DEFAULT_MODULES);
    const customer = await prisma.customer.create({ data: { tenantId: owner.tenantId, name: 'Overseas buyer' } });
    const res = await api(app, owner)
      .post('/sales', { customerId: customer.id, paymentMode: 'CASH', type: 'EXPORT', lines: [{ inventoryItemId: ID, quantity: 1, unitPrice: 1 }] })
      .expect(403);
    expect(res.body).toMatchObject({ code: 'MODULE_DISABLED', module: 'EXPORT' });
  });

  it('the owner cannot change modules or how the business sorts', async () => {
    await setModules(owner.tenantId, DEFAULT_MODULES);
    await api(app, owner).patch('/tenant/settings', { enabledModules: ['RECEIVE', 'STOCK', 'SELL', 'REPORTS'] }).expect(400);
    await api(app, owner).patch('/tenant/business', { sortingStages: 0 }).expect(400);
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } });
    expect(t.sortingStages).toBe(2);
    expect(t.enabledModules).not.toContain('REPORTS');
    // The owner sees what is on, read-only.
    const biz = (await api(app, owner).get('/tenant/business').expect(200)).body;
    expect(biz.modules).toEqual(expect.arrayContaining(['CONTAINERS', 'KHATA']));
    await api(app, owner).patch(`/superadmin/tenants/${owner.tenantId}/workings`, { modules: ['REPORTS'] }).expect(403);
  });

  it('the super admin sets them; the rules hold', async () => {
    const path = `/superadmin/tenants/${owner.tenantId}/workings`;
    let res = (await api(app, superAdmin).patch(path, { sortingStages: 0, modules: ['READY_STOCK', 'KHATA', 'REPORTS'] }).expect(200)).body;
    expect(res.enabledModules).toEqual(['RECEIVE', 'STOCK', 'SELL', 'READY_STOCK', 'KHATA', 'REPORTS']);
    await api(app, owner).get('/reports/dashboard/summary').expect(200);
    await api(app, owner).get('/procurement/containers').expect(403);

    expect((await api(app, superAdmin).patch(path, { modules: ['KHATA'] }).expect(400)).body.code).toBe('NO_BUYING');
    expect((await api(app, superAdmin).patch(path, { sortingStages: 2, modules: ['READY_STOCK'] }).expect(400)).body.code).toBe('SORT_NEEDS_LOTS');
    await api(app, superAdmin).patch(path, { modules: ['READY_STOCK', 'BILLING'] }).expect(400);

    // Turning sorting on for a business with no lists gives it the starting lists.
    await prisma.grade.updateMany({ where: { tenantId: owner.tenantId }, data: { isActive: false } });
    res = (await api(app, superAdmin).patch(path, { sortingStages: 2, modules: ['LOOSE_LOTS'] }).expect(200)).body;
    expect(res.enabledModules).toEqual(['RECEIVE', 'STOCK', 'SELL', 'SORT', 'LOOSE_LOTS']);
    expect(await prisma.grade.count({ where: { tenantId: owner.tenantId, isActive: true } })).toBeGreaterThan(0);
  });

  it("one business's switches never change another's", async () => {
    const other = await createTenantWithOwner(app);
    await api(app, superAdmin).patch(`/superadmin/tenants/${owner.tenantId}/workings`, { sortingStages: 0, modules: ['READY_STOCK'] }).expect(200);
    await api(app, other).get('/procurement/containers').expect(200);
    await api(app, other).get('/khata').expect(200);
    await api(app, owner).get('/khata').expect(403);
  });

  it('owners never reach super admin routes', async () => {
    await api(app, owner).get('/superadmin/module-catalogue').expect(403);
    for (const url of ['/superadmin/billing', '/superadmin/plans']) await api(app, superAdmin).get(url).expect(404);
  });
});
