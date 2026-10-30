import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** Task 2.4: balances, ledger, overdue days, WhatsApp links and the public bill page. */
describe('Khata (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let shafiq: any;
  let credit: any;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { name: 'Al-Madina Traders' } });

    const stock = (await api(app, a).post('/stock/items', { name: 'Jeans A', unit: 'BALE', quantity: 10, totalCost: 250000 }).expect(201)).body;
    shafiq = (await api(app, a).post('/customers', { name: 'Shafiq', phone: '0321 7654321', openingBalance: 10000 }).expect(201)).body;
    await api(app, a).post('/customers', { name: 'Zero Owed' }).expect(201);
    credit = (await api(app, a).post('/sales', { customerId: shafiq.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: stock.id, quantity: 2, unitPrice: 30000 }] }).expect(201)).body;
    await prisma.sale.update({ where: { id: credit.id }, data: { issuedAt: new Date(Date.now() - 12 * 86_400_000) } });
    await api(app, a).post('/sales', { customerId: shafiq.id, paymentMode: 'PARTIAL', paidAmount: 5000, lines: [{ inventoryItemId: stock.id, quantity: 1, unitPrice: 30000 }] }).expect(201);
    await api(app, a).post('/khata/payments', { customerId: shafiq.id, amount: 22000, method: 'RAAST' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists customers by what they owe, with days overdue', async () => {
    const list = await api(app, a).get('/khata').expect(200);
    // 10,000 opening + 60,000 + 30,000 − 5,000 − 22,000
    expect(list.body.totalOwed).toBe('73000');
    expect(list.body.customers.map((c: any) => [c.name, c.balance, c.overdueDays])).toEqual([
      ['Shafiq', '73000', 12],
      ['Zero Owed', '0', 0],
    ]);
    expect((await api(app, a).get('/khata?search=zero').expect(200)).body.customers).toHaveLength(1);
  });

  it('shows the ledger with a running balance, and what each sale still has due', async () => {
    const ledger = await api(app, a).get(`/khata/customers/${shafiq.id}`).expect(200);
    expect(ledger.body).toMatchObject({ balance: '73000', openingDue: '0', overdueDays: 12 });
    expect(ledger.body.lines.map((l: any) => [l.kind, l.debit, l.credit, l.balance, l.status ?? null, l.due ?? null])).toEqual([
      ['OPENING', '10000', '0', '10000', null, null],
      ['SALE', '60000', '0', '70000', 'PARTIALLY_PAID', '48000'],
      ['SALE', '30000', '0', '100000', 'PARTIALLY_PAID', '25000'],
      ['PAYMENT', '0', '5000', '95000', null, null],
      ['PAYMENT', '0', '22000', '73000', null, null],
    ]);
    expect(ledger.body.lines[4]).toMatchObject({ ref: 'RAAST', saleId: null, hasPhoto: false });
  });

  it('builds a WhatsApp reminder in Urdu by default, or English', async () => {
    const ur = await api(app, a).get(`/khata/customers/${shafiq.id}/reminder`).expect(200);
    expect(ur.body.url).toMatch(/^https:\/\/wa\.me\/923217654321\?text=/);
    expect(decodeURIComponent(ur.body.url.split('text=')[1])).toBe(ur.body.text);
    expect(ur.body.text).toContain('Rs 73,000');
    expect(ur.body.text).toContain('السلام علیکم');
    const en = await api(app, a).get(`/khata/customers/${shafiq.id}/reminder?lang=en`).expect(200);
    expect(en.body.text).toContain('your balance with Al-Madina Traders is Rs 73,000');
    await api(app, a).get(`/khata/customers/${shafiq.id}/reminder?lang=fr`).expect(400);
  });

  it('shares a bill on WhatsApp with a link to the public bill page', async () => {
    const share = await api(app, a).get(`/sales/${credit.id}/whatsapp?lang=en`).expect(200);
    expect(share.body.billUrl).toBe(`http://localhost:4200/bill/${credit.billToken}`);
    expect(share.body.text).toBe(`Al-Madina Traders\nBill ${credit.saleNumber} for Shafiq\nTotal: Rs 60,000\nPaid: Rs 12,000\nDue: Rs 48,000\nSee bill: ${share.body.billUrl}`);
    expect(share.body.url).toMatch(/^https:\/\/wa\.me\/923217654321\?text=/);
  });

  it('opens the bill by its token without login, showing only what is on the bill', async () => {
    const bill = await request(app.getHttpServer()).get(`/api/public/bills/${credit.billToken}`).expect(200);
    expect(Object.keys(bill.body).sort()).toEqual(['business', 'currency', 'customer', 'date', 'due', 'lines', 'paid', 'saleNumber', 'status', 'total'].sort());
    expect(bill.body).toMatchObject({ business: 'Al-Madina Traders', customer: 'Shafiq', total: '60000', paid: '12000', due: '48000', status: 'PARTIALLY_PAID' });
    expect(bill.body.lines).toEqual([{ description: 'Jeans A', unit: 'BALE', quantity: '2', unitPrice: '30000', lineTotal: '60000' }]);
    expect(JSON.stringify(bill.body)).not.toMatch(/cost|profit|phone|tenantId|customerId/i);

    await request(app.getHttpServer()).get(`/api/public/bills/${randomBytes(24).toString('base64url')}`).expect(404);
    await request(app.getHttpServer()).get('/api/public/bills/short').expect(404);
  });

  it('keeps tenants apart', async () => {
    expect((await api(app, b).get('/khata').expect(200)).body).toEqual({ totalOwed: '0', customers: [] });
    await api(app, b).get(`/khata/customers/${shafiq.id}`).expect(404);
    await api(app, b).get(`/khata/customers/${shafiq.id}/reminder`).expect(404);
    await api(app, b).get(`/sales/${credit.id}/whatsapp`).expect(404);
  });
});
