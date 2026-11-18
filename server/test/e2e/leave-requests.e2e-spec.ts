import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

const day = (offset: number) => new Date(Date.now() + 5 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

/**
 * Leave requests and carry-over (owner, 2026-11-18). Leave is asked for over a span of days and given or refused;
 * given leave marks those days in Attendance (not over a day already marked present or a holiday), and
 * cancelling it clears them. Unused paid leave carries into the next year up to the business's limit.
 */
describe('Employees: leave requests and carry-over (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let clerk: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    for (const t of [a, b]) {
      const row = await prisma.tenant.findUniqueOrThrow({ where: { id: t.tenantId }, select: { enabledModules: true } });
      await prisma.tenant.update({ where: { id: t.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'PAYROLL'])] } });
    }
    clerk = (await api(app, a).post('/payroll/workers', { name: 'Office Clerk', payType: 'MONTH', rate: 30000, leaveAllowance: 10 }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('leave asked for waits; given, it marks the days; a day already marked present keeps its mark', async () => {
    await api(app, a).put('/payroll/attendance', { day: day(-1), marks: [{ workerId: clerk, status: 'PRESENT' }] }).expect(200);
    const asked = (await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(-2), toDay: day(2), reason: 'Family wedding' }).expect(201)).body;
    expect(asked.status).toBe('PENDING');
    expect((await api(app, a).get('/payroll/leave?status=PENDING').expect(200)).body.map((r: any) => [r.worker.name, r.days])).toEqual([['Office Clerk', 5]]);
    expect((await api(app, a).get('/payroll/workers').expect(200)).body[0]).toMatchObject({ leaveAsked: 1 });
    // Nothing is marked while it waits; days that overlap cannot be asked again.
    expect(await prisma.attendance.count({ where: { workerId: clerk, status: 'LEAVE' } })).toBe(0);
    expect((await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(1), toDay: day(3) }).expect(409)).body.code).toBe('OVERLAP');

    const given = (await api(app, a).post(`/payroll/leave/${asked.id}/approve`, {}).expect(200)).body;
    expect(given.status).toBe('APPROVED');
    const marks = await prisma.attendance.findMany({ where: { workerId: clerk }, orderBy: { day: 'asc' }, select: { status: true, note: true } });
    // Five days: four leave (future days too) and the day already present kept.
    expect(marks.map((m) => m.status)).toEqual(['LEAVE', 'PRESENT', 'LEAVE', 'LEAVE', 'LEAVE']);
    expect(marks[0].note).toBe('Family wedding');
    expect((await api(app, a).post(`/payroll/leave/${asked.id}/approve`, {}).expect(409)).body.code).toBe('DECIDED');

    // Cancelled: its leave marks go; the present day stays.
    await api(app, a).post(`/payroll/leave/${asked.id}/cancel`, {}).expect(200);
    expect((await prisma.attendance.findMany({ where: { workerId: clerk }, select: { status: true } })).map((m) => m.status)).toEqual(['PRESENT']);
  });

  it('refused leave marks nothing; given at once is marked at once; a span over 60 days or ending first is refused', async () => {
    const refused = (await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(5), toDay: day(6) }).expect(201)).body;
    expect((await api(app, a).post(`/payroll/leave/${refused.id}/reject`, {}).expect(200)).body.status).toBe('REJECTED');
    expect(await prisma.attendance.count({ where: { workerId: clerk, status: 'LEAVE' } })).toBe(0);
    const atOnce = (await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(5), toDay: day(5), approve: true }).expect(201)).body;
    expect(atOnce.status).toBe('APPROVED');
    expect(await prisma.attendance.count({ where: { workerId: clerk, status: 'LEAVE' } })).toBe(1);
    await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(10), toDay: day(80) }).expect(400);
    await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(10), toDay: day(9) }).expect(400);
    await api(app, a).post(`/payroll/leave/${atOnce.id}/maybe`, {}).expect(404);
  });

  it('another business neither sees nor decides this leave', async () => {
    const r = (await api(app, a).post('/payroll/leave', { workerId: clerk, fromDay: day(20), toDay: day(21) }).expect(201)).body;
    expect((await api(app, b).get('/payroll/leave').expect(200)).body).toEqual([]);
    await api(app, b).post(`/payroll/leave/${r.id}/approve`, {}).expect(404);
    await api(app, b).post('/payroll/leave', { workerId: clerk, fromDay: day(30), toDay: day(30) }).expect(404);
    expect((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('PENDING');
  });

  it('unused paid leave carries into the next year up to the limit; with no limit nothing carries', async () => {
    const year = Number(day(0).slice(0, 4));
    // Last year the clerk took 3 of their 10 days: 7 unused.
    for (const d of ['03-01', '03-02', '03-03']) await prisma.attendance.create({ data: { tenantId: a.tenantId, workerId: clerk, day: new Date(`${year - 1}-${d}T00:00:00Z`), status: 'LEAVE', markedBy: a.userId } });
    const mine = async () => (await api(app, a).get('/payroll/workers').expect(200)).body.find((w: any) => w.id === clerk);
    expect((await mine()).leaveThisYear).toBe(10);
    expect((await api(app, a).patch('/payroll/settings', { leaveCarryMax: 5 }).expect(200)).body).toEqual({ trackSorterWork: false, leaveCarryMax: 5 });
    expect((await mine()).leaveThisYear).toBe(15);
    await api(app, a).patch('/payroll/settings', { leaveCarryMax: 30 }).expect(200);
    expect((await mine()).leaveThisYear).toBe(17);
    // Each business has its own limit.
    expect((await api(app, b).get('/payroll/settings').expect(200)).body.leaveCarryMax).toBe(0);
  });
});
