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
    expect(page.categories.find((c: any) => c.name === 'Jeans · A').gradedWhileSorting).toBe(true);

    const g = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: shirtsId }).expect(201)).body.session;
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g.id, gradeId: gradeB.id, amountKg: 30 }).expect(200);
    // Being graded: sorting cannot take the Shirts entry back.
    await api(app, a).post(`/sorting/stage-1/entries/${shirtsId}/remove`).expect(409);
    await api(app, a).post('/sorting/stage-1/unallocate', { sessionId: session.id, categoryId: shirts.id, amountKg: 40 }).expect(409);
    expect((await api(app, a).get(`/sorting/stage-2/outputs/${shirtsId}`).expect(200)).body).toMatchObject({ canGrade: true, gradeSession: { id: g.id, status: 'OPEN' } });
  });

  it('cycle: graded kg is ready to bale from its lot and its bales count; the lot page shows what was paid and the sorting and grading steps', async () => {
    const { lot, shirts, gradeA, waste } = await seedSortableLot(app, a.tenantId);
    await prisma.rag.update({ where: { id: lot.id }, data: { purchaseCost: 45000, ratePerKg: 450, charges: { create: [{ tenantId: a.tenantId, kind: 'TRANSPORT', amount: 5000, note: 'Truck' }] } } });
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session ?? (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body.session;
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, amountKg: 60 }).expect(200);
    const entry = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body.entries[0];
    const g = (await api(app, a).post('/sorting/stage-2/start', { categoryOutputId: entry.id }).expect(201)).body.session;
    await api(app, a).post('/sorting/stage-2/allocate', { sessionId: g.id, gradeId: gradeA.id, amountKg: 50 }).expect(200);
    await api(app, a).patch(`/sorting/stage-2/${g.id}/seal`, { wasteCategoryId: waste.id }).expect(200);

    let s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.ready.map((r: any) => [r.categoryName, r.gradeName, Number(r.availableKg)])).toEqual([['Shirts', 'A', 50]]);
    await api(app, a).post('/stock/bales', { categoryId: shirts.id, gradeId: gradeA.id, fromUngraded: false, ragId: lot.id, count: 2, weightKg: 20 }).expect(201);
    s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.ready.map((r: any) => Number(r.availableKg))).toEqual([10]);
    expect(s.bales).toBe(2);
    expect(s.madeBales.map((b: any) => [b.categoryName, b.gradeName, b.bales])).toEqual([['Shirts', 'A', 2]]);

    const page = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(page.categories.find((c: any) => c.name === 'Shirts')).toMatchObject({ gradedAs: [{ name: 'A', kg: '50' }], gradedWhileSorting: false });
    expect(page.purchase).toMatchObject({ price: '45000', ratePerKg: '450', charges: [{ kind: 'TRANSPORT', amount: '5000', note: 'Truck' }] });
    const activity = (await api(app, a).get(`/records/lot/${lot.id}/activity`).expect(200)).body.map((x: any) => x.action);
    expect(activity).toEqual(expect.arrayContaining(['SORT_SESSION_CREATED', 'GRADE_SESSION_CREATED', 'GRADE_SESSION_CLOSED']));
    expect(activity).not.toContain('SORT_OUTPUT_ADDED');
    await api(app, b).get(`/records/lot/${lot.id}/activity`).expect(404);
  });

  it('the business profile names its best grade (number 1 in the list), for "Cream %" / "A %" labels', async () => {
    await seedSortableLot(app, a.tenantId);
    expect((await api(app, a).get('/tenant').expect(200)).body.topGrade).toBe('A');
    await prisma.grade.create({ data: { tenantId: a.tenantId, name: 'Cream', rank: 0 } });
    expect((await api(app, a).get('/tenant').expect(200)).body.topGrade).toBe('Cream');
    // Another business keeps its own.
    expect((await api(app, b).get('/tenant').expect(200)).body.topGrade).not.toBe('Cream');
  });

  it('a lot bought by the piece is sorted in pieces: kg and cost are each entry\'s share of the pieces (owner, 2026-11-11)', async () => {
    const { jeans, shirts, waste } = await seedSortableLot(app, a.tenantId);
    // 500 bedsheets, 400 kg, at Rs 300 a piece = Rs 150,000.
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 400, pieces: 500, ratePerPiece: 300 }).expect(201)).body;
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session;
    let s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.lot).toMatchObject({ pieces: 500, costPerPiece: '300' });

    // Pieces are needed; kg alone or bales are refused for this lot; more pieces than are left too.
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, amountKg: 10 }).expect(400);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, bales: 1, baleWeightKg: 10 }).expect(400);
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, pieces: 501 }).expect(400);

    // 200 pieces = 160 kg and Rs 60,000; the last 300 pieces take the 240 kg left.
    s = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, pieces: 200 }).expect(200)).body;
    expect([s.entries[0].pieces, s.entries[0].kg, s.pieces]).toEqual([200, '160', 200]);
    const first = await prisma.categoryOutput.findFirstOrThrow({ where: { id: s.entries[0].id } });
    expect(Number(first.allocatedCost)).toBe(60000);
    expect(s.ready.find((r: any) => r.categoryId === jeans.id)).toMatchObject({ availableKg: '160', availablePieces: 200 });

    // A bale of 100 pieces (80 kg) from this lot; then 30 pieces of it are sold.
    const bale = (await api(app, a).post('/stock/bales', { categoryId: jeans.id, fromUngraded: true, ragId: lot.id, count: 1, weightKg: 80, pieces: 100 }).expect(201)).body;
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: bale.baleIds[0] } });
    expect([item.pcsCount, Number(item.weightKg), Number(item.totalCost)]).toEqual([100, 80, 30000]);
    s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.ready.find((r: any) => r.categoryId === jeans.id)).toMatchObject({ availableKg: '80', availablePieces: 100 });
    const buyer = await prisma.customer.create({ data: { tenantId: a.tenantId, name: 'Piece Buyer', phone: '+923001112299' } });
    const sale = (await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'PIECE', quantity: 30, unitPrice: 400 }] }).expect(201)).body;
    expect(Number(sale.totalAmount)).toBe(12000);
    expect(Number(sale.totalCost)).toBe(9000);
    const listed = (await api(app, a).get(`/lists/stock?f=status:ne:SOLD&q=${bale.unitCode ?? ''}`).expect(200)).body.rows.find((r: any) => r.id === item.id);
    expect(listed.pieces).toBe(70);
    await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'PIECE', quantity: 71, unitPrice: 400 }] }).expect(409);
    await api(app, b).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'PIECE', quantity: 1, unitPrice: 400 }] }).expect((r) => expect([400, 404]).toContain(r.status));
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, pieces: 301 }).expect(400);
    s = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, pieces: 300 }).expect(200)).body;
    expect([s.entries[0].kg, s.pieces, s.today.pieces]).toEqual(['240', 500, 500]);

    // Closed: nothing left over; the whole cost is shared, 60,000 and 90,000.
    await api(app, a).patch(`/sorting/stage-1/${session.id}/seal`, { wasteCategoryId: waste.id }).expect(200);
    const outs = await prisma.categoryOutput.findMany({ where: { ragId: lot.id }, orderBy: { createdAt: 'asc' } });
    expect(outs.map((o) => [o.count, Number(o.weightKg), Number(o.allocatedCost)])).toEqual([[200, 160, 60000], [300, 240, 90000]]);
    // Another business cannot sort it.
    await api(app, b).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, pieces: 1 }).expect((r) => expect([400, 403, 404, 409]).toContain(r.status));
  });

  it('a lot bought by the piece without a weight: counted in pieces, baled by pieces (weighed or not), leftover pieces as waste (owner, 2026-11-12)', async () => {
    const { jeans, shirts, waste } = await seedSortableLot(app, a.tenantId);
    // No weight without pieces; a weightless lot needs pieces.
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', purchaseCost: 1000 }).expect(400);
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', pieces: 500, ratePerPiece: 300 }).expect(201)).body;
    expect([Number(lot.weightKg), lot.pieces, Number(lot.allocatedCost)]).toEqual([0, 500, 150000]);
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session;

    let s = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, pieces: 200 }).expect(200)).body;
    expect([s.entries[0].kg, s.entries[0].pieces]).toEqual(['0', 200]);
    expect(Number((await prisma.categoryOutput.findFirstOrThrow({ where: { id: s.entries[0].id } })).allocatedCost)).toBe(60000);
    expect(s.ready.find((r: any) => r.categoryId === jeans.id)).toMatchObject({ availableKg: '0', availablePieces: 200 });

    // A bale by kg alone cannot take pieces that have no weight; by pieces it can, weighed or not.
    await api(app, a).post('/stock/bales', { categoryId: jeans.id, fromUngraded: true, ragId: lot.id, count: 1, weightKg: 40 }).expect(400);
    const plain = (await api(app, a).post('/stock/bales', { categoryId: jeans.id, fromUngraded: true, ragId: lot.id, count: 1, pieces: 100 }).expect(201)).body;
    const weighed = (await api(app, a).post('/stock/bales', { categoryId: jeans.id, fromUngraded: true, ragId: lot.id, count: 1, pieces: 50, weightKg: 45 }).expect(201)).body;
    await api(app, a).post('/stock/bales', { categoryId: jeans.id, fromUngraded: true, ragId: lot.id, count: 1, pieces: 51 }).expect(400);
    const plainItem = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: plain.baleIds[0] } });
    const weighedItem = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: weighed.baleIds[0] } });
    expect([plainItem.weightKg, plainItem.pcsCount, Number(plainItem.totalCost)]).toEqual([null, 100, 30000]);
    expect([Number(weighedItem.weightKg), weighedItem.pcsCount, Number(weighedItem.totalCost)]).toEqual([45, 50, 15000]);
    s = (await api(app, a).get(`/sorting/stage-1/summary?ragId=${lot.id}`).expect(200)).body;
    expect(s.ready.find((r: any) => r.categoryId === jeans.id)).toMatchObject({ availablePieces: 50 });
    // Pieces already in a bale cannot be taken back.
    await api(app, a).post(`/sorting/stage-1/entries/${s.entries[0].id}/remove`).expect(409);

    // 250 Shirts; closing leaves 50 pieces as waste in stock, and the cost is shared over the 450 sorted.
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: shirts.id, pieces: 250 }).expect(200);
    await api(app, a).patch(`/sorting/stage-1/${session.id}/seal`, { wasteCategoryId: waste.id }).expect(200);
    const outs = await prisma.categoryOutput.findMany({ where: { ragId: lot.id }, orderBy: { createdAt: 'asc' } });
    expect(outs.map((o) => [o.count, Number(o.allocatedCost)])).toEqual([[200, 66666.67], [250, 83333.33]]);
    const kat = await prisma.inventoryItem.findFirstOrThrow({ where: { ragId: lot.id, source: 'KAT' } });
    expect([kat.unit, Number(kat.quantity), kat.weightKg]).toEqual(['PIECE', 50, null]);
    // The bales follow the new cost: 100 and 50 of the 200 Jeans pieces.
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: plainItem.id } })).totalCost)).toBe(33333.34);
    const page = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(page.totals).toMatchObject({ sortedPieces: 450, piecesLeft: 50, yieldPercent: 90 });

    // Pieces of the unweighed bale sell by the piece.
    const buyer = await prisma.customer.create({ data: { tenantId: a.tenantId, name: 'Weightless Buyer', phone: '+923001112398' } });
    await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: plainItem.id, unit: 'PIECE', quantity: 10, unitPrice: 500 }] }).expect(201);
    await api(app, b).get(`/workspace/sorting/${lot.id}`).expect(404);
  });
});
