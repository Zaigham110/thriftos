import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

const businessDay = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Phase 8 acceptance: a day of sorting with workers paid per kg, per piece, per day and a monthly salary produces
 * a correct pay sheet (advances and deductions off), paid as one cash Labour expense, with the labour cost on the
 * lot and its container; productivity per worker; one business never sees another's workers.
 */
describe('Phase 8 sorter pay: workers, pay sheet, labour cost, productivity (e2e)', () => {
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

  it('works only with the Payroll module; Workshop and up have it', async () => {
    await api(app, a).get('/payroll/workers').expect(403);
    expect((await api(app, a).get('/sorting/workers').expect(200)).body).toEqual([]);
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, select: { code: true, modules: true } });
    expect(plans.filter((p) => p.modules.includes('PAYROLL')).map((p) => p.code)).toEqual(['WORKSHOP', 'IMPORTER', 'EXPORT']);
    for (const t of [a, b]) {
      const row = await prisma.tenant.findUniqueOrThrow({ where: { id: t.tenantId }, select: { enabledModules: true } });
      await prisma.tenant.update({ where: { id: t.tenantId }, data: { enabledModules: [...row.enabledModules, 'PAYROLL', 'EXPENSES', 'CONTAINERS'] } });
    }
  });

  it('a day of sorting → pay sheet → paid as cash Labour → labour cost on the lot and container → productivity', async () => {
    const add = async (body: object) => (await api(app, a).post('/payroll/workers', body).expect(201)).body;
    const akram = await add({ name: 'Akram', phone: '0300 1234501', payType: 'KG', rate: 10 });
    const bilal = await add({ name: 'Bilal', payType: 'PIECE', rate: 5 });
    const chacha = await add({ name: 'Chacha', payType: 'DAY', rate: 1500 });
    const munshi = await add({ name: 'Munshi', payType: 'MONTH', rate: 30000 });
    await api(app, a).post('/payroll/workers', { name: 'Bad phone', phone: '12', payType: 'KG', rate: 1 }).expect(400);
    expect((await api(app, a).get('/sorting/workers').expect(200)).body.map((w: any) => w.name)).toEqual(['Akram', 'Bilal', 'Chacha', 'Munshi']);

    // A container lot of 500 kg, sorted today by three of them.
    const { jeans, shirts, waste } = await seedSortableLot(app, a.tenantId);
    const vendor = (await api(app, a).post('/procurement/vendors', { name: 'Pay Vendor' }).expect(201)).body;
    const container = (await api(app, a).post('/procurement/containers', { vendorId: vendor.id, netWeightKg: 500, purchaseCost: 50000, withLot: true }).expect(201)).body;
    const lotId = container.rags[0].id;
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lotId }).expect(201)).body.session;
    const sort = (body: object) => api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, ...body }).expect(200);
    await sort({ categoryId: jeans.id, amountKg: 200, workerId: akram.id });
    await sort({ categoryId: shirts.id, amountKg: 100, workerId: akram.id });
    await sort({ categoryId: shirts.id, amountKg: 50, pieces: 40, workerId: bilal.id });
    await sort({ categoryId: jeans.id, amountKg: 60, workerId: chacha.id });
    // Another business's worker cannot be named.
    const other = (await api(app, b).post('/payroll/workers', { name: 'Other', payType: 'KG', rate: 1 }).expect(201)).body;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, amountKg: 1, workerId: other.id }).expect(400);
    await api(app, a).patch(`/sorting/stage-1/${session.id}/seal`, { wasteCategoryId: waste.id }).expect(200);

    // Rs 1,000 advance to Akram: a cash Labour expense now.
    await api(app, a).post(`/payroll/workers/${akram.id}/advances`, { amount: 1000, note: 'Eid' }).expect(201);
    expect((await api(app, a).get(`/payroll/workers/${akram.id}`).expect(200)).body.openAdvances).toBe('1000');
    const before = await prisma.expense.findMany({ where: { tenantId: a.tenantId, category: 'LABOUR' }, select: { amount: true, note: true } });
    expect(before.map((e) => [Number(e.amount), e.note])).toEqual([[1000, 'Advance · Eid']]);

    // Today's pay sheet: kg × rate, pieces × rate, days × rate, a month's salary for one day; the advance off.
    const day = businessDay();
    let sheet = (await api(app, a).post('/payroll/sheets', { periodStart: day, periodEnd: day }).expect(201)).body;
    const line = (n: string) => sheet.lines.find((l: any) => l.worker.name === n);
    expect([line('Akram').kg, Number(line('Akram').gross), Number(line('Akram').advances), Number(line('Akram').net)]).toEqual(['300', 3000, 1000, 2000]);
    expect([line('Bilal').pieces, Number(line('Bilal').net)]).toEqual([40, 200]);
    expect([line('Chacha').days, Number(line('Chacha').net)]).toEqual([1, 1500]);
    expect(Number(line('Munshi').net)).toBe(1000);
    expect(Number(sheet.total)).toBe(4700);
    await api(app, a).post('/payroll/sheets', { periodStart: day, periodEnd: day }).expect(409);

    // A deduction for Chacha (Rs 200); more days than the period has are refused.
    await api(app, a).patch(`/payroll/lines/${line('Chacha').id}`, { days: 2 }).expect(400);
    sheet = (await api(app, a).patch(`/payroll/lines/${line('Chacha').id}`, { deductions: 200, note: 'Late' }).expect(200)).body;
    expect([Number(line('Chacha').net), Number(sheet.total)]).toEqual([1300, 4500]);

    // Paid: one cash Labour expense of Rs 4,500; the sheet cannot change any more.
    sheet = (await api(app, a).post(`/payroll/sheets/${sheet.id}/pay`).expect(200)).body;
    expect(sheet.status).toBe('PAID');
    const expenses = await prisma.expense.findMany({ where: { tenantId: a.tenantId, category: 'LABOUR' }, orderBy: { createdAt: 'asc' }, select: { amount: true, method: true } });
    expect(expenses.map((e) => [Number(e.amount), e.method])).toEqual([[1000, 'CASH'], [4500, 'CASH']]);
    await api(app, a).post(`/payroll/sheets/${sheet.id}/pay`).expect(409);
    await api(app, a).patch(`/payroll/lines/${line('Akram').id}`, { deductions: 1 }).expect(409);
    await api(app, a).delete(`/payroll/sheets/${sheet.id}`).expect(409);

    // Labour on the lot and container: Akram 3,000 + Bilal 200 + Chacha 1,300 (the salary had no sorting): 4,500.
    const labour = await prisma.labourCost.aggregate({ where: { tenantId: a.tenantId, ragId: lotId }, _sum: { amount: true } });
    expect(Number(labour._sum.amount)).toBe(4500);
    expect(Number((await prisma.labourCost.aggregate({ where: { tenantId: a.tenantId, containerId: container.id }, _sum: { amount: true } }))._sum.amount)).toBe(4500);
    const page = (await api(app, a).get(`/workspace/sorting/${lotId}`).expect(200)).body;
    expect(page.lot.labour).toBe('4500');

    // Productivity: kg per day worked, and the best-grade share (none graded here).
    const prod = (await api(app, a).get(`/payroll/productivity?from=${day}&to=${day}`).expect(200)).body;
    const ak = prod.workers.find((w: any) => w.name === 'Akram');
    expect([ak.kg, ak.days, ak.kgPerDay]).toEqual(['300', 1, '300']);
    expect(prod.workers.find((w: any) => w.name === 'Bilal').pieces).toBe(40);

    // Another business sees none of it.
    await api(app, b).get(`/payroll/workers/${akram.id}`).expect(404);
    await api(app, b).get(`/payroll/sheets/${sheet.id}`).expect(404);
    await api(app, b).patch(`/payroll/lines/${line('Akram').id}`, { deductions: 1 }).expect(404);
    expect((await api(app, b).get('/payroll/sheets').expect(200)).body).toEqual([]);
    void munshi;
  });

  it('a pay sheet not paid yet can be thrown away; its advances wait for the next one', async () => {
    const w = (await api(app, b).post('/payroll/workers', { name: 'Day man', payType: 'DAY', rate: 1000 }).expect(201)).body;
    await api(app, b).post(`/payroll/workers/${w.id}/advances`, { amount: 500 }).expect(201);
    const day = businessDay();
    const sheet = (await api(app, b).post('/payroll/sheets', { periodStart: day, periodEnd: day }).expect(201)).body;
    expect(Number(sheet.lines.find((l: any) => l.workerId === w.id).advances)).toBe(500);
    await api(app, b).delete(`/payroll/sheets/${sheet.id}`).expect(200);
    expect((await api(app, b).get(`/payroll/workers/${w.id}`).expect(200)).body.openAdvances).toBe('500');
  });
  it('paid at the same moment three times (a double tap on a slow line): paid once, one Labour expense (audit M4)', async () => {
    const day = businessDay();
    const made = (await api(app, b).post('/payroll/sheets', { periodStart: day, periodEnd: day }).expect(201)).body;
    const sheet = (await api(app, b).patch(`/payroll/lines/${made.lines[0].id}`, { days: 1 }).expect(200)).body;
    expect(Number(sheet.total)).toBeGreaterThan(0);
    const before = await prisma.expense.count({ where: { tenantId: b.tenantId, category: 'LABOUR' } });
    const answers = await Promise.all([1, 2, 3].map(() => api(app, b).post(`/payroll/sheets/${sheet.id}/pay`)));
    expect(answers.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await prisma.expense.count({ where: { tenantId: b.tenantId, category: 'LABOUR' } })).toBe(before + 1);
    expect(await prisma.auditLog.count({ where: { tenantId: b.tenantId, action: 'PAY_SHEET_PAID', entityId: sheet.id } })).toBe(1);
    const paid = (await api(app, b).get(`/payroll/sheets/${sheet.id}`).expect(200)).body;
    expect([paid.status, Number(paid.total)]).toEqual(['PAID', Number(sheet.total)]);
  });
});
