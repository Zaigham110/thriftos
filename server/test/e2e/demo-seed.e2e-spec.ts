import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DEMO, DemoResult, seedDemo } from '../../src/demo/demo-seed';
import { HomeService } from '../../src/home/home.service';
import { KhataService } from '../../src/sales/khata.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from './fixtures';

/**
 * Task 4.1: the demo seed (the same code `npm run demo:reset` runs), here into the test database. Everything
 * is made through the app's services, so both data checks must find nothing, and the owner home must tell
 * the story at a glance.
 */
describe('Demo seed (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let result: DemoResult;
  const today = new Date();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    result = await seedDemo(app, { today });
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  it('costs and khata pass both data checks (0 rows)', () => {
    expect(result.checkRows).toEqual({ costChain: 0, khata: 0 });
  });

  it('has the size asked for: 3 suppliers, 6 containers over 3 months, 120 bales, 15 customers, 60 sales', async () => {
    const t = result.tenantId;
    expect(await prisma.vendor.count({ where: { tenantId: t } })).toBe(3);
    const containers = await prisma.container.findMany({ where: { tenantId: t }, orderBy: { createdAt: 'asc' } });
    expect(containers).toHaveLength(6);
    const spanDays = (containers[5].createdAt.getTime() - containers[0].createdAt.getTime()) / 86_400_000;
    expect(spanDays).toBeGreaterThan(60);
    expect(await prisma.containerCharge.count({ where: { container: { tenantId: t } } })).toBe(24);
    expect(await prisma.repackUnit.count({ where: { tenantId: t } })).toBe(120);
    expect(await prisma.customer.count({ where: { tenantId: t } })).toBe(15);
    expect(result.sales).toBe(60);
    const cities = new Set((await prisma.customer.findMany({ where: { tenantId: t }, select: { city: true } })).map((c) => c.city));
    expect([...cities].sort()).toEqual(['Karachi', 'Lahore', 'Peshawar']);
    expect(await prisma.customer.count({ where: { tenantId: t, openingBalance: { gt: 0 } } })).toBeGreaterThanOrEqual(3);
    expect(await prisma.tenant.findUniqueOrThrow({ where: { id: t } })).toMatchObject({ name: 'Al-Madina Traders (Demo)', currency: 'PKR', defaultLanguage: 'ur', sortingStages: 2 });
  });

  it('the owner home tells the story: USA gives the best profit per kg and the most A grade; today is not empty', async () => {
    const home = app.get(HomeService);
    const summary = await home.summary(result.tenantId, today);
    expect(summary.today.sales).toBeGreaterThan(0);
    expect(Number(summary.udhaar.owed)).toBeGreaterThan(0);
    expect(Number(summary.stockReady.bales)).toBeGreaterThan(0);
    expect(Number(summary.profitPerContainer.average)).toBeGreaterThan(0);

    const list = await home.containers(result.tenantId, 10);
    expect(list.byOrigin.map((o) => o.name)).toEqual(['USA', 'UK', 'Korea']);
    expect(list.byOrigin.map((o) => o.topGradePercent)).toEqual([18, 14, 10]);
    expect(Number(list.byOrigin[0].profitPerKg)).toBeGreaterThan(Number(list.byOrigin[2].profitPerKg) * 1.5);

    // Overdue udhaar: some customers have owed for more than a month.
    const khata = await app.get(KhataService).list(result.tenantId);
    expect(khata.customers.filter((c: { overdueDays: number }) => c.overdueDays > 30).length).toBeGreaterThanOrEqual(3);
  });

  it('the trader business sells ready stock only (no sorting)', async () => {
    const trader = await prisma.tenant.findUniqueOrThrow({ where: { id: result.traderTenantId } });
    expect(trader.sortingStages).toBe(0);
    expect(trader.enabledModules).not.toContain('SORT');
    expect(await prisma.sortSession.count({ where: { tenantId: trader.id } })).toBe(0);
    expect(await prisma.sale.count({ where: { tenantId: trader.id } })).toBe(6);
    expect(await prisma.inventoryItem.count({ where: { tenantId: trader.id, parentItemId: { not: null } } })).toBe(3);
  });

  it('the demo logins work: owner (email + password), munshi (phone + PIN), trader', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/auth/login').send(DEMO.owner).expect(200);
    await request(server).post('/api/auth/login').send(DEMO.trader).expect(200);
    await request(server).post('/api/auth/login/pin').send(DEMO.munshi).expect(200);
  });
});
