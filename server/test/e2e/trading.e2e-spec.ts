import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, seedSortableLot, TestTenant } from './fixtures';

const D = (v: string | number) => new Prisma.Decimal(v);

/**
 * Trading and running costs kept apart (owner, 2026-11-17): buying and selling is one report; wages, rent, the
 * drawer and every other expense is another; a short summary puts them together. A lot's profit is its sales
 * less its price and charges: sorters' pay is a running cost and no longer comes off it.
 */
describe('Trading report and running costs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let lotId: string;
  let vendorId: string;
  let buyerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const { jeans, gradeA } = await seedSortableLot(app, a.tenantId);
    const vendor = (await api(app, a).post('/procurement/vendors', { name: 'Trading Supplier', originCountry: 'USA' }).expect(201)).body;
    vendorId = vendor.id;
    // A loose lot bought on the supplier's khata: 100 kg for 10,000.
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000, vendorId: vendor.id }).expect(201)).body;
    lotId = lot.id;
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session;
    const made = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, bales: 2, baleWeightKg: 50 }).expect(200)).body;
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: made.baleIds[0] } });
    const buyer = (await api(app, a).post('/customers', { name: 'Trading Buyer', phone: '+923001230001', city: 'Lahore' }).expect(201)).body;
    buyerId = buyer.id;
    // One of the two bales sold on credit for 9,000; rent of 1,500 paid.
    await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 9000 }] }).expect(201);
    await api(app, a).post('/workspace/expenses', { category: 'RENT', amount: 1500, method: 'BANK' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('profit comes in two halves that add up: trading profit less running costs is net profit', async () => {
    const p = (await api(app, a).get('/workspace/finance/pnl?months=1').expect(200)).body;
    const t = p.totals;
    expect([t.revenue, t.cost, t.grossProfit]).toEqual(['9000', '5000', '4000']);
    // Nothing written off, nothing short: trading profit is the gross profit; running costs are the expenses.
    expect([t.tradingProfit, t.runningCosts, t.netProfit]).toEqual(['4000', '1500', '2500']);
    expect(D(t.tradingProfit).sub(t.runningCosts).toString()).toBe(t.netProfit);
    expect(D(t.tradingProfit).toString()).toBe(D(t.grossProfit).add(t.writeOffs).toString());
    expect(D(t.runningCosts).toString()).toBe(D(t.expenseTotal).sub(t.cashDifference).toString());
  });

  it('the stock account balances and the tables agree with the monthly lines', async () => {
    const tr = (await api(app, a).get('/workspace/finance/trading?months=1').expect(200)).body;
    const s = tr.stock;
    // Bought: this lot for 10,000 and the test's other lot for 50,000 (still waiting to be sorted). Half of the
    // first sold; its other bale is still there.
    expect([s.bought, s.soldAtCost, s.writtenOff, s.closing, s.opening]).toEqual(['60000', '5000', '0', '55000', '0']);
    expect(s.parts).toEqual({ waiting: '50000', sorted: '0', ready: '5000' });
    expect(D(s.opening).add(s.bought).sub(s.soldAtCost).sub(s.writtenOff).toString()).toBe(s.closing);
    expect(D(s.parts.waiting).add(s.parts.sorted).add(s.parts.ready).toString()).toBe(s.closing);

    expect(tr.byLot).toHaveLength(2);
    expect(tr.byLot.find((l: any) => l.id === lotId)).toMatchObject({ kind: 'LOT', id: lotId, supplier: 'Trading Supplier', bought: '10000', revenue: '9000', costSold: '5000', profit: '4000', notSold: '5000' });
    expect(tr.bySupplier).toEqual([expect.objectContaining({ id: vendorId, name: 'Trading Supplier', lots: 1, bought: '10000', revenue: '9000', profit: '4000', notSold: '5000', owed: '10000' })]);
    expect(tr.byCustomer).toEqual([expect.objectContaining({ id: buyerId, name: 'Trading Buyer', bills: 1, revenue: '9000', cost: '5000', profit: '4000', marginPercent: 44.4 })]);
    expect(tr.byItem).toEqual([expect.objectContaining({ name: 'Jeans · A', kg: '50', revenue: '9000', cost: '5000', profit: '4000' })]);
    // The lot was bought on the khata and the bale sold on credit: both are owed, nothing paid yet.
    expect(tr.owed).toEqual({ toSuppliers: '10000', paidToSuppliers: '0', byCustomers: '9000', receivedFromCustomers: '0' });

    // The tables add up to the monthly lines.
    const p = (await api(app, a).get('/workspace/finance/pnl?months=1').expect(200)).body.totals;
    const sum = (rows: any[], k: string) => rows.reduce((t, r) => t.add(r[k]), D(0)).toString();
    expect([sum(tr.byLot, 'revenue'), sum(tr.byCustomer, 'revenue'), sum(tr.byItem, 'revenue')]).toEqual([p.revenue, p.revenue, p.revenue]);
    expect([sum(tr.byLot, 'profit'), sum(tr.byCustomer, 'profit'), sum(tr.byItem, 'profit')]).toEqual([p.grossProfit, p.grossProfit, p.grossProfit]);
  });

  it("sorters' pay put on a lot is a running cost: the lot's profit does not change", async () => {
    const worker = await prisma.worker.create({ data: { tenantId: a.tenantId, name: 'Akram', payType: 'KG', rate: 10, createdBy: a.userId } });
    const sheet = await prisma.paySheet.create({ data: { tenantId: a.tenantId, periodStart: new Date(), periodEnd: new Date(), status: 'PAID', total: 1000, createdBy: a.userId } });
    const line = await prisma.paySheetLine.create({ data: { tenantId: a.tenantId, paySheetId: sheet.id, workerId: worker.id, payType: 'KG', rate: 10, kg: 100, gross: 1000, net: 1000 } });
    await prisma.labourCost.create({ data: { tenantId: a.tenantId, paySheetLineId: line.id, ragId: lotId, amount: 1000 } });
    const tr = (await api(app, a).get('/workspace/finance/trading?months=1').expect(200)).body;
    expect(tr.byLot.find((l: any) => l.id === lotId).profit).toBe('4000');
    expect(tr.bySupplier[0].profit).toBe('4000');
    // The lot's page still says what was paid for sorting it.
    expect((await api(app, a).get(`/workspace/sorting/${lotId}`).expect(200)).body.lot.labour).toBe('1000');
  });

  it('a payment to the supplier and one from the customer show as paid, and take off what is owed', async () => {
    await api(app, a).post(`/workspace/suppliers/${vendorId}/payments`, { amount: 4000, method: 'BANK' }).expect(201);
    await api(app, a).post('/khata/payments', { customerId: buyerId, amount: 2000, method: 'BANK' }).expect(201);
    const tr = (await api(app, a).get('/workspace/finance/trading?months=1').expect(200)).body;
    expect(tr.owed).toEqual({ toSuppliers: '6000', paidToSuppliers: '4000', byCustomers: '7000', receivedFromCustomers: '2000' });
  });

  it('another business sees none of it; the report needs the right to see books and cost', async () => {
    const other = (await api(app, b).get('/workspace/finance/trading?months=1').expect(200)).body;
    expect([other.byLot, other.bySupplier, other.byCustomer, other.byItem]).toEqual([[], [], [], []]);
    expect(other.stock).toMatchObject({ bought: '0', soldAtCost: '0', closing: '0' });
    expect(other.owed).toEqual({ toSuppliers: '0', paidToSuppliers: '0', byCustomers: '0', receivedFromCustomers: '0' });
    const plain = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, plain).get('/workspace/finance/trading').expect(403);
  });
});
