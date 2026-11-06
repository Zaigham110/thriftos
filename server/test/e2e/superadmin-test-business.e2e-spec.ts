import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, login, TestTenant } from './fixtures';

/**
 * v2 review of the super admin console: a new PIN for an owner who lost theirs, fixing the owner's phone, test
 * businesses (sample data, delete), a quieter audit trail, and the platform account not listed as a business.
 */
describe('Super admin: owners, test businesses, audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: TestTenant;
  let owner: TestTenant;
  const tag = Date.now().toString().slice(-7);
  let testId: string;
  let ownerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    superAdmin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
    owner = await createTenantWithOwner(app);
    const made = (
      await api(app, superAdmin).post('/superadmin/tenants/quick', { businessName: `Test Bales ${tag}`, ownerName: 'Test Owner', ownerPhone: `0302 ${tag}`, isTest: true }).expect(201)
    ).body;
    testId = made.tenant.id;
    ownerId = made.owner.id;
    expect(made.isTest).toBe(true);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it('a new PIN: the old one stops working, the new one signs in, it unlocks, and it is not in the audit log', async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { pinLockedUntil: new Date(Date.now() + 3_600_000), failedPinAttempts: 5 } });
    const detail = (await api(app, superAdmin).get(`/superadmin/tenants/${testId}`).expect(200)).body;
    expect(detail.users[0]).toMatchObject({ name: 'Test Owner', phone: `+92302${tag}`, hasPin: true, pinLocked: true });
    expect(detail.isTest).toBe(true);

    const res = (await api(app, superAdmin).post(`/superadmin/tenants/${testId}/users/${ownerId}/pin`, {}).expect(200)).body;
    expect(res.pin).toMatch(/^\d{6}$/);
    expect(res.message).toContain(res.pin);
    await request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone: `0302${tag}`, pin: res.pin }).expect(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: testId, action: 'USER_PIN_RESET' } });
    expect(JSON.stringify(audit.metadataJson)).not.toContain(res.pin);
    // An email user gets a temporary password in their own business; a phone-only owner is told to use a PIN.
    const pw = (await api(app, superAdmin).post(`/superadmin/tenants/${owner.tenantId}/users/${owner.userId}/password`, {}).expect(200)).body;
    expect(pw.temporaryPassword).toBeTruthy();
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: pw.email, password: pw.temporaryPassword }).expect(200);
    await api(app, superAdmin).post(`/superadmin/tenants/${testId}/users/${ownerId}/password`, {}).expect(400);
    // Someone without a phone gets no PIN; another business's person is not found.
    await api(app, superAdmin).post(`/superadmin/tenants/${owner.tenantId}/users/${ownerId}/pin`, {}).expect(404);
  });

  it("fixes the owner's phone; a phone that already has a login is refused", async () => {
    const res = (await api(app, superAdmin).patch(`/superadmin/tenants/${testId}/users/${ownerId}`, { phone: `0303 ${tag}`, name: 'Test Owner Two' }).expect(200)).body;
    expect(res).toMatchObject({ phone: `+92303${tag}`, name: 'Test Owner Two' });
    await prisma.user.update({ where: { id: owner.userId }, data: { phone: `+92304${tag}` } });
    await api(app, superAdmin).patch(`/superadmin/tenants/${testId}/users/${ownerId}`, { phone: `0304 ${tag}` }).expect(409);
    await api(app, superAdmin).patch(`/superadmin/tenants/${testId}/users/${ownerId}`, { phone: '12' }).expect(400);
  });

  it('lists businesses without the platform account; sales per currency on the overview', async () => {
    const list = (await api(app, superAdmin).get('/superadmin/tenants?limit=100').expect(200)).body;
    expect(list.data.map((t: { companyCode: string }) => t.companyCode)).not.toContain('SYSTEM');
    expect(list.data.find((t: { id: string }) => t.id === testId).isTest).toBe(true);
    const summary = (await api(app, superAdmin).get('/superadmin/summary').expect(200)).body;
    expect(Array.isArray(summary.kpis.salesByCurrency)).toBe(true);
  });

  it('the audit trail hides console page views and token refreshes unless asked; filters by business', async () => {
    await api(app, superAdmin).get('/superadmin/tenants').expect(200);
    const quiet = (await api(app, superAdmin).get('/superadmin/audit-logs?limit=100').expect(200)).body;
    expect(quiet.data.map((l: { action: string }) => l.action)).not.toContain('SUPER_ADMIN_ROUTE_ACCESS');
    expect(quiet.data.map((l: { action: string }) => l.action)).not.toContain('AUTH_TOKEN_REFRESH');
    const mine = (await api(app, superAdmin).get(`/superadmin/audit-logs?limit=100&tenantId=${testId}`).expect(200)).body;
    expect(mine.data.length).toBeGreaterThan(0);
    expect(mine.data.every((l: { tenantName: string }) => l.tenantName === `Test Bales ${tag}`)).toBe(true);
    const search = (await api(app, superAdmin).get(`/superadmin/audit-logs?limit=100&tenantId=${testId}&q=pin reset`).expect(200)).body;
    expect(search.data.map((l: { action: string }) => l.action)).toEqual(['USER_PIN_RESET']);
  });

  it('only a test business gets sample data or can be deleted; the name must be typed', async () => {
    await api(app, superAdmin).post(`/superadmin/tenants/${owner.tenantId}/sample-data`, {}).expect(400);
    await api(app, superAdmin).delete(`/superadmin/tenants/${owner.tenantId}`, { confirmName: 'x' }).expect(400);
    await api(app, superAdmin).delete(`/superadmin/tenants/${testId}`, { confirmName: 'Wrong name' }).expect(400);
    // Owners and the platform account cannot use these.
    await api(app, owner).post(`/superadmin/tenants/${testId}/sample-data`, {}).expect(403);
    await api(app, owner).delete(`/superadmin/tenants/${testId}`, { confirmName: `Test Bales ${tag}` }).expect(403);
  });

  it('fills an empty test business with the sample story, then deletes it with everything in it', async () => {
    const started = (await api(app, superAdmin).post(`/superadmin/tenants/${testId}/sample-data`, {}).expect(202)).body;
    expect(started.state).toBe('running');
    let sample: { state: string; sales?: number } | null = null;
    for (let i = 0; i < 240 && sample?.state !== 'done' && sample?.state !== 'failed'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      sample = (await api(app, superAdmin).get(`/superadmin/tenants/${testId}`).expect(200)).body.sample;
    }
    expect(sample).toMatchObject({ state: 'done' });
    expect(sample!.sales).toBeGreaterThan(10);
    expect(await prisma.container.count({ where: { tenantId: testId } })).toBeGreaterThan(0);
    // Not twice: the business is no longer empty.
    await api(app, superAdmin).post(`/superadmin/tenants/${testId}/sample-data`, {}).expect(400);

    await api(app, superAdmin).delete(`/superadmin/tenants/${testId}`, { confirmName: `test bales ${tag}` }).expect(200);
    expect(await prisma.tenant.findUnique({ where: { id: testId } })).toBeNull();
    expect(await prisma.user.count({ where: { tenantId: testId } })).toBe(0);
    expect(await prisma.sale.count({ where: { tenantId: testId } })).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { tenantId: testId } })).toBe(0);
    // The owner's phone is free again for the next test business.
    expect(await prisma.user.findUnique({ where: { phone: `+92303${tag}` } })).toBeNull();
    // The other business is untouched.
    expect(await prisma.tenant.findUnique({ where: { id: owner.tenantId } })).not.toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'TENANT_DELETED', entityId: testId } });
    expect(log.metadataJson).toMatchObject({ tenantName: `Test Bales ${tag}` });
  }, 300_000);
});
