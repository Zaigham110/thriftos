import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/** v2 sorting review: the screen gets the lot's details and every entry; one entry can be taken back; a finished lot shows its result. */
describe('Sorting screen: lot details, entries, remove one, finished lot (e2e)', () => {
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

  it('lists entries newest first, removes one by id (and its bales), and shows a finished lot with its result', async () => {
    const { lot, jeans, shirts, gradeA, waste } = await seedSortableLot(app, a.tenantId);
    const vendor = await prisma.vendor.create({ data: { tenantId: a.tenantId, name: 'Shershah Gaari' } });
    await prisma.rag.update({ where: { id: lot.id }, data: { vendorId: vendor.id } });

    // Before sorting: the lot's details already come with the (empty) summary.
    const before = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(before.session).toBeNull();
    expect(before.lot).toMatchObject({ code: lot.ragCode, supplier: 'Shershah Gaari', rawType: 'Mixed', weightKg: '100', costPerKg: '500' });

    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session ?? (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body.session;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, amountKg: 30 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, gradeId: gradeA.id, bales: 2, baleWeightKg: 10 }).expect(200);
    let s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.lot.supplier).toBe('Shershah Gaari');
    expect(s.entries.map((e: any) => [e.categoryName, e.gradeName, Number(e.kg), e.bales, e.baleIds.length, e.removable])).toEqual([
      ['Shirts', 'A', 20, 2, 2, true],
      ['Jeans', null, 30, 0, 0, true],
    ]);

    // Another business cannot touch it; taking the bales entry back removes its bales from stock.
    const balesEntry = s.entries[0];
    await api(app, b).post(`/sorting/stage-1/entries/${balesEntry.id}/remove`).expect(404);
    s = (await api(app, a).post(`/sorting/stage-1/entries/${balesEntry.id}/remove`).expect(200)).body;
    expect(s.entries.map((e: any) => e.categoryName)).toEqual(['Jeans']);
    expect(Number(s.session.totalOutputWeight)).toBe(30);
    expect(await prisma.repackUnit.count({ where: { id: { in: balesEntry.baleIds } } })).toBe(0);

    // Closed: entries cannot change; opening the lot again returns its result, not an empty screen.
    await api(app, a).patch(`/sorting/stage-1/${session.id}/seal`, { wasteCategoryId: waste.id }).expect(200);
    s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.session.status).toBe('CLOSED');
    expect(s.outputs.map((o: any) => o.name)).toEqual(['Jeans']);
    expect(s.entries[0].removable).toBe(false);
    await api(app, a).post(`/sorting/stage-1/entries/${s.entries[0].id}/remove`).expect(409);
  });

  it('A grade % and the grade table count grades given while sorting (owner: "why is A grade 0?")', async () => {
    const { lot, jeans, shirts, gradeA, gradeB, waste } = await seedSortableLot(app, a.tenantId);
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session ?? (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body.session;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, amountKg: 50 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, gradeId: gradeA.id, amountKg: 10 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeB.id, amountKg: 20 }).expect(200);
    // Not graded: not part of the A grade share.
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, amountKg: 5 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${session.id}/seal`, { wasteCategoryId: waste.id }).expect(200);

    const r = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(r.totals.topGradePercent).toBe(75);
    expect(r.grades.map((g: any) => [g.name, g.kg, g.sharePercent])).toEqual([['A', '60', 75], ['B', '20', 25]]);
    // Another business sees nothing of it.
    await api(app, b).get(`/workspace/sorting/${lot.id}`).expect(404);
  });

  it('grading: an entry of a lot still being sorted can be graded; one that cannot says why; it cannot be taken back while graded', async () => {
    const { lot, jeans, shirts, gradeA, gradeB } = await seedSortableLot(app, a.tenantId);
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session ?? (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body.session;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, amountKg: 40 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, amountKg: 10 }).expect(200);
    const s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    const shirtsId = s.entries.find((e: any) => e.categoryName === 'Shirts').id;
    const jeansId = s.entries.find((e: any) => e.categoryName === 'Jeans').id;

    // The lot is still open: Shirts can be graded, Jeans · A was graded while sorting.
    expect((await api(app, a).get(`/sorting/stage-2/outputs/${shirtsId}`).expect(200)).body).toMatchObject({ category: { name: 'Shirts' }, weightKg: '40', canGrade: true, blocked: null, lot: { code: lot.ragCode } });
    expect((await api(app, a).get(`/sorting/stage-2/outputs/${jeansId}`).expect(200)).body).toMatchObject({ canGrade: false, blocked: 'GRADED_WHILE_SORTING' });
    await api(app, b).get(`/sorting/stage-2/outputs/${shirtsId}`).expect(404);
    // The lot page offers grading only for Shirts.
    const page = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(page.categories.map((c: any) => [c.name, c.gradeTarget])).toEqual(expect.arrayContaining([['Shirts', shirtsId], ['Jeans · A', null]]));

    const g = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: shirtsId }).expect(201)).body.session;
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g.id, gradeId: gradeB.id, amountKg: 30 }).expect(200);
    // Being graded: sorting cannot take the Shirts entry back.
    await api(app, a).post(`/sorting/stage-1/entries/${shirtsId}/remove`).expect(409);
    await api(app, a).post('/sorting/stage-1/unallocate', { sessionId: session.id, categoryId: shirts.id, amountKg: 40 }).expect(409);
    expect((await api(app, a).get(`/sorting/stage-2/outputs/${shirtsId}`).expect(200)).body).toMatchObject({ canGrade: true, gradeSession: { id: g.id, status: 'OPEN' } });
  });
});
