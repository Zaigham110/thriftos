import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTestApp, createUserWithoutPermissions, login, TestTenant } from './fixtures';

/** Task 3.8: a new business goes through the setup wizard once and is ready to work. */
describe('Setup wizard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  /** A tenant made the way a real one is: by the super admin, with its owner login. */
  async function newBusiness(): Promise<TestTenant> {
    const admin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
    const suffix = randomUUID().slice(0, 6).toUpperCase();
    const email = `owner-${suffix.toLowerCase()}@test.local`;
    await api(app, admin).post('/superadmin/tenants', { name: `New ${suffix}`, companyCode: `N${suffix}`, adminEmail: email, adminName: 'Owner', adminPassword: 'owner-pass-1' }).expect(201);
    return login(app, email, 'owner-pass-1');
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a new business starts from the Karachi list and is set up in one save', async () => {
    const owner = await newBusiness();
    expect((await api(app, owner).get('/tenant').expect(200)).body.setupCompletedAt).toBeNull();
    const start = await api(app, owner).get('/tenant/setup').expect(200);
    expect(start.body).toMatchObject({ done: false, currency: 'PKR', categories: expect.arrayContaining(['Jeans', 'T-Shirts', 'Jackets']), grades: ['Cream', 'A', 'B', 'C'] });

    const phone = `0345${Date.now().toString().slice(-7)}`;
    const body = {
      businessName: 'Al-Madina Traders',
      currency: 'PKR',
      language: 'ur',
      sortingStages: 2,
      categories: ['Jeans', 'jeans ', 'T-Shirts', 'Pathani suits', '  '],
      grades: ['Cream', 'A', 'B'],
      munshi: { name: 'Akram', phone, pin: '4821' },
    };
    const key = randomUUID();
    const saved = await api(app, owner).post('/tenant/setup', body).set('Idempotency-Key', key).expect(200);
    const again = await api(app, owner).post('/tenant/setup', body).set('Idempotency-Key', key).expect(200);
    expect(again.body).toEqual(saved.body);
    expect(saved.body).toMatchObject({ done: true, businessName: 'Al-Madina Traders', language: 'ur', sortingStages: 2, categories: ['Jeans', 'T-Shirts', 'Pathani suits'], grades: ['Cream', 'A', 'B'] });

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } });
    expect(tenant).toMatchObject({ name: 'Al-Madina Traders', defaultLanguage: 'ur', sortingStages: 2 });
    expect(tenant.setupCompletedAt).not.toBeNull();
    expect(tenant.enabledModules).toEqual(expect.arrayContaining(['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA']));

    // The floor sees exactly these tiles, in this order; the template's others are switched off, not deleted.
    const tiles = await api(app, owner).get('/tenant/categories').expect(200);
    expect(tiles.body.map((c: { name: string }) => c.name)).toEqual(['Jeans', 'T-Shirts', 'Pathani suits']);
    expect(await prisma.category.count({ where: { tenantId: owner.tenantId, isActive: false } })).toBeGreaterThan(0);
    const grades = await prisma.grade.findMany({ where: { tenantId: owner.tenantId, isActive: true }, orderBy: { rank: 'asc' } });
    expect(grades.map((g) => [g.name, g.rank])).toEqual([['Cream', 1], ['A', 2], ['B', 3]]);
    expect(await prisma.wasteCategory.count({ where: { tenantId: owner.tenantId, name: 'Waste/Katran', isActive: true } })).toBe(1);

    // The munshi was added once and can sign in.
    expect(await prisma.user.count({ where: { tenantId: owner.tenantId, pinHash: { not: null } } })).toBe(1);
    await request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone, pin: '4821' }).expect(200);

    // Opening the wizard again shows the business's own choices.
    expect((await api(app, owner).get('/tenant/setup').expect(200)).body).toMatchObject({ done: true, categories: ['Jeans', 'T-Shirts', 'Pathani suits'] });
  });

  it('a trader who does not sort gets no Chhantai tab and needs no categories', async () => {
    const owner = await newBusiness();
    await api(app, owner).post('/tenant/setup', { businessName: 'Lahore Bales', currency: 'PKR', language: 'en', sortingStages: 0, categories: [], grades: [] }).expect(200);
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } });
    expect(tenant.enabledModules).not.toContain('SORT');
    expect(tenant.enabledModules).toEqual(expect.arrayContaining(['RECEIVE', 'STOCK', 'SELL', 'KHATA']));
    expect(tenant.sortingStages).toBe(0);
  });

  it('says what is missing, saves nothing when the munshi phone is taken, and is for the owner only', async () => {
    const owner = await newBusiness();
    const base = { businessName: 'X', currency: 'PKR', language: 'en', categories: ['Jeans'], grades: ['A'] };
    const noCats = await api(app, owner).post('/tenant/setup', { ...base, sortingStages: 1, categories: [' '] }).expect(400);
    expect(noCats.body.message).toContain('at least one category');
    const noGrades = await api(app, owner).post('/tenant/setup', { ...base, sortingStages: 2, grades: [] }).expect(400);
    expect(noGrades.body.message).toContain('grade');
    await api(app, owner).post('/tenant/setup', { ...base, sortingStages: 3 }).expect(400);
    await api(app, owner).post('/tenant/setup', { ...base, sortingStages: 1, language: 'fr' }).expect(400);

    const taken = await prisma.user.findFirst({ where: { phone: { not: null } }, select: { phone: true } });
    await api(app, owner).post('/tenant/setup', { ...base, sortingStages: 1, munshi: { name: 'M', phone: taken!.phone, pin: '1234' } }).expect(409);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } })).setupCompletedAt).toBeNull();

    const plain = await createUserWithoutPermissions(app, owner.tenantId);
    await api(app, plain).get('/tenant/setup').expect(403);
    await api(app, plain).post('/tenant/setup', { ...base, sortingStages: 1 }).expect(403);
  });
});
