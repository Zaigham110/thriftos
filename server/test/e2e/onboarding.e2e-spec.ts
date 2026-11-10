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

  it('makes a business; the owner signs in with email and a first password, and must choose their own (v2)', async () => {
    const email = `rafiq${tag}@almadina.pk`;
    const res = await api(app, superAdmin)
      .post('/superadmin/tenants/quick', { businessName: 'Al-Madina Traders', ownerName: 'Haji Rafiq', ownerEmail: email, ownerPhone: `0301 ${tag}`, language: 'ur', sortingStages: 1 })
      .expect(201);
    expect(res.body).toMatchObject({
      tenant: { name: 'Al-Madina Traders', companyCode: expect.stringMatching(/^ALMADINATRAD/) },
      owner: { name: 'Haji Rafiq', email, phone: `+92301${tag}`, phoneLocal: `0301 ${tag}` },
      temporaryPassword: expect.any(String),
      signInUrl: expect.stringMatching(/\/auth\/login$/),
    });
    expect(res.body.pin).toBeUndefined();
    const password = res.body.temporaryPassword as string;
    expect(res.body.welcome).toContain(email);
    expect(res.body.welcome).toContain(password);
    expect(res.body.welcome).toContain('السلام علیکم');

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: res.body.tenant.id }, include: { roles: true, categories: true } });
    expect(tenant).toMatchObject({ defaultLanguage: 'ur', sortingStages: 1, setupCompletedAt: null });
    expect(tenant.categories.length).toBeGreaterThan(0);
    // The owner, the staff roles and one that can only look.
    expect(tenant.roles.map((r) => r.name).sort()).toEqual(['Admin', 'Buyer', 'Cashier', 'Manager', 'ReadOnly', 'Salesman', 'Sorter']);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.owner.id }, include: { userRoles: { include: { role: true } } } });
    expect(user.userRoles.map((r) => r.role.name)).toEqual(['Admin']);
    expect(user).toMatchObject({ pinHash: null, mustChangePassword: true });
    expect(user.passwordHash).not.toContain(password);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: tenant.id, action: 'TENANT_CREATED' } });
    expect(JSON.stringify(audit.metadataJson)).not.toContain(password);

    // Email signs in; the phone does not (it is not their login).
    const signIn = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone: `0301 ${tag}`, pin: '123456' }).expect(401);
    const ownerApi = api(app, { tenantId: tenant.id, userId: user.id, email, token: signIn.body.accessToken });
    expect((await ownerApi.get('/me').expect(200)).body.user.mustChangePassword).toBe(true);
    await ownerApi.post('/auth/password', { currentPassword: password, newPassword: 'Rafiq-own-pass-1' }).expect(204);
    const again1 = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'Rafiq-own-pass-1' }).expect(200);
    expect((await api(app, { tenantId: tenant.id, userId: user.id, email, token: again1.body.accessToken }).get('/me').expect(200)).body.user.mustChangePassword).toBe(false);

    // The console cannot give an owner a PIN; a new password makes them choose again.
    expect((await api(app, superAdmin).post(`/superadmin/tenants/${tenant.id}/users/${user.id}/pin`, {}).expect(400)).body.code).toBe('USES_PASSWORD');
    await api(app, superAdmin).post(`/superadmin/tenants/${tenant.id}/users/${user.id}/password`, {}).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).mustChangePassword).toBe(true);

    // Same name again gets the next code.
    const again = await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Al-Madina Traders', ownerName: 'Other', ownerEmail: `other${tag}@x.pk`, language: 'en' }).expect(201);
    expect(again.body.tenant.companyCode).toMatch(/-\d+$/);
    expect(again.body.welcome).toContain('Assalam o Alaikum Other!');
    expect(again.body.owner.phoneLocal).toBeNull();
  });

  it('every language works for a new business: Roman Urdu welcome, edit, and an unknown language refused', async () => {
    const made = (
      await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: `Roman Bales ${tag}`, ownerName: 'Bilal', ownerEmail: `bilal${tag}@x.pk`, language: 'roman' }).expect(201)
    ).body;
    expect(made.welcome).toContain('aap ka ThriftOS tayyar hai');
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: made.tenant.id } });
    expect(tenant).toMatchObject({ defaultLanguage: 'roman', locale: 'en-PK' });
    await api(app, superAdmin).patch(`/superadmin/tenants/${made.tenant.id}`, { defaultLanguage: 'en' }).expect(200);
    await api(app, superAdmin).patch(`/superadmin/tenants/${made.tenant.id}`, { defaultLanguage: 'roman' }).expect(200);
    await api(app, superAdmin).patch(`/superadmin/tenants/${made.tenant.id}`, { defaultLanguage: 'fr' }).expect(400);
    await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'French', ownerName: 'X', ownerEmail: `fr${tag}@x.pk`, language: 'fr' }).expect(400);
  });

  it('refuses an email or phone that already has a login, a bad phone, no email, and anyone but the super admin', async () => {
    expect((await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Dup Email', ownerName: 'X', ownerEmail: `rafiq${tag}@almadina.pk` }).expect(409)).body.code).toBe('EMAIL_TAKEN');
    expect((await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Dup Phone', ownerName: 'X', ownerEmail: `dup${tag}@x.pk`, ownerPhone: `0301 ${tag}` }).expect(409)).body.code).toBe('PHONE_TAKEN');
    expect((await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'Bad Phone', ownerName: 'X', ownerEmail: `bad${tag}@x.pk`, ownerPhone: '12' }).expect(400)).body.code).toBe('PHONE_INVALID');
    await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: 'No Email', ownerName: 'X', ownerPhone: `0309 ${tag}` }).expect(400);
    await api(app, owner).post('/superadmin/tenants/quick', { businessName: 'Nope', ownerName: 'X', ownerEmail: 'nope@x.pk' }).expect(403);
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
    expect(actions).toEqual(expect.arrayContaining(['SUPERADMIN_IMPERSONATE', 'SUPPORT_VIEW_WRITE_BLOCKED']));
    // Screens loaded in support view are not logged one by one (v2 review): opening and closing it are.
    expect(actions).not.toContain('SUPER_ADMIN_IMPERSONATED_ACCESS');
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
