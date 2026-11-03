import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, seedSortableLot, TestTenant } from './fixtures';

/**
 * Enterprise plan E3.2: the lots list / board (waiting, sorting, sorted) with yield per lot, a lot's sorting
 * record (categories, grades, waste, cost) and yield analysis by supplier, origin, raw type, container, month.
 */
describe('Workspace sorting: lots board, sorting record, yield analysis (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const m = await seedSortableLot(app, a.tenantId);
    const raw = m.lot.rawCategoryId!;

    async function lot(supplier: string, country: string, number: string) {
      const v = (await api(app, a).post('/procurement/vendors', { name: supplier, originCountry: country }).expect(201)).body;
      const c = (await api(app, a).post('/procurement/containers', { vendorId: v.id, containerNumber: number, netWeightKg: 1000, purchaseCost: 100000 }).expect(201)).body;
      const l = (await api(app, a).post('/procurement/rags', { containerId: c.id, ragBaleType: 'BALE', rawCategoryId: raw, weightKg: 1000 }).expect(201)).body;
      await prisma.rag.update({ where: { id: l.id }, data: { originCountry: country } });
      return l.id as string;
    }
    async function sort(ragId: string, cats: [string, number][]) {
      const s = (await api(app, a).post('/sorting/stage-1/start', { ragId }).expect(201)).body.session.id;
      for (const [cat, kg] of cats) await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: cat, amountKg: kg }).expect(200);
      await api(app, a).patch(`/sorting/stage-1/${s}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
    }

    // USA supplier: 1,000 kg → Jeans 600 + Shirts 300 (90 %), Jeans graded A 400 / B 200.
    ids.usa = await lot('Global Textile Recyclers', 'USA', 'MSKU-301');
    await sort(ids.usa, [[m.jeans.id, 600], [m.shirts.id, 300]]);
    const jeans = await prisma.categoryOutput.findFirstOrThrow({ where: { tenantId: a.tenantId, ragId: ids.usa, categoryId: m.jeans.id } });
    const g = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: jeans.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g, gradeId: m.gradeA.id, amountKg: 400 }).expect(200);
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g, gradeId: m.gradeB.id, amountKg: 200 }).expect(200);
    await api(app, a).patch(`/sorting/stage-2/${g}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
    // Canada supplier: 1,000 kg → Jeans 700 (70 %).
    ids.canada = await lot('Atlantic Rags', 'Canada', 'TGHU-302');
    await sort(ids.canada, [[m.jeans.id, 700]]);
    // Waiting to be sorted.
    ids.waiting = await lot('EuroCloth', 'Germany', 'CMAU-303');
  });

  afterAll(async () => {
    await app.close();
  });

  it('lots list: status for the board, sorted kg, waste and yield per lot', async () => {
    const all = (await api(app, a).get('/lists/lots?sort=code:asc').expect(200)).body;
    const row = (id: string) => all.rows.find((r: { id: string }) => r.id === id);
    expect(row(ids.usa)).toMatchObject({ status: 'SORTED', sortedKg: '900', wasteKg: '100', yield: 90, supplier: 'Global Textile Recyclers', container: 'MSKU-301' });
    expect(row(ids.canada)).toMatchObject({ status: 'SORTED', yield: 70 });
    expect(row(ids.waiting)).toMatchObject({ status: 'NOT_STARTED', sortedKg: null, yield: null });
    const waiting = (await api(app, a).get('/lists/lots?f=status:eq:NOT_STARTED').expect(200)).body;
    expect(waiting.rows.map((r: { id: string }) => r.id)).toContain(ids.waiting);
    expect(waiting.rows.map((r: { id: string }) => r.id)).not.toContain(ids.usa);
    const grouped = (await api(app, a).get('/lists/lots?groupBy=status').expect(200)).body;
    expect(grouped.groups).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'SORTED', count: expect.any(Number) })]));
  });

  it('sorting record: categories with cost and share, grades, waste by stage, yield and A grade', async () => {
    const r = (await api(app, a).get(`/workspace/sorting/${ids.usa}`).expect(200)).body;
    expect(r.lot).toMatchObject({ code: expect.any(String), kg: '1000', status: 'SORTED', cost: '100000', costPerKg: '100', container: { number: 'MSKU-301' } });
    expect(r.session).toMatchObject({ status: 'CLOSED', inputKg: '1000', outputKg: '900', wasteKg: '100' });
    expect(r.categories).toEqual([
      expect.objectContaining({ name: 'Jeans', kg: '600', sharePercent: 67, gradedKg: '600', grading: expect.objectContaining({ status: 'CLOSED' }) }),
      expect.objectContaining({ name: 'Shirts', kg: '300', sharePercent: 33, gradedKg: '0', grading: null }),
    ]);
    expect(r.grades).toEqual([expect.objectContaining({ name: 'A', kg: '400', sharePercent: 67 }), expect.objectContaining({ name: 'B', kg: '200', sharePercent: 33 })]);
    expect(r.totals).toMatchObject({ sortedKg: '900', stage1WasteKg: '100', yieldPercent: 90, topGradePercent: 67 });
    const waiting = (await api(app, a).get(`/workspace/sorting/${ids.waiting}`).expect(200)).body;
    expect(waiting).toMatchObject({ session: null, categories: [], totals: { yieldPercent: null } });
  });

  it('yield analysis by supplier and month, with category and grade mix', async () => {
    const y = (await api(app, a).get('/workspace/sorting/yield?by=supplier').expect(200)).body;
    expect(y.totals).toMatchObject({ lots: 2, inputKg: '2000', outputKg: '1600', wasteKg: '400', yieldPercent: 80 });
    expect(y.rows.map((r: { key: string; yieldPercent: number }) => [r.key, r.yieldPercent])).toEqual([['Global Textile Recyclers', 90], ['Atlantic Rags', 70]]);
    expect(y.rows[0]).toMatchObject({ topGradePercent: 67 });
    expect(y.categories).toEqual([expect.objectContaining({ name: 'Jeans', kg: '1300', sharePercent: 81 }), expect.objectContaining({ name: 'Shirts', kg: '300', sharePercent: 19 })]);
    expect(y.grades.map((g: { name: string }) => g.name)).toEqual(['A', 'B']);
    const byOrigin = (await api(app, a).get('/workspace/sorting/yield?by=origin').expect(200)).body;
    expect(byOrigin.rows.map((r: { key: string }) => r.key).sort()).toEqual(['Canada', 'USA']);
    expect((await api(app, a).get('/workspace/sorting/yield?by=month').expect(200)).body.rows).toHaveLength(1);
    await api(app, a).get('/workspace/sorting/yield?by=colour').expect(400);
    // Nothing finished in a past period.
    expect((await api(app, a).get('/workspace/sorting/yield?from=2020-01-01&to=2020-01-31').expect(200)).body.totals.lots).toBe(0);
  });

  it('cost needs cost.view; the area needs sorting permission; another business sees nothing', async () => {
    const viewer = await createUserWithoutPermissions(app, a.tenantId);
    const role = await prisma.role.create({ data: { tenantId: a.tenantId, name: `Sort viewer ${Date.now()}` } });
    const perm = await prisma.permission.findFirstOrThrow({ where: { code: 'SORTING_STAGE1_VIEW' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    await prisma.userRole.create({ data: { userId: viewer.userId, roleId: role.id } });
    const r = (await api(app, viewer).get(`/workspace/sorting/${ids.usa}`).expect(200)).body;
    expect(r.lot.cost).toBeNull();
    expect(r.categories[0].cost).toBeNull();
    expect((await api(app, viewer).get('/lists/lots').expect(200)).body.rows[0]).not.toHaveProperty('cost');

    const nobody = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, nobody).get(`/workspace/sorting/${ids.usa}`).expect(403);
    await api(app, nobody).get('/workspace/sorting/yield').expect(403);

    await api(app, b).get(`/workspace/sorting/${ids.usa}`).expect(404);
    expect((await api(app, b).get('/workspace/sorting/yield').expect(200)).body.totals.lots).toBe(0);
    expect((await api(app, b).get('/lists/lots').expect(200)).body.rows).toEqual([]);
  });
});
