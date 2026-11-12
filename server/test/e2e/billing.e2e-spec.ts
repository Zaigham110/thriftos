import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, login, TestTenant } from './fixtures';

const DAY = 86_400_000;
const days = (n: number) => new Date(Date.now() + n * DAY).toISOString();

/**
 * Phase 7 acceptance: a business moves trial → paid → expired (grace) → read-only → paid again, with the right
 * modules at each step; plans limit logins; payments are confirmed by the super admin only; one business never sees
 * another's billing.
 */
describe('Phase 7 billing: plans, trial, manual payment, grace and read-only (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestTenant;
  let a: TestTenant;
  let b: TestTenant;
  let plans: Record<string, { id: string; modules: string[] }>;

  const modulesOf = async (t: TestTenant) => (await api(app, t).get('/tenant').expect(200)).body.enabledModules as string[];
  const billingOf = async (t: TestTenant) => (await api(app, t).get('/billing').expect(200)).body;
  const pay = (t: TestTenant, planId: string, period: 'MONTH' | 'YEAR') =>
    request(app.getHttpServer())
      .post('/api/billing/payments')
      .set('Authorization', `Bearer ${t.token}`)
      .field('planId', planId)
      .field('period', period)
      .field('method', 'JAZZCASH')
      .field('reference', 'TX-778899')
      .attach('screenshot', Buffer.from('\x89PNG\r\n\x1a\nfake'), { filename: 'paid.png', contentType: 'image/png' });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const list = (await api(app, admin).get('/superadmin/billing/plans').expect(200)).body as Array<{ id: string; code: string; modules: string[] }>;
    plans = Object.fromEntries(list.map((p) => [p.code, p]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('has the four plans the owner chose, and only the super admin sees the console', async () => {
    expect(Object.keys(plans).sort()).toEqual(['EXPORT', 'FREE', 'IMPORTER', 'WORKSHOP']);
    const list = (await api(app, admin).get('/superadmin/billing/plans').expect(200)).body;
    expect(list.map((p: any) => [p.code, Number(p.monthlyPrice), Number(p.yearlyPrice), p.maxUsers])).toEqual([
      ['FREE', 0, 0, 1], ['WORKSHOP', 4000, 40000, 5], ['IMPORTER', 8000, 80000, 15], ['EXPORT', 15000, 150000, null],
    ]);
    await api(app, a).get('/superadmin/billing/plans').expect(403);
    await api(app, a).get('/superadmin/billing/revenue').expect(403);
    // A business without a plan keeps working as before.
    expect((await billingOf(a)).state).toBe('CUSTOM');
  });

  it('a new business from the console starts the 14-day Workshop trial, its modules from the plan', async () => {
    const tag = randomUUID().slice(0, 6);
    const made = (await api(app, admin).post('/superadmin/tenants/quick', { businessName: `Trial Bales ${tag}`, ownerName: 'Seth', ownerEmail: `trial-${tag}@test.local`, sortingStages: 2 }).expect(201)).body;
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: made.tenant.id }, include: { plan: true } });
    expect(t.plan?.code).toBe('WORKSHOP');
    expect(Math.round((t.trialEndsAt!.getTime() - Date.now()) / DAY)).toBe(14);
    expect(t.enabledModules).toEqual(expect.arrayContaining(['RECEIVE', 'STOCK', 'SELL', 'SORT', 'LOOSE_LOTS', 'KHATA', 'STAFF']));
    expect(t.enabledModules).not.toContain('CONTAINERS');
    // "No plan" keeps the old way: modules by hand, never expires.
    const byHand = (await api(app, admin).post('/superadmin/tenants/quick', { businessName: `Hand Bales ${tag}`, ownerName: 'Seth', ownerEmail: `hand-${tag}@test.local`, plan: 'NONE' }).expect(201)).body;
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: byHand.tenant.id } })).planId).toBeNull();
  });

  it('trial → trial over (Free) → paid → grace → read-only → paid again, with the right modules at each step', async () => {
    // On trial: Workshop modules, the banner counts the days.
    await api(app, admin).patch(`/superadmin/billing/tenants/${a.tenantId}`, { planId: plans.WORKSHOP.id, trialEndsAt: days(5), paidUntil: null }).expect(200);
    let me = (await api(app, a).get('/tenant').expect(200)).body;
    expect(me.billing).toMatchObject({ state: 'TRIAL', plan: 'Workshop', daysLeft: 5 });
    expect(me.enabledModules).toContain('LOOSE_LOTS');

    // Trial over, nothing paid: the Free plan's modules (data kept), not read-only.
    await api(app, admin).patch(`/superadmin/billing/tenants/${a.tenantId}`, { trialEndsAt: days(-1) }).expect(200);
    expect((await billingOf(a)).state).toBe('TRIAL_OVER');
    let mods = await modulesOf(a);
    expect(mods).toEqual(expect.arrayContaining(['READY_STOCK', 'KHATA']));
    expect(mods).not.toContain('LOOSE_LOTS');
    await api(app, a).post('/procurement/vendors', { name: 'Still writes' }).expect(201);

    // Pays for Importer, monthly: waiting until confirmed; a second payment is refused meanwhile.
    const sent = (await pay(a, plans.IMPORTER.id, 'MONTH').expect(201)).body;
    expect([Number(sent.amount), sent.status]).toEqual([8000, 'PENDING']);
    await pay(a, plans.IMPORTER.id, 'MONTH').expect(409);
    // The business cannot confirm its own payment; the super admin sees the screenshot and confirms.
    await api(app, a).post(`/superadmin/billing/payments/${sent.id}/confirm`).expect(403);
    const shot = await request(app.getHttpServer()).get(`/api/superadmin/billing/payments/${sent.id}/screenshot`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    expect(shot.headers['content-type']).toContain('image/png');
    const ok = (await api(app, admin).post(`/superadmin/billing/payments/${sent.id}/confirm`).expect(200)).body;
    expect(ok.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    await api(app, admin).post(`/superadmin/billing/payments/${sent.id}/confirm`).expect(409);
    let bill = await billingOf(a);
    expect(bill.state).toBe('ACTIVE');
    expect(bill.plan.code).toBe('IMPORTER');
    expect(Math.round((new Date(bill.paidUntil).getTime() - Date.now()) / DAY)).toBeGreaterThanOrEqual(28);
    mods = await modulesOf(a);
    expect(mods).toEqual(expect.arrayContaining(['CONTAINERS', 'PNL', 'REPORTS']));
    // Its invoice; another business cannot see it.
    const inv = (await api(app, a).get(`/billing/payments/${sent.id}/invoice`).expect(200)).body;
    expect([inv.number, Number(inv.amount), inv.plan]).toEqual([ok.invoiceNumber, 8000, 'Importer']);
    await api(app, b).get(`/billing/payments/${sent.id}/invoice`).expect(404);
    await request(app.getHttpServer()).get(`/api/billing/payments/${sent.id}/screenshot`).set('Authorization', `Bearer ${b.token}`).expect(404);

    // The paid month ended 3 days ago: grace (everything works, banner says how many days).
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { paidUntil: new Date(Date.now() - 3 * DAY) } });
    bill = await billingOf(a);
    expect([bill.state, bill.daysLeft]).toEqual(['GRACE', 4]);
    await api(app, a).post('/procurement/vendors', { name: 'Grace writes' }).expect(201);

    // 10 days ago: read-only. Reading and exporting work, changes are refused, paying still works.
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { paidUntil: new Date(Date.now() - 10 * DAY) } });
    expect((await api(app, a).get('/tenant').expect(200)).body.billing.state).toBe('READ_ONLY');
    expect((await modulesOf(a))).toContain('CONTAINERS');
    const refused = (await api(app, a).post('/procurement/vendors', { name: 'Blocked' }).expect(403)).body;
    expect(refused.code).toBe('READ_ONLY');
    await api(app, a).get('/procurement/vendors').expect(200);
    await api(app, a).get('/tenant/export').expect(200);
    // Another business is not affected.
    await api(app, b).post('/procurement/vendors', { name: 'Other business writes' }).expect(201);

    // Paid again (a year): active again from today, a year long.
    const again = (await pay(a, plans.IMPORTER.id, 'YEAR').expect(201)).body;
    expect(Number(again.amount)).toBe(80000);
    await api(app, admin).post(`/superadmin/billing/payments/${again.id}/confirm`).expect(200);
    bill = await billingOf(a);
    expect(bill.state).toBe('ACTIVE');
    expect(Math.round((new Date(bill.paidUntil).getTime() - Date.now()) / DAY)).toBeGreaterThanOrEqual(364);
    await api(app, a).post('/procurement/vendors', { name: 'Writes again' }).expect(201);

    // Revenue: a's yearly payment as a month (80,000 / 12).
    const rev = (await api(app, admin).get('/superadmin/billing/revenue').expect(200)).body;
    const row = rev.businesses.find((x: any) => x.id === a.tenantId);
    expect([row.state, Number(row.monthly)]).toEqual(['ACTIVE', 6666.67]);
  });

  it('a payment can be rejected with a reason; the Free plan cannot be paid for', async () => {
    const sent = (await pay(b, plans.WORKSHOP.id, 'MONTH').expect(201)).body;
    await api(app, admin).post(`/superadmin/billing/payments/${sent.id}/reject`, { reason: '' }).expect(400);
    await api(app, admin).post(`/superadmin/billing/payments/${sent.id}/reject`, { reason: 'Amount not received' }).expect(200);
    const bill = await billingOf(b);
    expect(bill.payments[0]).toMatchObject({ status: 'REJECTED', rejectReason: 'Amount not received' });
    await pay(b, plans.FREE.id, 'MONTH').expect(400);
  });

  it('the plan limits logins (owner and staff count); Free has no staff at all', async () => {
    const c = await createTenantWithOwner(app);
    const phone = (p: string) => `${p} ${String(Date.now()).slice(-7)}`;
    // Free: no Staff module.
    await api(app, admin).patch(`/superadmin/billing/tenants/${c.tenantId}`, { planId: plans.FREE.id }).expect(200);
    await api(app, c).post('/users/munshi', { name: 'Akram', phone: phone('0300'), pin: '4821' }).expect(403);
    // Workshop with a limit of 1 login: the owner is it.
    await api(app, admin).patch(`/superadmin/billing/plans/${plans.WORKSHOP.id}`, { maxUsers: 1 }).expect(200);
    await api(app, admin).patch(`/superadmin/billing/tenants/${c.tenantId}`, { planId: plans.WORKSHOP.id, paidUntil: days(30) }).expect(200);
    const res = (await api(app, c).post('/users/munshi', { name: 'Akram', phone: phone('0301'), pin: '4821' }).expect(400)).body;
    expect(res.code).toBe('PLAN_USER_LIMIT');
    await api(app, admin).patch(`/superadmin/billing/plans/${plans.WORKSHOP.id}`, { maxUsers: 5 }).expect(200);
    await api(app, c).post('/users/munshi', { name: 'Akram', phone: phone('0302'), pin: '4821' }).expect(201);
  });

  it('the super admin adds a module for one business on top of its plan, and edits a plan', async () => {
    const d = await createTenantWithOwner(app);
    await api(app, admin).patch(`/superadmin/billing/tenants/${d.tenantId}`, { planId: plans.WORKSHOP.id, paidUntil: days(30), extraModules: ['PRICE_LISTS'] }).expect(200);
    expect(await modulesOf(d)).toEqual(expect.arrayContaining(['LOOSE_LOTS', 'PRICE_LISTS']));
    await api(app, admin).patch(`/superadmin/billing/plans/${plans.WORKSHOP.id}`, { monthlyPrice: 4500, modules: [...plans.WORKSHOP.modules, 'PNL'] }).expect(200);
    expect(await modulesOf(d)).toContain('PNL');
    await api(app, admin).patch(`/superadmin/billing/plans/${plans.WORKSHOP.id}`, { monthlyPrice: 4000, modules: plans.WORKSHOP.modules }).expect(200);
    await api(app, admin).patch(`/superadmin/billing/plans/${plans.FREE.id}`, { isActive: false }).expect(400);
    // Where customers pay, shown on their billing page.
    await api(app, admin).put('/superadmin/billing/pay-to', { accountTitle: 'ThriftOS', jazzcash: '0300 0000000' }).expect(200);
    expect((await billingOf(d)).payTo).toMatchObject({ accountTitle: 'ThriftOS', jazzcash: '0300 0000000' });
  });

  it('module switches saved in the console stay for a business on a plan (owner: "saving issue on superadmin side")', async () => {
    const e = await createTenantWithOwner(app);
    await api(app, admin).patch(`/superadmin/billing/tenants/${e.tenantId}`, { planId: plans.WORKSHOP.id, paidUntil: days(30) }).expect(200);
    const before = await modulesOf(e);
    expect(before).not.toContain('PRICE_LISTS');
    // The console's "How this business works": everything it had, plus price lists and godowns.
    const chosen = [...before.filter((m) => !['RECEIVE', 'STOCK', 'SELL'].includes(m)), 'PRICE_LISTS', 'WAREHOUSES'];
    await api(app, admin).patch(`/superadmin/tenants/${e.tenantId}/workings`, { modules: chosen }).expect(200);
    // The owner opens the app (the plan is applied again): the switches are still on, kept as extras.
    expect(await modulesOf(e)).toEqual(expect.arrayContaining(['PRICE_LISTS', 'WAREHOUSES', 'LOOSE_LOTS']));
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: e.tenantId } })).extraModules.sort()).toEqual(['PRICE_LISTS', 'WAREHOUSES']);
    // Switching one off again removes it.
    await api(app, admin).patch(`/superadmin/tenants/${e.tenantId}/workings`, { modules: chosen.filter((m) => m !== 'WAREHOUSES') }).expect(200);
    const after = await modulesOf(e);
    expect(after).toContain('PRICE_LISTS');
    expect(after).not.toContain('WAREHOUSES');
  });
});
