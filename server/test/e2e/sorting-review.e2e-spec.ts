import { INestApplication } from '@nestjs/common';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * v2 review, Sorting: a lot being sorted shows what is left to sort (not "waste"), one row per category,
 * its bales, and new lots are numbered LOT-… so they are not mistaken for bales.
 */
describe('Sorting review: left to sort, one row per category, bales of a lot, LOT codes (e2e)', () => {
  let app: INestApplication;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('half sorted: left to sort on the list and the lot; two Jeans entries are one row; closed: waste and bales', async () => {
    const m = await seedSortableLot(app, a.tenantId);
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 20000, rawCategoryId: m.lot.rawCategoryId }).expect(201)).body;
    expect(lot.ragCode).toMatch(/^LOT-/);

    const s = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session.id;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: m.jeans.id, amountKg: 30 }).expect(200);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: s, categoryId: m.jeans.id, amountKg: 20 }).expect(200);

    const list = (await api(app, a).get(`/lists/lots?q=${lot.ragCode}`).expect(200)).body;
    expect(list.rows[0]).toMatchObject({ code: lot.ragCode, status: 'IN_SORTING', sortedKg: '50', leftKg: '50', wasteKg: null });
    expect(list.totals).toMatchObject({ kg: '100', sortedKg: '50', leftKg: '50', wasteKg: '0' });

    let page = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(page.categories).toHaveLength(1);
    expect(page.categories[0]).toMatchObject({ name: 'Jeans', kg: '50' });
    expect(page.totals).toMatchObject({ leftKg: '50', progressPercent: 50 });

    // Close: 50 kg is waste now; a 40 kg Jeans bale made from the sorted kg shows on the lot.
    await api(app, a).patch(`/sorting/stage-1/${s}/seal`, { wasteCategoryId: m.waste.id }).expect(200);
    const closed = (await api(app, a).get(`/lists/lots?q=${lot.ragCode}`).expect(200)).body.rows[0];
    expect(closed).toMatchObject({ status: 'SORTED', wasteKg: '50', leftKg: null });
    await api(app, a).post('/stock/bales', { categoryId: m.jeans.id, weightKg: 40 }).expect(201);
    page = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(page.totals.leftKg).toBe('0');
    expect(page.bales).toEqual([expect.objectContaining({ category: 'Jeans', kg: '40', sold: false })]);

    // Another business sees none of it.
    await api(app, b).get(`/workspace/sorting/${lot.id}`).expect(404);
    expect((await api(app, b).get(`/lists/lots?q=${lot.ragCode}`).expect(200)).body.rows).toHaveLength(0);
  });
});
