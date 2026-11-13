import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { businessDay } from '../../src/workspace/receivables.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

const today = () => businessDay(new Date());
const dayOffset = (n: number) => businessDay(new Date(Date.now() + n * 86_400_000));
/** Noon of a business day (Pakistan), as an ISO time. */
const noon = (day: string) => new Date(`${day}T07:00:00Z`).toISOString();

/**
 * v2 review (Cash close): cash out of the drawer and into it (bank, owner), a closed day stays as counted, days
 * close in order, a short or over drawer says why, the latest close can be reopened, and the last 14 days show
 * the days that were never closed. Another business sees and changes nothing.
 */
describe('Cash close review (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const customer = async (t: TestTenant, phone: string) => (await api(app, t).post('/customers', { name: 'Gul Khan', phone }).expect(201)).body.id as string;
  const pay = (t: TestTenant, customerId: string, amount: number, extra: Record<string, unknown> = {}) =>
    api(app, t).post('/khata/payments', { customerId, amount, method: 'CASH', ...extra });

  it('cash paid into the bank or taken by the owner leaves the drawer, shows in the bank book, and is not profit or loss', async () => {
    const a = await createTenantWithOwner(app);
    const c = await customer(a, '0300 1110001');
    await pay(a, c, 50000, { receivedAt: noon(dayOffset(-1)) }).expect(201);
    const bank = (await api(app, a).post('/workspace/finance/cash-moves', { day: dayOffset(-1), direction: 'OUT', kind: 'BANK', amount: 40000, note: 'Meezan Bank' }).expect(201)).body;
    await api(app, a).post('/workspace/finance/cash-moves', { day: dayOffset(-1), direction: 'OUT', kind: 'OWNER', amount: 5000 }).expect(201);
    await api(app, a).post('/workspace/finance/cash-moves', { day: dayOffset(-1), direction: 'IN', kind: 'OTHER', amount: 1000, note: 'Change from the bank' }).expect(201);

    const v = (await api(app, a).get(`/workspace/finance/close?day=${dayOffset(-1)}`).expect(200)).body;
    expect(v).toMatchObject({ in: '50000', out: '0', movedOut: '45000', movedIn: '1000', expected: '6000' });
    expect(v.lines.map((l: { kind: string; ref: string }) => `${l.kind}:${l.ref}`)).toEqual(expect.arrayContaining(['MOVE:OUT:BANK', 'MOVE:OUT:OWNER', 'MOVE:IN:OTHER']));

    const bankBook = (await api(app, a).get('/workspace/finance/book?method=BANK').expect(200)).body;
    expect(bankBook).toMatchObject({ in: '40000', closing: '40000' });
    const pnl = (await api(app, a).get('/workspace/finance/pnl?months=2').expect(200)).body;
    expect(pnl.totals).toMatchObject({ expenseTotal: '0', netProfit: '0' });

    // A mistake is cancelled while the day is open; a future day is refused.
    await api(app, a).post(`/workspace/finance/cash-moves/${bank.id}/cancel`, {}).expect(200);
    expect((await api(app, a).get(`/workspace/finance/close?day=${dayOffset(-1)}`).expect(200)).body).toMatchObject({ movedOut: '5000', expected: '46000' });
    expect((await api(app, a).post(`/workspace/finance/cash-moves/${bank.id}/cancel`, {}).expect(409)).body.code).toBe('ALREADY_CANCELLED');
    expect((await api(app, a).post('/workspace/finance/cash-moves', { day: dayOffset(1), direction: 'OUT', kind: 'BANK', amount: 100 }).expect(400)).body.code).toBe('FUTURE_DAY');
    await api(app, a).post('/workspace/finance/cash-moves', { direction: 'SIDEWAYS', kind: 'BANK', amount: 100 }).expect(400);
    // More than the drawer should hold is refused (an extra zero typed).
    expect((await api(app, a).post('/workspace/finance/cash-moves', { day: dayOffset(-1), direction: 'OUT', kind: 'BANK', amount: 460000 }).expect(400)).body.code).toBe('NOT_ENOUGH_CASH');

    // Once the day is closed, nothing moves on it.
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(-1), counted: 46000 }).expect(201);
    const owner = v.lines.find((l: { ref: string }) => l.ref === 'OUT:OWNER');
    expect((await api(app, a).post(`/workspace/finance/cash-moves/${owner.id}/cancel`, {}).expect(409)).body.code).toBe('CASH_CLOSED');
    expect((await api(app, a).post('/workspace/finance/cash-moves', { day: dayOffset(-1), direction: 'OUT', kind: 'BANK', amount: 100 }).expect(409)).body.code).toBe('CASH_CLOSED');
  });

  it("a closed day stays as counted: back-dated cash is refused, cash after today's close counts tomorrow", async () => {
    const a = await createTenantWithOwner(app);
    const c = await customer(a, '0300 1110002');
    await pay(a, c, 3000, { receivedAt: noon(dayOffset(-2)) }).expect(201);
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(-2), counted: 3000 }).expect(201);
    expect((await pay(a, c, 700, { receivedAt: noon(dayOffset(-2)) }).expect(409)).body.code).toBe('CASH_CLOSED');
    await pay(a, c, 700, { receivedAt: noon(dayOffset(-2)), method: 'BANK' }).expect(201);

    await pay(a, c, 1000).expect(201);
    await api(app, a).post('/workspace/finance/close', { day: today(), counted: 4000 }).expect(201);
    await pay(a, c, 500).expect(201);
    const v = (await api(app, a).get(`/workspace/finance/close?day=${today()}`).expect(200)).body;
    expect(v).toMatchObject({ in: '1000', expected: '4000', afterCloseTotal: '500' });
    expect(v.afterClose).toHaveLength(1);
    expect((await api(app, a).get(`/workspace/finance/close?day=${dayOffset(1)}`).expect(200)).body).toMatchObject({ opening: '4500' });
  });

  it('days close in order, and a short or over drawer says why', async () => {
    const a = await createTenantWithOwner(app);
    const c = await customer(a, '0300 1110003');
    await pay(a, c, 2000, { receivedAt: noon(dayOffset(-3)) }).expect(201);
    await pay(a, c, 1000, { receivedAt: noon(dayOffset(-2)) }).expect(201);
    // Before closing: the older open day is named, so it can be closed first (v2 review); it counts as an open day.
    const before = (await api(app, a).get(`/workspace/finance/close?day=${dayOffset(-2)}`).expect(200)).body;
    expect(before.earlierOpen).toEqual([dayOffset(-3)]);
    expect(before.recent.find((r: { day: string }) => r.day === dayOffset(-3))).toMatchObject({ closed: false, skipped: false });
    expect((await api(app, a).post('/workspace/finance/close', { day: dayOffset(-2), counted: 2900 }).expect(400)).body.code).toBe('REASON_NEEDED');
    expect((await api(app, a).post('/workspace/finance/close', { day: dayOffset(-2), counted: 2900, note: ' ' }).expect(400)).body.code).toBe('REASON_NEEDED');
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(-2), counted: 2900, note: 'Rs 100 change' }).expect(201);
    expect((await api(app, a).post('/workspace/finance/close', { day: dayOffset(-3), counted: 2000 }).expect(409)).body.code).toBe('LATER_CLOSED');
    expect((await api(app, a).post('/workspace/finance/close', { day: dayOffset(-2), counted: 2900, note: 'Again' }).expect(409)).body.code).toBe('CLOSED_ALREADY');
    expect((await api(app, a).post('/workspace/finance/close', { day: dayOffset(1), counted: 0 }).expect(400)).body.code).toBe('NOT_STARTED');

    // The last 14 days: the day that was passed over can no longer be closed, so it reads "not counted" and is
    // not one of the open days the Home reminder counts.
    const v = (await api(app, a).get('/workspace/finance/close').expect(200)).body;
    expect(v.recent.map((r: { day: string; closed: boolean }) => [r.day, r.closed])).toEqual([[dayOffset(-2), true], [dayOffset(-3), false]]);
    expect(v.recent.find((r: { day: string }) => r.day === dayOffset(-3)).skipped).toBe(true);
    expect(v.openDays).toBe(0);
    expect(v.earlierOpen).toEqual([]);
    expect(v.laterClosed).toBe(false);
    expect((await api(app, a).get(`/workspace/finance/close?day=${dayOffset(-3)}`).expect(200)).body).toMatchObject({ laterClosed: true, canReopen: false });
  });

  it('the latest close can be reopened with a reason, then counted again', async () => {
    const a = await createTenantWithOwner(app);
    const c = await customer(a, '0300 1110004');
    await pay(a, c, 37530, { receivedAt: noon(dayOffset(-2)) }).expect(201);
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(-2), counted: 37530 }).expect(201);
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(-1), counted: 3753, note: 'Typed wrong' }).expect(201);
    expect((await api(app, a).get(`/workspace/finance/close?day=${dayOffset(-1)}`).expect(200)).body).toMatchObject({ canReopen: true });

    expect((await api(app, a).post(`/workspace/finance/close/${dayOffset(-2)}/reopen`, { reason: 'Recount' }).expect(409)).body.code).toBe('NOT_LATEST');
    await api(app, a).post(`/workspace/finance/close/${dayOffset(-1)}/reopen`, {}).expect(400);
    expect((await api(app, a).post(`/workspace/finance/close/${today()}/reopen`, { reason: 'Recount' }).expect(404)).body.code).toBe('NOT_CLOSED');
    await api(app, a).post('/workspace/finance/close/not-a-day/reopen', { reason: 'Recount' }).expect(404);
    await api(app, a).post(`/workspace/finance/close/${dayOffset(-1)}/reopen`, { reason: 'Typed 3,753 instead of 37,530' }).expect(200);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'CASH_REOPENED' } });
    expect(log.metadataJson).toMatchObject({ day: dayOffset(-1), counted: '3753', reason: 'Typed 3,753 instead of 37,530' });
    const pnl = (await api(app, a).get('/workspace/finance/pnl?months=2').expect(200)).body;
    expect(pnl.totals.cashDifference).toBe('0');
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(-1), counted: 37530 }).expect(201);
  });

  it('only people who close the cash move it or reopen; another business sees and changes nothing', async () => {
    const a = await createTenantWithOwner(app);
    const b = await createTenantWithOwner(app);
    await api(app, a).post('/users/munshi', { name: 'Akram', phone: '0300 765 4499', pin: '4821' }).expect(201);
    const res = await request(app.getHttpServer()).post('/api/auth/login/pin').send({ phone: '03007654499', pin: '4821' }).expect(200);
    const munshi = { ...a, token: res.body.accessToken };

    const m = (await api(app, a).post('/workspace/finance/cash-moves', { direction: 'IN', kind: 'OWNER', amount: 20000 }).expect(201)).body;
    await api(app, a).post('/workspace/finance/close', { day: today(), counted: 20000 }).expect(201);
    await api(app, munshi).post('/workspace/finance/cash-moves', { direction: 'OUT', kind: 'OWNER', amount: 100 }).expect(403);
    await api(app, munshi).post(`/workspace/finance/close/${today()}/reopen`, { reason: 'Recount' }).expect(403);

    await api(app, b).post(`/workspace/finance/cash-moves/${m.id}/cancel`, {}).expect(404);
    await api(app, b).post(`/workspace/finance/close/${today()}/reopen`, { reason: 'Not ours' }).expect(404);
    expect((await api(app, b).get(`/workspace/finance/close?day=${today()}`).expect(200)).body).toMatchObject({ expected: '0', movedIn: '0', close: null, recent: [] });
    expect((await api(app, b).get('/workspace/finance/book?method=CASH').expect(200)).body.lines).toHaveLength(0);
    expect((await api(app, a).get(`/workspace/finance/close?day=${today()}`).expect(200)).body).toMatchObject({ movedIn: '20000', close: { counted: '20000' } });
  });
});
