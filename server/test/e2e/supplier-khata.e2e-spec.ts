import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWith, TestTenant } from './fixtures';

/**
 * Supplier khata (owner, 2026-11-13): what the business owes each supplier = opening balance + the price of what
 * was bought on the khata − payments. New purchases are owed until paid ("Paid now" on the buying form pays part
 * on the spot); what was bought before the khata counts as paid. Payments leave the cash or bank book and never
 * touch profit. Only this business; money only for those who may see costs.
 */
describe('Supplier khata: owed, paid now, payments, cash book (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const page = async (who: TestTenant, id: string) => (await api(app, who).get(`/workspace/suppliers/${id}`).expect(200)).body;

  it('a lot bought is owed; paid now, later payments and a cancelled one move the balance and the books', async () => {
    const s = (await api(app, a).post('/admin/vendors', { name: 'Khata Wala', originCountry: 'Pakistan', openingBalance: 5000 }).expect(201)).body;
    expect((await page(a, s.id)).khata).toEqual({ opening: '5000', bought: '0', paid: '0', owed: '5000' });

    // A lot bought before the khata (not on it) counts as paid.
    const first = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000, vendorId: s.id }).expect(201)).body;
    await prisma.rag.update({ where: { id: first.id }, data: { onKhata: false } });
    expect((await page(a, s.id)).khata.owed).toBe('5000');

    // Bought for 160,000 with 60,000 paid on the spot in cash: 100,000 more is owed. Charges are not the supplier's.
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 800, purchaseCost: 160000, vendorId: s.id, paidNow: 60000, charges: [{ kind: 'TRANSPORT', amount: 3000 }] }).expect(201)).body;
    let p = await page(a, s.id);
    expect(p.khata).toEqual({ opening: '5000', bought: '160000', paid: '60000', owed: '105000' });
    expect(p.payments).toEqual([expect.objectContaining({ amount: '60000', method: 'CASH', note: lot.ragCode, cancelled: false })]);

    // A later payment through the bank.
    const pay = (await api(app, a).post(`/workspace/suppliers/${s.id}/payments`, { amount: 25000, method: 'BANK', note: 'cheque 114' }).expect(201)).body;
    expect((await page(a, s.id)).khata).toMatchObject({ paid: '85000', owed: '80000' });

    // The books: cash out 60,000, bank out 25,000, each named after the supplier.
    const cash = (await api(app, a).get('/workspace/finance/book?method=CASH').expect(200)).body;
    expect(cash.lines.filter((l: { kind: string }) => l.kind === 'SUPPLIER')).toEqual([expect.objectContaining({ party: 'Khata Wala', out: '60000', in: '0' })]);
    // A click on the book's line opens the supplier (v2 review, Cash and bank).
    expect(cash.lines.find((l: { kind: string }) => l.kind === 'SUPPLIER').link).toEqual({ type: 'supplier', id: s.id });
    const bank = (await api(app, a).get('/workspace/finance/book?method=BANK').expect(200)).body;
    expect(bank.lines.filter((l: { kind: string }) => l.kind === 'SUPPLIER')).toEqual([expect.objectContaining({ party: 'Khata Wala', out: '25000' })]);

    // Paying a supplier is not an expense: profit and loss does not move.
    const pnl = (await api(app, a).get('/workspace/finance/pnl').expect(200)).body;
    expect(pnl.totals.expenseTotal).toBe('0');

    // The Suppliers list shows the same figure.
    const row = (await api(app, a).get('/lists/suppliers?q=Khata').expect(200)).body.rows[0];
    expect(row.owed).toBe('80000');

    // A payment typed by mistake is cancelled: it stays on the page, struck out, and counts nowhere.
    await api(app, a).post(`/workspace/suppliers/${s.id}/payments/${pay.id}/cancel`).expect(200);
    await api(app, a).post(`/workspace/suppliers/${s.id}/payments/${pay.id}/cancel`).expect(409);
    p = await page(a, s.id);
    expect(p.khata).toMatchObject({ paid: '60000', owed: '105000' });
    expect(p.payments.find((x: { id: string }) => x.id === pay.id).cancelled).toBe(true);
    expect((await api(app, a).get('/workspace/finance/book?method=BANK').expect(200)).body.lines).toHaveLength(0);

    // The opening balance can be corrected on the supplier.
    await api(app, a).patch(`/admin/vendors/${s.id}`, { openingBalance: 0 }).expect(200);
    expect((await page(a, s.id)).khata.owed).toBe('100000');

    // Rules: a payment needs an amount, not a future day; paid now needs a supplier.
    await api(app, a).post(`/workspace/suppliers/${s.id}/payments`, { amount: 0 }).expect(400);
    await api(app, a).post(`/workspace/suppliers/${s.id}/payments`, { amount: 100, day: '2999-01-01' }).expect(400);
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 1000, paidNow: 500 }).expect(400);

    // Cash cannot be paid on a day whose cash is closed; the bank still can.
    const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
    await api(app, a).post('/workspace/finance/cash-moves', { direction: 'IN', kind: 'OWNER', amount: 70000 }).expect(201);
    const view = (await api(app, a).get(`/workspace/finance/close?day=${today}`).expect(200)).body;
    expect(view).toMatchObject({ out: '60000', movedIn: '70000', expected: '10000' });
    await api(app, a).post('/workspace/finance/close', { day: today, counted: 10000 }).expect(201);
    await api(app, a).post(`/workspace/suppliers/${s.id}/payments`, { amount: 1000 }).expect(409);
    await api(app, a).post(`/workspace/suppliers/${s.id}/payments`, { amount: 1000, method: 'BANK' }).expect(201);

    // Another business sees none of it and can change none of it.
    await api(app, b).get(`/workspace/suppliers/${s.id}`).expect(404);
    await api(app, b).post(`/workspace/suppliers/${s.id}/payments`, { amount: 500, method: 'BANK' }).expect(400);
    await api(app, b).post(`/workspace/suppliers/${s.id}/payments/${pay.id}/cancel`).expect(404);
    expect((await api(app, b).get('/workspace/finance/book?method=BANK').expect(200)).body.lines).toHaveLength(0);
    expect(await prisma.supplierPayment.count({ where: { tenantId: b.tenantId } })).toBe(0);

    // Money is for those who may see costs; paying needs the expense permission.
    const buyer = await createUserWith(app, a.tenantId, ['vendor.read']);
    const seen = await page(buyer, s.id);
    expect([seen.khata, seen.payments, seen.supplier.openingBalance]).toEqual([null, [], null]);
    await api(app, buyer).post(`/workspace/suppliers/${s.id}/payments`, { amount: 500 }).expect(403);
  });
});
