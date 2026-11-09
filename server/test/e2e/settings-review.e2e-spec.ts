import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/**
 * v2 review (Settings): the business's phone and address on bills and messages, one Business page, Team that can
 * stop someone's access and give it back, fix a name or phone, change a role and add someone with email, and
 * people who sign in with phone + PIN change their own PIN. Errors carry codes; another business changes nothing.
 */
describe('Settings review (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const pinLogin = (phone: string, pin: string) => request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone, pin });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Business: name, phone, address and city; currency fixed once money is recorded; codes for mistakes', async () => {
    await api(app, a).patch('/tenant/business', { name: 'Al-Noor Bales', phone: '0300-1112233', address: 'Shop 12, Landa Bazaar', city: 'Lahore' }).expect(200);
    const d = (await api(app, a).get('/tenant/business').expect(200)).body;
    expect(d).toMatchObject({ name: 'Al-Noor Bales', phone: '0300 1112233', address: 'Shop 12, Landa Bazaar', city: 'Lahore', contact: '0300 1112233 · Shop 12, Landa Bazaar · Lahore' });
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId } })).phone).toBe('+923001112233');
    expect((await api(app, a).patch('/tenant/business', { phone: '12' }).expect(400)).body.code).toBe('PHONE_INVALID');

    await api(app, a).post('/stock/items', { name: 'Jeans bale', unit: 'BALE', quantity: 2, totalCost: 12000 }).expect(201);
    expect((await api(app, a).get('/tenant/business').expect(200)).body.currencyLocked).toBe(true);
    expect((await api(app, a).patch('/tenant/business', { currency: d.currency === 'PKR' ? 'USD' : 'PKR' }).expect(400)).body.code).toBe('CURRENCY_LOCKED');

    await prisma.grade.updateMany({ where: { tenantId: a.tenantId }, data: { isActive: false } });
    await api(app, a).patch('/tenant/business', { sortingStages: 0 }).expect(200);
    expect((await api(app, a).patch('/tenant/business', { sortingStages: 2 }).expect(400)).body.code).toMatch(/NO_(CATEGORIES|GRADES)/);
    expect(await prisma.auditLog.count({ where: { tenantId: a.tenantId, action: 'BUSINESS_UPDATED' } })).toBeGreaterThan(0);
    // Another business keeps its own.
    expect((await api(app, b).get('/tenant/business').expect(200)).body.phone).toBe('');
  });

  it('bills, receipts, reminders and statements carry the business phone and address', async () => {
    const c = (await api(app, a).post('/customers', { name: 'Gul Khan', phone: '0300 4445566' }).expect(201)).body;
    const item = (await api(app, a).post('/stock/items', { name: 'Shirts bale', unit: 'BALE', quantity: 1, totalCost: 6000 }).expect(201)).body;
    const sale = (await api(app, a).post('/sales', { customerId: c.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 10000 }] }).expect(201)).body;
    const contact = '0300 1112233 · Shop 12, Landa Bazaar · Lahore';
    expect((await api(app, a).get(`/sales/${sale.id}/whatsapp`).expect(200)).body.text).toContain(contact);
    expect((await api(app, a).get(`/sales/${sale.id}/print`).expect(200)).body.businessContact).toBe(contact);
    expect((await api(app, a).get(`/khata/customers/${c.id}/reminder`).expect(200)).body.text).toContain(contact);
    expect((await api(app, a).get(`/workspace/customers/${c.id}/statement`).expect(200)).body.businessContact).toBe(contact);
    const pay = (await api(app, a).post('/khata/payments', { customerId: c.id, amount: 2000, method: 'CASH' }).expect(201)).body;
    expect((await api(app, a).get(`/khata/payments/${pay.id ?? pay.payment?.id}/receipt`).expect(200)).body.businessContact).toBe(contact);
  });

  it('Team: stop access (signed out now), give it back, fix name and phone, change role, add someone with email', async () => {
    const m = (await api(app, a).post('/users/munshi', { name: 'Akram', phone: '0300 765 1101', pin: '4821' }).expect(201)).body;
    const token = (await pinLogin('03007651101', '4821').expect(200)).body.accessToken;
    const munshi = { ...a, token };
    await api(app, munshi).get('/me').expect(200);

    await api(app, a).post(`/users/${m.id}/stop`, {}).expect(200);
    await api(app, munshi).get('/me').expect(401);
    await pinLogin('03007651101', '4821').expect(401);
    const team = (await api(app, a).get('/users/team').expect(200)).body;
    expect(team.find((u: { id: string }) => u.id === m.id)).toMatchObject({ isActive: false, roles: ['Munshi'] });
    expect(team.find((u: { you: boolean }) => u.you)).toBeTruthy();
    await api(app, a).post(`/users/${m.id}/start`, {}).expect(200);
    await pinLogin('03007651101', '4821').expect(200);

    // Not yourself.
    expect((await api(app, a).post(`/users/${a.userId}/stop`, {}).expect(400)).body.code).toBe('SELF');
    expect((await api(app, a).put(`/users/${a.userId}/role`, { roleId: team[0].roleIds[0] }).expect(400)).body.code).toBe('SELF');

    // Name and phone: codes for mistakes; a PIN user keeps a phone.
    await api(app, a).patch(`/users/${m.id}/details`, { name: 'Akram Ali', phone: '0300 765 1102' }).expect(200);
    await pinLogin('03007651102', '4821').expect(200);
    expect((await api(app, a).patch(`/users/${m.id}/details`, { phone: '' }).expect(400)).body.code).toBe('PHONE_NEEDED');
    expect((await api(app, a).patch(`/users/${m.id}/details`, { phone: 'abc' }).expect(400)).body.code).toBe('PHONE_INVALID');
    await api(app, a).post('/users/munshi', { name: 'Bilal', phone: '0300 765 1103', pin: '1234' }).expect(201);
    expect((await api(app, a).patch(`/users/${m.id}/details`, { phone: '0300 765 1103' }).expect(409)).body.code).toBe('PHONE_TAKEN');
    expect((await api(app, a).post('/users/munshi', { name: 'Again', phone: '0300 765 1103', pin: '1234' }).expect(409)).body.code).toBe('PHONE_TAKEN');

    // Role: one per person.
    const roles = (await api(app, a).get('/users/team/roles').expect(200)).body as { id: string; name: string; people: number }[];
    const owner = roles.find((r) => r.name === 'Owner')!;
    await api(app, a).put(`/users/${m.id}/role`, { roleId: owner.id }).expect(200);
    expect((await api(app, a).get('/users/team').expect(200)).body.find((u: { id: string }) => u.id === m.id).roles).toEqual(['Owner']);

    // Someone with email: a first password, once.
    const p = (await api(app, a).post('/users/team/person', { name: 'Sana', email: 'sana.settings@test.local', roleId: owner.id }).expect(201)).body;
    expect(p.temporaryPassword).toEqual(expect.any(String));
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'sana.settings@test.local', password: p.temporaryPassword }).expect(200);
    expect((await api(app, a).post('/users/team/person', { name: 'Sana', email: 'sana.settings@test.local', roleId: owner.id }).expect(409)).body.code).toBe('EMAIL_TAKEN');

    // Another business can do none of it.
    await api(app, b).post(`/users/${m.id}/stop`, {}).expect(404);
    await api(app, b).patch(`/users/${m.id}/details`, { name: 'X' }).expect(404);
    await api(app, b).put(`/users/${m.id}/role`, { roleId: owner.id }).expect(404);
    await api(app, a).put(`/users/${m.id}/role`, { roleId: (await prisma.role.findFirstOrThrow({ where: { tenantId: b.tenantId } })).id }).expect(404);
    expect((await api(app, b).get('/users/team').expect(200)).body.some((u: { id: string }) => u.id === m.id)).toBe(false);
  });

  it('a munshi changes their own PIN; the owner (email) is told to use the password', async () => {
    await api(app, a).post('/users/munshi', { name: 'Danish', phone: '0300 765 1104', pin: '2468' }).expect(201);
    const munshi = { ...a, token: (await pinLogin('03007651104', '2468').expect(200)).body.accessToken };
    expect((await api(app, munshi).post('/auth/pin', { currentPin: '1111', newPin: '1357' }).expect(401)).body.code).toBe('PIN_WRONG');
    expect((await api(app, munshi).post('/auth/pin', { currentPin: '2468', newPin: '2468' }).expect(400)).body.code).toBe('SAME_PIN');
    await api(app, munshi).post('/auth/pin', { currentPin: '2468', newPin: '12' }).expect(400);
    await api(app, munshi).post('/auth/pin', { currentPin: '2468', newPin: '1357' }).expect(204);
    await pinLogin('03007651104', '2468').expect(401);
    await pinLogin('03007651104', '1357').expect(200);
    expect((await api(app, a).post('/auth/pin', { currentPin: '1234', newPin: '5678' }).expect(400)).body.code).toBe('NO_PIN');
    // The munshi cannot open the business or the team.
    await api(app, munshi).get('/tenant/business').expect(403);
    await api(app, munshi).post('/users/team/person', { name: 'X', email: 'x@test.local', roleId: 'x' }).expect(403);
  });
});
