import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

const day = (offset: number) => new Date(Date.now() + 5 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

/**
 * Attendance (owner, 2026-11-17: Employee Management): each employee's day is present, absent, half day, leave or
 * a holiday; a month shows the counts; days present pay staff paid by the day, and absences show beside a monthly
 * salary. Only this business's employees, only for the owner.
 */
describe('Employees: attendance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let daily: string;
  let monthly: string;
  let theirs: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    for (const t of [a, b]) {
      const row = await prisma.tenant.findUniqueOrThrow({ where: { id: t.tenantId }, select: { enabledModules: true } });
      await prisma.tenant.update({ where: { id: t.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'PAYROLL', 'EXPENSES'])] } });
    }
    daily = (await api(app, a).post('/payroll/workers', { name: 'Daily Loader', payType: 'DAY', rate: 1000, jobTitle: 'Loader' }).expect(201)).body.id;
    monthly = (await api(app, a).post('/payroll/workers', { name: 'Monthly Clerk', payType: 'MONTH', rate: 30000 }).expect(201)).body.id;
    theirs = (await api(app, b).post('/payroll/workers', { name: 'Other Staff', payType: 'DAY', rate: 500 }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('a day lists everybody unmarked; marking sets, changes and clears; a day that has not come is refused', async () => {
    const before = (await api(app, a).get(`/payroll/attendance?day=${day(0)}`).expect(200)).body;
    expect(before.employees.map((e: any) => [e.name, e.status])).toEqual([['Daily Loader', null], ['Monthly Clerk', null]]);
    const marked = (await api(app, a).put('/payroll/attendance', { day: day(0), marks: [{ workerId: daily, status: 'PRESENT' }, { workerId: monthly, status: 'ABSENT', note: 'Sick' }] }).expect(200)).body;
    expect(marked.employees.map((e: any) => [e.name, e.status, e.note])).toEqual([['Daily Loader', 'PRESENT', null], ['Monthly Clerk', 'ABSENT', 'Sick']]);
    // Marked again: changed, not doubled. Null clears.
    await api(app, a).put('/payroll/attendance', { day: day(0), marks: [{ workerId: daily, status: 'HALF_DAY' }] }).expect(200);
    expect(await prisma.attendance.count({ where: { workerId: daily } })).toBe(1);
    const cleared = (await api(app, a).put('/payroll/attendance', { day: day(0), marks: [{ workerId: monthly, status: null }] }).expect(200)).body;
    expect(cleared.employees.map((e: any) => e.status)).toEqual(['HALF_DAY', null]);
    expect((await api(app, a).put('/payroll/attendance', { day: day(1), marks: [{ workerId: daily, status: 'PRESENT' }] }).expect(400)).body.code).toBe('FUTURE_DAY');
    await api(app, a).put('/payroll/attendance', { day: day(0), marks: [{ workerId: daily, status: 'LATE' }] }).expect(400);
  });

  it('another business neither sees nor marks these employees; without the right, nobody opens attendance', async () => {
    expect((await api(app, b).get(`/payroll/attendance?day=${day(0)}`).expect(200)).body.employees.map((e: any) => e.name)).toEqual(['Other Staff']);
    await api(app, b).put('/payroll/attendance', { day: day(0), marks: [{ workerId: daily, status: 'ABSENT' }] }).expect(404);
    await api(app, a).put('/payroll/attendance', { day: day(0), marks: [{ workerId: theirs, status: 'ABSENT' }] }).expect(404);
    expect((await prisma.attendance.findFirstOrThrow({ where: { workerId: daily } })).status).toBe('HALF_DAY');
    const plain = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, plain).get(`/payroll/attendance?day=${day(0)}`).expect(403);
    await api(app, plain).put('/payroll/attendance', { day: day(0), marks: [{ workerId: daily, status: 'PRESENT' }] }).expect(403);
  });

  it('a month counts the days of each kind; the pay sheet pays the days present and shows the days absent', async () => {
    // Over four days: the loader present, present, half day (today), absent; the clerk absent twice.
    await api(app, a).put('/payroll/attendance', { day: day(-1), marks: [{ workerId: daily, status: 'PRESENT' }, { workerId: monthly, status: 'ABSENT' }] }).expect(200);
    await api(app, a).put('/payroll/attendance', { day: day(-2), marks: [{ workerId: daily, status: 'PRESENT' }, { workerId: monthly, status: 'ABSENT' }] }).expect(200);
    await api(app, a).put('/payroll/attendance', { day: day(-3), marks: [{ workerId: daily, status: 'ABSENT' }, { workerId: monthly, status: 'HOLIDAY' }] }).expect(200);

    const sheet = (await api(app, a).post('/payroll/sheets', { periodStart: day(-3), periodEnd: day(0) }).expect(201)).body;
    const line = (id: string) => sheet.lines.find((l: any) => l.workerId === id);
    // 2 days and a half at Rs 1,000; absent a day and a half.
    expect([line(daily).days, line(daily).gross, line(daily).absentDays]).toEqual(['2.5', '2500', '1.5']);
    // A monthly salary is not cut by itself: the days absent are shown for the owner to decide a deduction.
    expect([line(monthly).gross, line(monthly).absentDays]).toEqual(['4000', '2']);
    // Half days can be typed on the line too.
    const changed = (await api(app, a).patch(`/payroll/lines/${line(daily).id}`, { days: 3.5 }).expect(200)).body;
    expect(changed.lines.find((l: any) => l.workerId === daily).gross).toBe('3500');

    const month = (await api(app, a).get(`/payroll/attendance/month?month=${day(0).slice(0, 7)}`).expect(200)).body;
    const of = (id: string) => month.employees.find((e: any) => e.id === id);
    // Days of an earlier month are not counted when the four days cross a month end.
    const inMonth = [0, -1, -2, -3].filter((o) => day(o).slice(0, 7) === day(0).slice(0, 7)).length;
    const c = of(daily).counts;
    expect(c.PRESENT + c.HALF_DAY + c.ABSENT).toBe(inMonth);
    expect(of(daily).days[day(0)]).toBe('HALF_DAY');
    expect(month.employees.map((e: any) => e.name)).toEqual(['Daily Loader', 'Monthly Clerk']);
    await api(app, a).get('/payroll/attendance/month?month=2026-13-01').expect(400);
  });
});
