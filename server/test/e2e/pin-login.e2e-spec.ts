import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** Task 3.7: munshi signs in with phone + PIN; 5 wrong PINs lock it for 15 minutes; the owner can unlock or reset. */
describe('Phone + PIN login (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestTenant;
  let other: TestTenant;
  const pinLogin = (phone: string, pin: string) => request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone, pin });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    owner = await createTenantWithOwner(app);
    other = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('the owner adds a munshi with name, phone and PIN; a phone has one login across all businesses', async () => {
    const m = await api(app, owner).post('/users/munshi', { name: 'Akram', phone: '0300-111 2223', pin: '4821' }).expect(201);
    expect(m.body).toEqual({ id: expect.any(String), name: 'Akram', phone: '+923001112223', isActive: true });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: m.body.id }, include: { userRoles: { include: { role: true } } } });
    expect(stored).toMatchObject({ email: null, passwordHash: null, failedPinAttempts: 0, pinLockedUntil: null });
    expect(stored.pinHash).not.toContain('4821');
    expect(stored.userRoles.map((r) => r.role.name)).toEqual(['Sorter']);

    await api(app, owner).post('/users/munshi', { name: 'Again', phone: '+92 300 1112223', pin: '1111' }).expect(409);
    await api(app, other).post('/users/munshi', { name: 'Elsewhere', phone: '03001112223', pin: '1111' }).expect(409);
    await api(app, owner).post('/users/munshi', { name: 'Short PIN', phone: '03001112299', pin: '12' }).expect(400);
    await api(app, owner).post('/users/munshi', { name: 'Letters', phone: '03001112298', pin: '12ab' }).expect(400);
    await api(app, owner).post('/users/munshi', { name: 'Bad phone', phone: '12', pin: '1234' }).expect(400);

    const team = await api(app, owner).get('/users/team').expect(200);
    expect(team.body.find((u: any) => u.name === 'Akram')).toMatchObject({ phone: '+923001112223', email: null, hasPin: true, locked: false, roles: ['Sorter'] });
    expect(JSON.stringify(team.body)).not.toContain('pinHash');
    expect((await api(app, other).get('/users/team').expect(200)).body.map((u: any) => u.name)).not.toContain('Akram');
  });

  it('a munshi signs in with phone + PIN and can do floor work, not see the owner numbers', async () => {
    const res = await pinLogin('0300 1112223', '4821').expect(200);
    expect(res.body.user).toMatchObject({ name: 'Akram', email: null, phone: '+923001112223', tenantId: owner.tenantId });
    const munshi = { ...owner, token: res.body.accessToken };
    await api(app, munshi).get('/sorting/stage-1/queue').expect(200);
    // A Sorter sorts; buying ready stock is the Buyer's (v2 staff roles).
    await api(app, munshi).post('/stock/items', { name: 'Tops', unit: 'KG', quantity: 10, totalCost: 1000 }).expect(403);
    await api(app, munshi).get('/home').expect(403);
    await api(app, munshi).post('/users/munshi', { name: 'X', phone: '03009998887', pin: '1234' }).expect(403);
    // The refresh token works for a PIN login too.
    await request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(200);
  });

  it('each staff role does its own work: Buyer buys, Salesman sells and takes payments, Cashier closes cash (v2)', async () => {
    const roles = (await api(app, owner).get('/users/team/roles').expect(200)).body.map((r: any) => r.name);
    expect(roles).toEqual(expect.arrayContaining(['Manager', 'Buyer', 'Sorter', 'Salesman', 'Cashier']));
    const add = async (name: string, phone: string, roleName: string) => {
      await api(app, owner).post('/users/staff', { name, phone, pin: '2580', roleName }).expect(201);
      return { ...owner, token: (await pinLogin(phone, '2580').expect(200)).body.accessToken };
    };
    const buyer = await add('Bilal', '03001112231', 'Buyer');
    const item = (await api(app, buyer).post('/stock/items', { name: 'Tops', unit: 'KG', quantity: 10, totalCost: 1000 }).expect(201)).body;
    await api(app, buyer).get('/sorting/stage-1/queue').expect(403);

    const salesman = await add('Sajid', '03001112232', 'Salesman');
    const customer = (await api(app, salesman).post('/customers', { name: 'Walk-in', phone: '0321 7654111' }).expect(201)).body;
    await api(app, salesman).post('/sales', { customerId: customer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, quantity: 1, unitPrice: 150 }] }).expect(201);
    await api(app, salesman).post('/workspace/expenses', { category: 'TRANSPORT', amount: 100 }).expect(403);
    await api(app, buyer).post('/sales', { customerId: customer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, quantity: 1, unitPrice: 150 }] }).expect(403);

    const cashier = await add('Kashif', '03001112233', 'Cashier');
    await api(app, cashier).get('/workspace/finance/close').expect(200);
    await api(app, cashier).get('/sorting/stage-1/queue').expect(403);

    // Staff never get the owner's role; another business's role is not found.
    const adminRole = (await api(app, owner).get('/users/team/roles').expect(200)).body.find((r: any) => r.name === 'Owner');
    expect((await api(app, owner).post('/users/staff', { name: 'X', phone: '03001112234', pin: '2580', roleId: adminRole.id }).expect(400)).body.code).toBe('OWNER_ROLE');
    const otherRole = (await api(app, other).get('/users/team/roles').expect(200)).body[0];
    await api(app, owner).post('/users/staff', { name: 'Y', phone: '03001112235', pin: '2580', roleId: otherRole.id }).expect(404);
  });

  it('wrong PINs count down; the 5th locks the PIN for 15 minutes, even for the right PIN', async () => {
    for (const left of [4, 3, 2, 1]) {
      const r = await pinLogin('03001112223', '0000').expect(401);
      expect(r.body).toMatchObject({ code: 'PIN_WRONG', triesLeft: left });
    }
    const locked = await pinLogin('03001112223', '0000').expect(423);
    expect(locked.body).toMatchObject({ code: 'PIN_LOCKED', minutes: 15 });
    await pinLogin('03001112223', '4821').expect(423);
    expect((await api(app, owner).get('/users/team').expect(200)).body.find((u: any) => u.name === 'Akram').locked).toBe(true);
  });

  it('the owner unlocks it (another business cannot); a reset PIN replaces the old one', async () => {
    const akram = await prisma.user.findUniqueOrThrow({ where: { phone: '+923001112223' } });
    await api(app, other).post(`/users/${akram.id}/unlock`).expect(404);
    await api(app, owner).post(`/users/${akram.id}/unlock`).expect(200);
    await pinLogin('03001112223', '4821').expect(200);

    await api(app, other).post(`/users/${akram.id}/pin`, { pin: '7777' }).expect(404);
    await api(app, owner).post(`/users/${akram.id}/pin`, { pin: '5930' }).expect(200);
    await pinLogin('03001112223', '4821').expect(401);
    await pinLogin('03001112223', '5930').expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: akram.id } })).failedPinAttempts).toBe(0);
  });

  it('a lock runs out by itself; a right PIN clears the count', async () => {
    const akram = await prisma.user.findUniqueOrThrow({ where: { phone: '+923001112223' } });
    await prisma.user.update({ where: { id: akram.id }, data: { pinLockedUntil: new Date(Date.now() - 1000), failedPinAttempts: 3 } });
    await pinLogin('03001112223', '5930').expect(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: akram.id } })).toMatchObject({ failedPinAttempts: 0, pinLockedUntil: null });
  });

  it('never says whether a phone is registered; inactive munshis cannot sign in; owners keep email + password', async () => {
    const unknown = await pinLogin('03215550000', '1234').expect(401);
    expect(unknown.body).toMatchObject({ code: 'PIN_WRONG' });
    expect(unknown.body.triesLeft).toBeUndefined();
    await pinLogin('03001112223', '12').expect(400);

    const akram = await prisma.user.findUniqueOrThrow({ where: { phone: '+923001112223' } });
    await prisma.user.update({ where: { id: akram.id }, data: { isActive: false } });
    await pinLogin('03001112223', '5930').expect(401);

    await request(app.getHttpServer()).post('/api/auth/login').send({ email: owner.email, password: 'test-password-1' }).expect(200);
  });

  it('every user can still sign in one way (database check)', async () => {
    await expect(prisma.user.create({ data: { tenantId: owner.tenantId, name: 'Nobody' } })).rejects.toThrow(/User_can_sign_in/);
  });
});
