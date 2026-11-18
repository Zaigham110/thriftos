import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

const day = (offset: number) => new Date(Date.now() + 5 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

/**
 * Loans and leave (owner, 2026-11-17: Employee Management). A loan is cash lent to an employee: out of the drawer
 * but not an expense; an instalment comes off each pay sheet, or cash is handed back. Leave: a yearly number of
 * paid leave days; leave within it is paid to staff paid by the day, leave beyond it is not.
 */
describe('Employees: loans and leave (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let loader: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    for (const t of [a, b]) {
      const row = await prisma.tenant.findUniqueOrThrow({ where: { id: t.tenantId }, select: { enabledModules: true } });
      await prisma.tenant.update({ where: { id: t.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'PAYROLL', 'EXPENSES', 'CASH_CLOSE', 'PNL'])] } });
    }
    loader = (await api(app, a).post('/payroll/workers', { name: 'Daily Loader', payType: 'DAY', rate: 1000, leaveAllowance: 1 }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('a loan is cash out that is not an expense; the employee owes it; another business cannot touch it', async () => {
    await api(app, a).post(`/payroll/workers/${loader}/loans`, { amount: 5000, instalment: 6000 }).expect(400);
    const loan = (await api(app, a).post(`/payroll/workers/${loader}/loans`, { amount: 5000, instalment: 2000, note: 'Wedding' }).expect(201)).body;
    expect([loan.amount, loan.instalment, loan.repaid]).toEqual(['5000', '2000', '0']);
    expect((await api(app, a).get('/payroll/workers').expect(200)).body[0]).toMatchObject({ name: 'Daily Loader', loanLeft: '5000', leaveAllowance: 1, leaveTaken: 0 });
    // Out of the drawer, shown apart, and no expense: running costs are untouched.
    expect(await prisma.expense.count({ where: { tenantId: a.tenantId } })).toBe(0);
    const p = (await api(app, a).get('/workspace/finance/pnl?months=1').expect(200)).body.totals;
    expect([p.runningCosts, p.notInProfit.otherOut]).toEqual(['0', '5000']);
    await api(app, b).post(`/payroll/workers/${loader}/loans`, { amount: 100, instalment: 100 }).expect(404);
    await api(app, b).post(`/payroll/workers/${loader}/loans/repay`, { amount: 100 }).expect(404);
    await api(app, b).get(`/payroll/workers/${loader}/loans`).expect(200).then((r) => expect(r.body).toEqual([]));
  });

  it('leave within the yearly allowance is paid to daily staff, leave beyond it is not; the instalment comes off the pay', async () => {
    // Four days: present, leave (paid: the allowance is 1), leave (unpaid: used up), present.
    await api(app, a).put('/payroll/attendance', { day: day(-3), marks: [{ workerId: loader, status: 'PRESENT' }] }).expect(200);
    await api(app, a).put('/payroll/attendance', { day: day(-2), marks: [{ workerId: loader, status: 'LEAVE' }] }).expect(200);
    await api(app, a).put('/payroll/attendance', { day: day(-1), marks: [{ workerId: loader, status: 'LEAVE' }] }).expect(200);
    await api(app, a).put('/payroll/attendance', { day: day(0), marks: [{ workerId: loader, status: 'PRESENT' }] }).expect(200);
    // The four days may cross a year end: the allowance is per year, so skip the exact count then.
    const oneYear = day(-3).slice(0, 4) === day(0).slice(0, 4);

    const sheet = (await api(app, a).post('/payroll/sheets', { periodStart: day(-3), periodEnd: day(0) }).expect(201)).body;
    const line = sheet.lines[0];
    if (oneYear) expect([line.days, line.gross]).toEqual(['3', '3000']);
    // The instalment of 2,000 comes off; the rest is handed over.
    expect([line.loan, Number(line.net)]).toEqual(['2000', Number(line.gross) - 2000]);
    // The owner may take more or less towards the loan, never more than is owed.
    expect((await api(app, a).patch(`/payroll/lines/${line.id}`, { loan: 6000 }).expect(400)).body.code).toBe('MORE_THAN_LOAN');
    const less = (await api(app, a).patch(`/payroll/lines/${line.id}`, { loan: 1000 }).expect(200)).body.lines[0];
    expect([less.loan, Number(less.net)]).toEqual(['1000', Number(line.gross) - 1000]);

    // A bonus or allowance goes on top, with what it is for; the loan instalment and the expense follow.
    const withBonus = (await api(app, a).patch(`/payroll/lines/${line.id}`, { bonus: 500, bonusNote: 'Eid bonus' }).expect(200)).body.lines[0];
    expect([withBonus.bonus, withBonus.bonusNote, Number(withBonus.net)]).toEqual(['500', 'Eid bonus', Number(line.gross) + 500 - 1000]);
    await api(app, a).patch(`/payroll/lines/${line.id}`, { bonus: -1 }).expect(400);
    await api(app, b).patch(`/payroll/lines/${line.id}`, { bonus: 900 }).expect(404);
    const paid = (await api(app, a).post(`/payroll/sheets/${sheet.id}/pay`, {}).expect(200)).body;
    expect(paid.status).toBe('PAID');
    // The whole wage is the expense; the instalment came back into the drawer as a loan repaid.
    const expense = await prisma.expense.findFirstOrThrow({ where: { tenantId: a.tenantId } });
    expect(expense.amount.toString()).toBe(String(Number(line.gross) + 500));
    const moves = await prisma.cashMove.findMany({ where: { tenantId: a.tenantId }, orderBy: { createdAt: 'asc' }, select: { direction: true, amount: true } });
    expect(moves.map((m) => [m.direction, m.amount.toString()])).toEqual([['OUT', '5000'], ['IN', '1000']]);
    expect((await api(app, a).get(`/payroll/workers/${loader}/loans`).expect(200)).body[0]).toMatchObject({ amount: '5000', repaid: '1000', left: '4000' });
    if (oneYear) expect((await api(app, a).get('/payroll/workers').expect(200)).body[0]).toMatchObject({ loanLeft: '4000', leaveTaken: 2 });
  });

  it('cash handed back takes the loan down; never more than is owed', async () => {
    expect((await api(app, a).post(`/payroll/workers/${loader}/loans/repay`, { amount: 5000 }).expect(400)).body.code).toBe('MORE_THAN_LOAN');
    expect((await api(app, a).post(`/payroll/workers/${loader}/loans/repay`, { amount: 4000 }).expect(200)).body.loanLeft).toBe('0');
    expect((await api(app, a).get('/payroll/workers').expect(200)).body[0].loanLeft).toBe('0');
    expect(await prisma.loanRepayment.count({ where: { tenantId: a.tenantId } })).toBe(2);
  });
});
