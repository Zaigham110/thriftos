import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, login, TestTenant } from './fixtures';

/** v2 6.5: Super Admin onboarding tools — quick create, last activity per business, read-only support view (audited). */
describe('Super Admin onboarding tools (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: TestTenant;
  let owner: TestTenant;
  const tag = Date.now().toString().slice(-7);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    superAdmin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
    owner = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('makes a business from name, owner and phone; the owner signs in with phone + the PIN', async () => {
    const res = await api(app, superAdmin)
      .post('/superadmin/tenants/quick', { businessName: 'Al-Madina Traders', ownerName: 'Haji Rafiq', ownerPhone: `0301 ${tag}`, language: 'ur', sortingStages: 1 })
      .expect(201);
    expect(res.body).toMatchObject({
      tenant: { name: 'Al-Madina Traders', companyCode: expect.stringMatching(/^ALMADINATRAD/) },
      owner: { name: 'Haji Rafiq', phone: `+92301${tag}` },
      pin: expect.stringMatching(/^\d{6}$/),
      signInUrl: expect.stringMatching(/\/auth\/login$/),
    });
    expect(res.body.welcome).toContain(res.body.pin);
    expect(res.body.welcome).toContain(`0301 ${tag}`);
    expect(res.body.welcome).toContain('السلام علیکم');

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: res.body.tenant.id }, include: { roles: true, categories: true } });
    expect(tenant).toMatchObject({ defaultLanguage: 'ur', sortingStages: 1, setupCompletedAt: null });
    expect(tenant.categories.length).toBeGreaterThan(0);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.owner.id }, include: { userRoles: { include: { role: true } } } });
    expect(user.userRoles.map((r) => r.role.name)).toEqual(['Admin']);
    expect(user.pinHash).not.toContain(res.body.pin);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: tenant.id, action: 'TENANT_CREATED' } });
    expect(JSON.stringify(audit.metadataJson)).not.toContain(res.body.pin);

    const signIn = await request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone: `+92 301 ${tag}`, pin: res.body.pin }).expect(200);
    const ownerApi = api(app, { tenantId: tenant.id, userId: user.id, email: '', token: signIn.body.accessToken });
    await ownerApi.get('/home/first-week').expect(200);

    // Same name again gets the next code; same phone is refused.
    const again = await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Al-Madina Traders', ownerName: 'Other', ownerPhone: `0302 ${tag}`, language: 'en' }).expect(201);
    expect(again.body.tenant.companyCode).toMatch(/-\d+$/);
    expect(again.body.welcome).toContain('Assalam o Alaikum Other!');
  });

  it('every language works for a new business: Roman Urdu welcome, PIN message, edit, and an unknown language refused', async () => {
    const made = (
      await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: `Roman Bales ${tag}`, ownerName: 'Bilal', ownerPhone: `0305 ${tag}`, language: 'roman' }).expect(201)
    ).body;
    expect(made.welcome).toContain('aap ka ThriftOS tayyar hai');
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: made.tenant.id } });
    expect(tenant).toMatchObject({ defaultLanguage: 'roman', locale: 'en-PK' });
    const pin = (await api(app, superAdmin).post(`/superadmin/tenants/${made.tenant.id}/users/${made.owner.id}/pin`, {}).expect(200)).body;
    expect(pin.message).toContain('aap ka naya PIN');
    await api(app, superAdmin).patch(`/superadmin/tenants/${made.tenant.id}`, { defaultLanguage: 'en' }).expect(200);
    await api(app, superAdmin).patch(`/superadmin/tenants/${made.tenant.id}`, { defaultLanguage: 'roman' }).expect(200);
    await api(app, superAdmin).patch(`/superadmin/tenants/${made.tenant.id}`, { defaultLanguage: 'fr' }).expect(400);
    await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'French', ownerName: 'X', ownerPhone: `0306 ${tag}`, language: 'fr' }).expect(400);
  });

  it('refuses a phone that already has a login, a bad phone, and anyone but the super admin', async () => {
    await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Dup Phone', ownerName: 'X', ownerPhone: `0301 ${tag}` }).expect(409);
    await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Bad Phone', ownerName: 'X', ownerPhone: '12' }).expect(400);
    await api(app, owner).post('/superadmin/tenants/quick', { businessName: 'Nope', ownerName: 'X', ownerPhone: '0333 1112223' }).expect(403);
  });

  it('shows the last activity of each business', async () => {
    const list = await api(app, superAdmin).get('/superadmin/tenants?limit=100').expect(200);
    const fresh = list.body.data.find((t: any) => t.id === owner.tenantId);
    expect(fresh.lastActivity).toMatchObject({ kind: 'app' }); // signing in counts

    const stock = (await api(app, owner).post('/stock/items', { name: 'Jeans A', unit: 'BALE', quantity: 3, totalCost: 30000 }).expect(201)).body;
    const customer = (await api(app, owner).post('/customers', { name: 'Shafiq', phone: `0321 ${tag}` }).expect(201)).body;
    await api(app, owner).post('/sales', { customerId: customer.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: stock.id, quantity: 1, unitPrice: 12000 }] }).expect(201);
    const one = await api(app, superAdmin).get(`/superadmin/tenants/${owner.tenantId}`).expect(200);
    expect(one.body.lastActivity).toMatchObject({ at: expect.any(String) });
    expect(['sale', 'app']).toContain(one.body.lastActivity.kind);
    expect(Date.now() - Date.parse(one.body.lastActivity.at)).toBeLessThan(60_000);
  });

  it('support view reads the business but changes nothing, and both are in the audit log', async () => {
    const imp = await api(app, superAdmin).post(`/superadmin/tenants/${owner.tenantId}/impersonate`, { reason: 'Owner says udhaar total looks wrong' }).expect(200);
    expect(imp.body.readOnly).toBe(true);
    const support = api(app, { ...superAdmin, token: imp.body.accessToken });

    const customers = await support.get('/customers').expect(200);
    expect(customers.body.map((c: any) => c.name ?? c.customer?.name)).toContain('Shafiq');
    const blocked = await support.post('/customers', { name: 'Support Added', phone: '0345 0000001' }).expect(403);
    expect(blocked.body.message).toMatch(/read-only/);
    await support.patch(`/customers/${customers.body[0].id}`, { name: 'Renamed' }).expect(403);
    expect(await prisma.customer.count({ where: { tenantId: owner.tenantId, name: 'Support Added' } })).toBe(0);
    await support.post('/auth/exit-impersonation').expect(204);

    const actions = (await prisma.auditLog.findMany({ where: { tenantId: owner.tenantId, userId: superAdmin.userId }, select: { action: true, metadataJson: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['SUPERADMIN_IMPERSONATE', 'SUPER_ADMIN_IMPERSONATED_ACCESS', 'SUPPORT_VIEW_WRITE_BLOCKED']));
    const start = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: owner.tenantId, action: 'SUPERADMIN_IMPERSONATE' } });
    expect(start.metadataJson).toMatchObject({ readOnly: true, reason: 'Owner says udhaar total looks wrong' });

    // Support visits are not the business's own activity.
    const after = await api(app, superAdmin).get(`/superadmin/tenants/${owner.tenantId}`).expect(200);
    const before = Date.parse(after.body.lastActivity.at);
    expect(Date.now() - before).toBeGreaterThan(0);
    const latestOwn = await prisma.sale.findFirstOrThrow({ where: { tenantId: owner.tenantId }, orderBy: { createdAt: 'desc' } });
    expect(before).toBeLessThanOrEqual(latestOwn.createdAt.getTime() + 5_000);
  });
});
