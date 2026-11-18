import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { staffPermissionCodes } from '../../src/users/staff';
import { api, createTenantWithOwner, createTestApp, createUserWith, TestTenant } from './fixtures';

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Rights for managers (owner, 2026-11-18). "employee.manage" opens employee records, attendance and leave;
 * "payroll.run" opens pay sheets, advances, loans and the employee settings. The Manager role has the first, not
 * the second; the owner has both.
 */
describe('Employees: rights for managers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let manager: TestTenant;
  let payer: TestTenant;
  let worker: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'PAYROLL', 'EXPENSES'])] } });
    manager = await createUserWith(app, a.tenantId, ['employee.manage']);
    payer = await createUserWith(app, a.tenantId, ['payroll.run']);
    worker = (await api(app, a).post('/payroll/workers', { name: 'Loader', payType: 'DAY', rate: 1000 }).expect(201)).body.id;
    await api(app, a).post(`/payroll/workers/${worker}/loans`, { amount: 3000, instalment: 1000 }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('the Manager role has the records right and not the pay right; the owner has both', async () => {
    const all = (await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code);
    const codes = staffPermissionCodes('Manager', all);
    expect(codes).toContain('employee.manage');
    expect(codes).not.toContain('payroll.run');
    expect(all).toEqual(expect.arrayContaining(['employee.manage', 'payroll.run']));
  });

  it('with the records right: employees, attendance and leave; not pay, advances, loans or settings, and no loan figures', async () => {
    const list = (await api(app, manager).get('/payroll/workers').expect(200)).body;
    expect(list[0]).toMatchObject({ name: 'Loader', loanLeft: null });
    const added = (await api(app, manager).post('/payroll/workers', { name: 'Helper', payType: 'MONTH', rate: 20000 }).expect(201)).body;
    await api(app, manager).patch(`/payroll/workers/${added.id}`, { jobTitle: 'Helper' }).expect(200);
    await api(app, manager).put('/payroll/attendance', { day: today(), marks: [{ workerId: worker, status: 'PRESENT' }] }).expect(200);
    const leave = (await api(app, manager).post('/payroll/leave', { workerId: added.id, fromDay: today(), toDay: today() }).expect(201)).body;
    await api(app, manager).post(`/payroll/leave/${leave.id}/approve`, {}).expect(200);
    await api(app, manager).get(`/payroll/attendance/month?month=${today().slice(0, 7)}`).expect(200);

    await api(app, manager).get('/payroll/sheets').expect(403);
    await api(app, manager).post('/payroll/sheets', { periodStart: today(), periodEnd: today() }).expect(403);
    await api(app, manager).post(`/payroll/workers/${worker}/advances`, { amount: 100 }).expect(403);
    await api(app, manager).post(`/payroll/workers/${worker}/loans`, { amount: 100, instalment: 100 }).expect(403);
    await api(app, manager).get(`/payroll/workers/${worker}/loans`).expect(403);
    await api(app, manager).patch('/payroll/settings', { leaveCarryMax: 5 }).expect(403);
  });

  it('with the pay right: pay sheets and loan figures; not marking attendance or adding employees', async () => {
    expect((await api(app, payer).get('/payroll/workers').expect(200)).body.find((w: any) => w.id === worker).loanLeft).toBe('3000');
    await api(app, payer).post('/payroll/sheets', { periodStart: today(), periodEnd: today() }).expect(201);
    await api(app, payer).patch('/payroll/settings', { leaveCarryMax: 5 }).expect(200);
    await api(app, payer).put('/payroll/attendance', { day: today(), marks: [{ workerId: worker, status: 'ABSENT' }] }).expect(403);
    await api(app, payer).post('/payroll/workers', { name: 'Nobody', payType: 'DAY', rate: 1 }).expect(403);
  });
});
