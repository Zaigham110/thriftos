import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { businessDay } from '../../src/workspace/receivables.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const dayOffset = (n: number) => businessDay(new Date(Date.now() + n * DAY));

/**
 * Enterprise plan E3.5: collections worklist and ageing (0–30 / 31–60 / 61–90 / 90+), customer 360, statement
 * of account, promises to pay (kept / broken worked out from payments), logged WhatsApp reminders, credit limits.
 */
describe('Workspace receivables: ageing, customer 360, statement, promises, reminders, credit limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const ids: Record<string, string> = {};

  async function creditSale(customerId: string, amount: number, ago: number) {
    const item = await api(app, a).post('/stock/items', { name: `Bale ${amount}-${ago}`, unit: 'BALE', quantity: 1, totalCost: amount / 2 }).expect(201);
    const sale = (await api(app, a).post('/sales', { customerId, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.body.id, unit: 'BALE', quantity: 1, unitPrice: amount }] }).expect(201)).body;
    await prisma.sale.update({ where: { id: sale.id }, data: { issuedAt: daysAgo(ago), createdAt: daysAgo(ago) } });
    return sale;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    // Owes: opening Rs 10,000 (customer added 100 days ago), a Rs 50,000 sale 45 days ago, a Rs 20,000 sale today.
    const c = (await api(app, a).post('/customers', { name: 'Haji Rafiq Traders', phone: '03001112233', city: 'Lahore', openingBalance: 10000 }).expect(201)).body;
    ids.customer = c.id;
    await prisma.customer.update({ where: { id: c.id }, data: { createdAt: daysAgo(100) } });
    ids.old = (await creditSale(c.id, 50000, 45)).id;
    ids.today = (await creditSale(c.id, 20000, 0)).id;
    // Rs 15,000 on account, 10 days ago: pays the opening balance, then Rs 5,000 of the oldest sale.
    const pay = (await api(app, a).post('/khata/payments', { customerId: c.id, amount: 15000 }).expect(201)).body;
    await prisma.payment.update({ where: { id: pay.id ?? pay.payment?.id }, data: { receivedAt: daysAgo(10), createdAt: daysAgo(10) } });
    // Paid in advance: no debt.
    const adv = (await api(app, a).post('/customers', { name: 'Advance Wala', phone: '03009998877' }).expect(201)).body;
    await api(app, a).post('/khata/payments', { customerId: adv.id, amount: 1000 }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('worklist and ageing: debt by age of the sale, the opening balance by the day the customer was added', async () => {
    const w = (await api(app, a).get('/workspace/receivables').expect(200)).body;
    expect(w.rows).toHaveLength(1);
    expect(w.rows[0]).toMatchObject({ id: ids.customer, balance: '65000', buckets: { '0-30': '20000', '31-60': '45000', '61-90': '0', '90+': '0' }, overdueDays: 45 });
    expect(w.rows[0].lastPayment).toMatchObject({ amount: '15000' });
    expect(w.totals).toMatchObject({ owed: '65000', advance: '1000', customers: 1, buckets: { '0-30': '20000', '31-60': '45000' } });
  });

  it('promises: open, kept when payments reach it, broken when the day passes; no past days', async () => {
    await api(app, a).post(`/workspace/customers/${ids.customer}/promises`, { amount: 30000, promisedFor: dayOffset(-1) }).expect(400);
    const p = (await api(app, a).post(`/workspace/customers/${ids.customer}/promises`, { amount: 30000, promisedFor: dayOffset(2), note: 'After Friday market' }).expect(201)).body;
    let row = (await api(app, a).get('/workspace/receivables').expect(200)).body.rows[0];
    expect(row.promise).toMatchObject({ id: p.id, amount: '30000', status: 'OPEN' });

    await api(app, a).post('/khata/payments', { customerId: ids.customer, amount: 30000, method: 'JAZZCASH' }).expect(201);
    const c360 = (await api(app, a).get(`/workspace/customers/${ids.customer}`).expect(200)).body;
    expect(c360.promises[0]).toMatchObject({ id: p.id, status: 'KEPT', paid: '30000', note: 'After Friday market' });

    // A promise whose day has passed without the money is broken.
    const late = (await api(app, a).post(`/workspace/customers/${ids.customer}/promises`, { amount: 10000, promisedFor: dayOffset(0) }).expect(201)).body;
    await prisma.paymentPromise.update({ where: { id: late.id }, data: { promisedFor: new Date(dayOffset(-3) + 'T00:00:00Z') } });
    row = (await api(app, a).get('/workspace/receivables').expect(200)).body.rows[0];
    expect(row.promise).toMatchObject({ id: late.id, status: 'BROKEN' });
    await api(app, a).post(`/workspace/promises/${late.id}/cancel`, {}).expect(200);
    await api(app, a).post(`/workspace/promises/${late.id}/cancel`, {}).expect(409);
    expect((await api(app, a).get('/workspace/receivables').expect(200)).body.rows[0].promise).toBeNull();
  });

  it('customer 360: balance, ageing, totals, 12 months, sales with due, payments; profit only with cost.view', async () => {
    const c = (await api(app, a).get(`/workspace/customers/${ids.customer}`).expect(200)).body;
    expect(c.account).toMatchObject({ balance: '35000', buckets: { '0-30': '20000', '31-60': '15000' } });
    expect(c.totals).toMatchObject({ sales: 2, sold: '70000', received: '45000', profit: '35000' });
    expect(c.months).toHaveLength(12);
    expect(c.months[11]).toMatchObject({ sold: '20000' });
    expect(c.sales[0]).toMatchObject({ id: ids.today, due: '20000', status: 'ISSUED' });
    expect(c.sales[1]).toMatchObject({ id: ids.old, paid: '35000', due: '15000', status: 'PARTIALLY_PAID' });
    expect(c.payments.map((p: { amount: string }) => p.amount)).toEqual(['30000', '15000']);
    const munshi = await createUserWithoutPermissions(app, a.tenantId);
    expect((await api(app, munshi).get(`/workspace/customers/${ids.customer}`).expect(200)).body.totals.profit).toBeNull();
  });

  it('credit limit: over the limit shows on the worklist and the 360', async () => {
    await api(app, a).patch(`/workspace/customers/${ids.customer}/credit-limit`, { creditLimit: 30000 }).expect(200);
    const row = (await api(app, a).get('/workspace/receivables').expect(200)).body.rows[0];
    expect(row).toMatchObject({ creditLimit: '30000', overLimit: true });
    expect((await api(app, a).get(`/workspace/customers/${ids.customer}`).expect(200)).body.account).toMatchObject({ overLimit: true, limitUsedPercent: 117 });
    await api(app, a).patch(`/workspace/customers/${ids.customer}/credit-limit`, { creditLimit: 0 }).expect(200);
    expect((await api(app, a).get('/workspace/receivables').expect(200)).body.rows[0]).toMatchObject({ creditLimit: null, overLimit: false });
  });

  it('reminder: a wa.me link with the balance, logged for the worklist and the 360', async () => {
    const r = (await api(app, a).post(`/workspace/customers/${ids.customer}/remind`, { lang: 'en' }).expect(200)).body;
    expect(r.url).toMatch(/^https:\/\/wa\.me\/923001112233\?text=/);
    expect(decodeURIComponent(r.url)).toContain('Rs 35,000');
    expect((await api(app, a).get('/workspace/receivables').expect(200)).body.rows[0].lastReminder).toBeTruthy();
    expect((await api(app, a).get(`/workspace/customers/${ids.customer}`).expect(200)).body.reminders).toHaveLength(1);
  });

  it('statement of account: brought forward, lines in the period, carried forward', async () => {
    const all = (await api(app, a).get(`/workspace/customers/${ids.customer}/statement`).expect(200)).body;
    expect(all).toMatchObject({ opening: '0', debit: '80000', credit: '45000', closing: '35000' });
    expect(all.lines[0]).toMatchObject({ kind: 'OPENING', debit: '10000' });
    const recent = (await api(app, a).get(`/workspace/customers/${ids.customer}/statement?from=${dayOffset(-20)}&to=${dayOffset(0)}`).expect(200)).body;
    // Brought forward: opening 10,000 + the 50,000 sale 45 days ago.
    expect(recent).toMatchObject({ opening: '60000', debit: '20000', credit: '45000', closing: '35000' });
    expect(recent.lines.map((l: { kind: string }) => l.kind)).toEqual(['PAYMENT', 'SALE', 'PAYMENT']);
    await api(app, a).get(`/workspace/customers/${ids.customer}/statement?from=${dayOffset(0)}&to=${dayOffset(-5)}`).expect(400);
  });

  it('another business sees and changes nothing', async () => {
    await api(app, b).get(`/workspace/customers/${ids.customer}`).expect(404);
    await api(app, b).get(`/workspace/customers/${ids.customer}/statement`).expect(404);
    await api(app, b).post(`/workspace/customers/${ids.customer}/promises`, { amount: 1, promisedFor: dayOffset(1) }).expect(404);
    await api(app, b).patch(`/workspace/customers/${ids.customer}/credit-limit`, { creditLimit: 1 }).expect(404);
    await api(app, b).post(`/workspace/customers/${ids.customer}/remind`, {}).expect(404);
    expect((await api(app, b).get('/workspace/receivables').expect(200)).body.rows).toEqual([]);
  });
});
