import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { businessDay } from '../../src/workspace/receivables.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

const today = () => businessDay(new Date());
const dayOffset = (n: number) => businessDay(new Date(Date.now() + n * 86_400_000));

/**
 * Enterprise plan E3.6: expenses, cash and bank books by payment method, the daily cash close (short/over
 * carried into the cash book, closed days locked), profit and loss by month. Management accounts, not a ledger.
 */
describe('Workspace finance: expenses, books, cash close, profit and loss (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const ids: Record<string, string> = {};

  async function userWith(codes: string[]): Promise<TestTenant> {
    const u = await createUserWithoutPermissions(app, a.tenantId);
    const role = await prisma.role.create({ data: { tenantId: a.tenantId, name: `Role ${Date.now()}-${Math.random()}` } });
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    await prisma.userRole.create({ data: { userId: u.userId, roleId: role.id } });
    return u;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    // A cash sale of Rs 10,000 (cost Rs 6,000) and Rs 5,000 received on JazzCash.
    const c = (await api(app, a).post('/customers', { name: 'Imran Landa Centre', phone: '03001239876' }).expect(201)).body;
    const item = (await api(app, a).post('/stock/items', { name: 'Jeans bale', unit: 'BALE', quantity: 1, totalCost: 6000 }).expect(201)).body;
    await api(app, a).post('/sales', { customerId: c.id, paymentMode: 'CASH', paidAmount: 10000, paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 10000 }] }).expect(201);
    await api(app, a).post('/khata/payments', { customerId: c.id, amount: 5000, method: 'JAZZCASH' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('expenses: recorded by category and method, no future days, listed with totals', async () => {
    ids.rent = (await api(app, a).post('/workspace/expenses', { category: 'RENT', amount: 3000, paidTo: 'Landlord', note: 'November godown rent' }).expect(201)).body.id;
    ids.transport = (await api(app, a).post('/workspace/expenses', { category: 'TRANSPORT', amount: 1000, paidTo: 'Rickshaw' }).expect(201)).body.id;
    ids.labour = (await api(app, a).post('/workspace/expenses', { category: 'LABOUR', amount: 2000, method: 'BANK', day: today() }).expect(201)).body.id;
    await api(app, a).post('/workspace/expenses', { category: 'RENT', amount: 1, day: dayOffset(2) }).expect(400);
    await api(app, a).post('/workspace/expenses', { category: 'PARTY', amount: 1 }).expect(400);
    const list = (await api(app, a).get('/lists/expenses').expect(200)).body;
    expect(list.rows).toHaveLength(3);
    expect(list.totals).toEqual({ amount: '6000' });
    const grouped = (await api(app, a).get('/lists/expenses?groupBy=method').expect(200)).body;
    expect(grouped.groups).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'CASH', count: 2, totals: { amount: '4000' } })]));
    expect((await api(app, a).get(`/workspace/expenses/${ids.rent}`).expect(200)).body).toMatchObject({ category: 'RENT', amount: '3000', paidTo: 'Landlord', day: today() });
    await api(app, a).get(`/records/expense/${ids.rent}/activity`).expect(200);
  });

  it('books: money in from payments, out for expenses, per method', async () => {
    const cash = (await api(app, a).get('/workspace/finance/book?method=CASH').expect(200)).body;
    expect(cash).toMatchObject({ opening: '0', in: '10000', out: '4000', closing: '6000' });
    expect(cash.lines.map((l: { kind: string }) => l.kind)).toEqual(['RECEIPT', 'EXPENSE', 'EXPENSE']);
    expect(cash.lines[0]).toMatchObject({ party: 'Imran Landa Centre', balance: '10000' });
    expect((await api(app, a).get('/workspace/finance/book?method=JAZZCASH').expect(200)).body).toMatchObject({ in: '5000', closing: '5000' });
    expect((await api(app, a).get('/workspace/finance/book?method=BANK').expect(200)).body).toMatchObject({ out: '2000', closing: '-2000' });
    // A later period starts from what was there before it.
    expect((await api(app, a).get(`/workspace/finance/book?method=CASH&from=${dayOffset(1)}&to=${dayOffset(1)}`).expect(200)).body).toMatchObject({ opening: '6000', lines: [], closing: '6000' });
  });

  it('daily cash close: expected from the book, short carried in, the day locked', async () => {
    const v = (await api(app, a).get(`/workspace/finance/close?day=${today()}`).expect(200)).body;
    expect(v).toMatchObject({ opening: '0', in: '10000', out: '4000', expected: '6000', close: null });
    await api(app, a).post('/workspace/finance/close', { day: dayOffset(1), counted: 0 }).expect(400);
    const c = (await api(app, a).post('/workspace/finance/close', { day: today(), counted: 5800, note: 'Rs 200 short' }).expect(201)).body;
    expect(c).toMatchObject({ expected: '6000', counted: '5800', difference: '-200' });
    await api(app, a).post('/workspace/finance/close', { day: today(), counted: 6000 }).expect(409);
    // Cash on a closed day is locked; bank is not.
    await api(app, a).post('/workspace/expenses', { category: 'OTHER', amount: 50 }).expect(409);
    await api(app, a).post(`/workspace/expenses/${ids.transport}/cancel`, {}).expect(409);
    await api(app, a).post(`/workspace/expenses/${ids.labour}/cancel`, {}).expect(200);
    await api(app, a).post(`/workspace/expenses/${ids.labour}/cancel`, {}).expect(409);
    const cash = (await api(app, a).get('/workspace/finance/book?method=CASH').expect(200)).body;
    expect(cash.lines[cash.lines.length - 1]).toMatchObject({ kind: 'CLOSE', out: '200', balance: '5800' });
    expect(cash.closing).toBe('5800');
    const again = (await api(app, a).get(`/workspace/finance/close?day=${today()}`).expect(200)).body;
    expect(again.close).toMatchObject({ counted: '5800', difference: '-200' });
    expect(again.recent).toHaveLength(1);
    // The next day starts from what was counted.
    expect((await api(app, a).get(`/workspace/finance/close?day=${dayOffset(1)}`).expect(200)).body).toMatchObject({ opening: '5800', expected: '5800' });
  });

  it('profit and loss by month: sales − cost − write-offs − cash short − expenses', async () => {
    const p = (await api(app, a).get('/workspace/finance/pnl').expect(200)).body;
    expect(p.months).toHaveLength(12);
    const now = p.months[11];
    expect(now).toMatchObject({ month: today().slice(0, 7), revenue: '10000', cost: '6000', grossProfit: '4000', marginPercent: 40, cashDifference: '-200', expenseTotal: '4000', netProfit: '-200' });
    expect(now.expenses).toMatchObject({ RENT: '3000', TRANSPORT: '1000', LABOUR: '0' });
    expect(p.totals).toMatchObject({ revenue: '10000', netProfit: '-200' });
    expect((await api(app, a).get('/workspace/finance/pnl?months=3').expect(200)).body.months).toHaveLength(3);
    await api(app, a).get('/workspace/finance/pnl?months=40').expect(400);
  });

  it('permissions: books need finance.view, P&L also cost.view, recording needs expense.create, closing cash.close', async () => {
    const munshi = await userWith(['expense.create']);
    await api(app, munshi).post('/workspace/expenses', { category: 'OTHER', amount: 10, day: dayOffset(-1) }).expect(201);
    await api(app, munshi).get('/workspace/finance/book').expect(403);
    await api(app, munshi).post('/workspace/finance/close', { day: dayOffset(-1), counted: 0 }).expect(403);
    const accountant = await userWith(['finance.view']);
    await api(app, accountant).get('/workspace/finance/book').expect(200);
    await api(app, accountant).get('/workspace/finance/pnl').expect(403);
    await api(app, accountant).post('/workspace/expenses', { category: 'OTHER', amount: 10 }).expect(403);
  });

  it('another business sees and changes nothing', async () => {
    await api(app, b).get(`/workspace/expenses/${ids.rent}`).expect(404);
    await api(app, b).post(`/workspace/expenses/${ids.rent}/cancel`, {}).expect(404);
    expect((await api(app, b).get('/lists/expenses').expect(200)).body.rows).toEqual([]);
    expect((await api(app, b).get('/workspace/finance/book').expect(200)).body).toMatchObject({ lines: [], closing: '0' });
    expect((await api(app, b).get(`/workspace/finance/close?day=${today()}`).expect(200)).body).toMatchObject({ expected: '0', close: null });
    expect((await api(app, b).get('/workspace/finance/pnl').expect(200)).body.totals.revenue).toBe('0');
    // Closing their own day is theirs alone.
    await api(app, b).post('/workspace/finance/close', { day: today(), counted: 0 }).expect(201);
  });
});
