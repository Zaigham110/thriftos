import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExpenseCategory } from '@prisma/client';
import { EXPENSE_SECTIONS } from '../../src/workspace/finance';
import { businessDay } from '../../src/workspace/receivables.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

const today = () => businessDay(new Date());
/** The first day of the month `n` months from this one (business months). */
const monthStart = (n: number) => {
  const [y, m] = today().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};

/**
 * v2 review (Profit and loss): months before the business started are left out, the months before the period
 * are there to compare with, the current month says it is not over, the days closed short or over are named,
 * and the dashboard's net profit is the same calculation. Another business sees nothing.
 */
describe('Profit and loss review (e2e)', () => {
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

  it('starts at the first month with activity and compares with the months before', async () => {
    // Rent four months ago (before a 3-month period), rent two months ago and this month.
    await api(app, a).post('/workspace/expenses', { category: 'RENT', amount: 30000, method: 'BANK', day: monthStart(-4) }).expect(201);
    await api(app, a).post('/workspace/expenses', { category: 'RENT', amount: 30000, method: 'BANK', day: monthStart(-2) }).expect(201);
    await api(app, a).post('/workspace/expenses', { category: 'SALARY', amount: 20000, method: 'BANK', day: monthStart(0) }).expect(201);

    const p = (await api(app, a).get('/workspace/finance/pnl?months=3').expect(200)).body;
    expect(p.months.map((m: { month: string }) => m.month)).toEqual([monthStart(-2).slice(0, 7), monthStart(-1).slice(0, 7), monthStart(0).slice(0, 7)]);
    expect(p.totals).toMatchObject({ expenseTotal: '50000', netProfit: '-50000', marginPercent: null });
    expect(p.previous).toMatchObject({ expenseTotal: '30000', netProfit: '-30000' });

    // A 6-month period starts four months ago; nothing happened before it.
    const six = (await api(app, a).get('/workspace/finance/pnl?months=6').expect(200)).body;
    expect(six.months[0].month).toBe(monthStart(-4).slice(0, 7));
    expect(six.previous).toBeNull();

    // The current month: how many days so far (null on the last day of a month).
    const day = Number(today().slice(8, 10));
    const of = Number(new Date(Date.UTC(Number(today().slice(0, 4)), Number(today().slice(5, 7)), 0)).getUTCDate());
    expect(p.current).toEqual(day < of ? { month: today().slice(0, 7), days: day, of } : null);
  });

  it('names the days closed short or over, and the dashboard net profit is the same calculation', async () => {
    const t = await createTenantWithOwner(app);
    const c = (await api(app, t).post('/customers', { name: 'Gul Khan', phone: '0300 1112233' }).expect(201)).body;
    const item = (await api(app, t).post('/stock/items', { name: 'Jeans bale', unit: 'BALE', quantity: 3, totalCost: 18000 }).expect(201)).body;
    await api(app, t).post('/sales', { customerId: c.id, paymentMode: 'CASH', paidAmount: 10000, paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 10000 }] }).expect(201);
    await api(app, t).post('/workspace/expenses', { category: 'TEA_FOOD', amount: 500 }).expect(201);
    // One bale lost: written off at cost.
    const count = (await api(app, t).post(`/workspace/stock/${item.id}/counts`, { counted: 1, reason: 'Lost in transport' }).expect(201)).body;
    await api(app, t).post(`/workspace/stock-counts/${count.id}/approve`, {}).expect(200);
    await api(app, t).post('/workspace/finance/close', { day: today(), counted: 9000, note: 'Rs 500 short' }).expect(201);

    const p = (await api(app, t).get('/workspace/finance/pnl?months=1').expect(200)).body;
    const now = p.months[0];
    expect(now).toMatchObject({ revenue: '10000', cost: '6000', writeOffs: '-6000', cashDifference: '-500', expenseTotal: '500', netProfit: '-3000', cashDays: [today()] });

    const from = monthStart(0);
    const d = (await api(app, t).get(`/workspace/dashboard?from=${from}&to=${today()}`).expect(200)).body;
    expect(d.expenses.netProfit).toBe(now.netProfit);
  });

  it('expenses fall into sections; buying and the owner\'s cash are shown apart and do not change profit (owner, 2026-11-12)', async () => {
    // Every kind of expense is in exactly one section.
    const inSections = Object.values(EXPENSE_SECTIONS).flat();
    expect([...inSections].sort()).toEqual(Object.values(ExpenseCategory).sort());

    const t = await createTenantWithOwner(app);
    const c = (await api(app, t).post('/customers', { name: 'Section Buyer', phone: '0300 4445566' }).expect(201)).body;
    const item = (await api(app, t).post('/stock/items', { name: 'Shirts bale', unit: 'BALE', quantity: 2, totalCost: 12000 }).expect(201)).body;
    await api(app, t).post('/sales', { customerId: c.id, paymentMode: 'CASH', paidAmount: 20000, paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 20000 }] }).expect(201);
    await api(app, t).post('/workspace/expenses', { category: 'SALARY', amount: 3000 }).expect(201);
    await api(app, t).post('/workspace/expenses', { category: 'LABOUR', amount: 1000 }).expect(201);
    await api(app, t).post('/workspace/expenses', { category: 'RENT', amount: 2000, method: 'BANK' }).expect(201);
    await api(app, t).post('/workspace/expenses', { category: 'TEA_FOOD', amount: 300 }).expect(201);
    await api(app, t).post('/workspace/expenses', { category: 'OTHER', amount: 200 }).expect(201);
    const before = (await api(app, t).get('/workspace/finance/pnl?months=1').expect(200)).body.months[0];
    // The owner takes cash home and pays some into the bank: neither is a loss.
    await api(app, t).post('/workspace/finance/cash-moves', { direction: 'OUT', kind: 'OWNER', amount: 5000 }).expect(201);
    await api(app, t).post('/workspace/finance/cash-moves', { direction: 'OUT', kind: 'BANK', amount: 4000 }).expect(201);
    // Other cash taken out (setting the drawer right) is shown apart too, and is no loss either.
    await api(app, t).post('/workspace/finance/cash-moves', { direction: 'OUT', kind: 'OTHER', amount: 300, note: 'Drawer set right' }).expect(201);

    const p = (await api(app, t).get('/workspace/finance/pnl?months=1').expect(200)).body;
    const now = p.months[0];
    expect(now.sections).toEqual({ employee: '4000', running: '2000', petty: '500' });
    expect(now.expenseTotal).toBe('6500');
    expect(now.bought).toBe('12000');
    expect(now.notInProfit).toEqual({ ownerOut: '5000', ownerIn: '0', bankOut: '4000', bankIn: '0', otherOut: '300', otherIn: '0' });
    // Gross 20,000 − 6,000 = 14,000; net 14,000 − 6,500 = 7,500, the same before and after the cash moved.
    expect([now.grossProfit, now.netProfit, before.netProfit]).toEqual(['14000', '7500', '7500']);
    expect(p.totals).toMatchObject({ sections: { employee: '4000', running: '2000', petty: '500' }, bought: '12000', notInProfit: { ownerOut: '5000', bankOut: '4000' } });
  });

  it('another business sees nothing', async () => {
    const p = (await api(app, b).get('/workspace/finance/pnl?months=6').expect(200)).body;
    expect(p.totals).toMatchObject({ revenue: '0', expenseTotal: '0', netProfit: '0', bought: '0', sections: { employee: '0', running: '0', petty: '0' }, notInProfit: { ownerOut: '0', ownerIn: '0', bankOut: '0', bankIn: '0' } });
    expect(p.previous).toBeNull();
    expect(p.months).toHaveLength(1);
    expect(await prisma.expense.count({ where: { tenantId: b.tenantId } })).toBe(0);
  });
});
