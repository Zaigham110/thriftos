import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { businessDay } from '../../src/workspace/receivables.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

const today = () => businessDay(new Date());
const dayOffset = (n: number) => businessDay(new Date(Date.now() + n * 86_400_000));

/**
 * v2 review (Expenses): the new categories, the munshi records expenses from the phone (and only records),
 * fixing a mistake with before/after in the audit, cancelling with a reason, and errors with a code the app
 * can show in Urdu. Another business sees and changes nothing.
 */
describe('Expenses review (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let munshi: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    await api(app, a).post('/users/munshi', { name: 'Akram', phone: '0300 765 4411', pin: '4821' }).expect(201);
    const res = await request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone: '03007654411', pin: '4821' }).expect(200);
    munshi = { ...a, token: res.body.accessToken };
  });

  afterAll(async () => {
    await app.close();
  });

  it('records the new categories', async () => {
    for (const category of ['TEA_FOOD', 'FUEL', 'LOADING', 'PACKING', 'SALARY', 'PHONE', 'REPAIRS', 'CUSTOMS']) {
      await api(app, a).post('/workspace/expenses', { category, amount: 100, method: 'BANK', day: dayOffset(-3) }).expect(201);
    }
    const pnl = (await api(app, a).get('/workspace/finance/pnl?months=2').expect(200)).body;
    expect(pnl.totals.expenses).toMatchObject({ TEA_FOOD: '100', CUSTOMS: '100' });
  });

  it('the munshi records an expense from the phone, but cannot open, change or cancel one', async () => {
    const e = (await api(app, munshi).post('/workspace/expenses', { category: 'TEA_FOOD', amount: 450, paidTo: 'Chai dhaba', day: dayOffset(-1) }).expect(201)).body;
    await api(app, munshi).get(`/workspace/expenses/${e.id}`).expect(403);
    await api(app, munshi).patch(`/workspace/expenses/${e.id}`, { amount: 500 }).expect(403);
    await api(app, munshi).post(`/workspace/expenses/${e.id}/cancel`, { reason: 'Mistake' }).expect(403);
    // The owner sees who recorded it.
    expect((await api(app, a).get(`/workspace/expenses/${e.id}`).expect(200)).body).toMatchObject({ createdByName: 'Akram', amount: '450' });
  });

  it('fixing a mistake: only what changed is logged, before and after', async () => {
    const e = (await api(app, a).post('/workspace/expenses', { category: 'TRANSPORT', amount: 45000, method: 'BANK', day: dayOffset(-2) }).expect(201)).body;
    const fixed = (await api(app, a).patch(`/workspace/expenses/${e.id}`, { amount: 4500, category: 'LOADING', paidTo: 'Loaders' }).expect(200)).body;
    expect(fixed).toMatchObject({ amount: '4500', category: 'LOADING', paidTo: 'Loaders', method: 'BANK', day: dayOffset(-2) });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, entityId: e.id, action: 'EXPENSE_CHANGED' } });
    expect(log.metadataJson).toEqual({ before: { amount: '45000', category: 'TRANSPORT', paidTo: null }, after: { amount: '4500', category: 'LOADING', paidTo: 'Loaders' } });
    // Nothing changed: nothing logged.
    await api(app, a).patch(`/workspace/expenses/${e.id}`, { amount: 4500 }).expect(200);
    expect(await prisma.auditLog.count({ where: { tenantId: a.tenantId, entityId: e.id, action: 'EXPENSE_CHANGED' } })).toBe(1);
    // A future day is refused with a code.
    const future = await api(app, a).patch(`/workspace/expenses/${e.id}`, { day: dayOffset(2) }).expect(400);
    expect(future.body.code).toBe('FUTURE_DAY');
    await api(app, a).patch(`/workspace/expenses/${e.id}`, { amount: 0 }).expect(400);
  });

  it('cancelling asks why, keeps the reason, and a cancelled one cannot be changed', async () => {
    const e = (await api(app, a).post('/workspace/expenses', { category: 'FUEL', amount: 2000, method: 'BANK' }).expect(201)).body;
    await api(app, a).post(`/workspace/expenses/${e.id}/cancel`, {}).expect(400);
    await api(app, a).post(`/workspace/expenses/${e.id}/cancel`, { reason: ' ' }).expect(400);
    await api(app, a).post(`/workspace/expenses/${e.id}/cancel`, { reason: 'Paid twice' }).expect(200);
    expect((await api(app, a).get(`/workspace/expenses/${e.id}`).expect(200)).body).toMatchObject({ cancelReason: 'Paid twice' });
    const again = await api(app, a).post(`/workspace/expenses/${e.id}/cancel`, { reason: 'Again' }).expect(409);
    expect(again.body.code).toBe('ALREADY_CANCELLED');
    expect((await api(app, a).patch(`/workspace/expenses/${e.id}`, { amount: 1 }).expect(409)).body.code).toBe('ALREADY_CANCELLED');
    const log = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, entityId: e.id, action: 'EXPENSE_CANCELLED' } });
    expect(log.metadataJson).toMatchObject({ reason: 'Paid twice' });
  });

  it("a closed day's cash cannot be changed, and nothing can be moved onto it", async () => {
    const cash = (await api(app, a).post('/workspace/expenses', { category: 'TEA_FOOD', amount: 300 }).expect(201)).body;
    const bank = (await api(app, a).post('/workspace/expenses', { category: 'PHONE', amount: 1000, method: 'BANK', day: dayOffset(-1) }).expect(201)).body;
    await api(app, a).post('/workspace/finance/close', { day: today(), counted: 0 }).expect(201);
    const closed = await api(app, a).post('/workspace/expenses', { category: 'OTHER', amount: 50 }).expect(409);
    expect(closed.body).toMatchObject({ code: 'CASH_CLOSED' });
    expect((await api(app, a).patch(`/workspace/expenses/${cash.id}`, { amount: 350 }).expect(409)).body.code).toBe('CASH_CLOSED');
    // Moving the bank expense onto the closed day as cash is refused; changing it otherwise is fine.
    expect((await api(app, a).patch(`/workspace/expenses/${bank.id}`, { method: 'CASH', day: today() }).expect(409)).body.code).toBe('CASH_CLOSED');
    await api(app, a).patch(`/workspace/expenses/${bank.id}`, { amount: 1200 }).expect(200);
  });

  it('a date range that ends today includes today (the day column is a calendar date)', async () => {
    const e = (await api(app, a).post('/workspace/expenses', { category: 'TEA_FOOD', amount: 777, method: 'BANK' }).expect(201)).body;
    const month = `${today().slice(0, 8)}01`;
    const list = (await api(app, a).get(`/lists/expenses?f=date:between:${month}..${today()}&f=cancelled:isnull`).expect(200)).body;
    expect(list.rows.map((r: { id: string }) => r.id)).toContain(e.id);
    const one = (await api(app, a).get(`/lists/expenses?f=date:eq:${today()}`).expect(200)).body;
    expect(one.rows.map((r: { id: string }) => r.id)).toContain(e.id);
    const before = (await api(app, a).get(`/lists/expenses?f=date:lt:${today()}`).expect(200)).body;
    expect(before.rows.map((r: { id: string }) => r.id)).not.toContain(e.id);
  });

  it('another business sees and changes nothing', async () => {
    const e = (await api(app, a).post('/workspace/expenses', { category: 'REPAIRS', amount: 900, method: 'BANK' }).expect(201)).body;
    await api(app, b).get(`/workspace/expenses/${e.id}`).expect(404);
    await api(app, b).patch(`/workspace/expenses/${e.id}`, { amount: 1 }).expect(404);
    await api(app, b).post(`/workspace/expenses/${e.id}/cancel`, { reason: 'Not ours' }).expect(404);
    expect((await api(app, a).get(`/workspace/expenses/${e.id}`).expect(200)).body).toMatchObject({ amount: '900', cancelledAt: null });
  });
});
