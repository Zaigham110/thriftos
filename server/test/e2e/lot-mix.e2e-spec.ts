import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

const D = (v: string | number) => new Prisma.Decimal(v);

/**
 * Mixing lots for sorting (owner, 2026-11-17: "received two containers or loose lots and mix those for workers
 * to sort"). The mix is sorted as one lot; what it gives and sells for is shared back to each lot, container and
 * supplier by weight, and each lot keeps its own cost.
 */
describe('Mixing lots for sorting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let jeansId: string;
  let gradeId: string;
  let looseId: string;
  let containerId: string;
  let containerLotId: string;
  let mixId: string;
  let vendor1: string;
  let vendor2: string;
  let wasteId: string;
  let sessionId: string;
  let baleIds: string[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'CONTAINERS'])] } });
    const seeded = await seedSortableLot(app, a.tenantId);
    // The fixture's own lot is not part of this story.
    await prisma.rag.delete({ where: { id: seeded.lot.id } });
    jeansId = seeded.jeans.id;
    gradeId = seeded.gradeA.id;
    wasteId = seeded.waste.id;
    vendor1 = (await api(app, a).post('/procurement/vendors', { name: 'Loose Supplier', originCountry: 'Pakistan' }).expect(201)).body.id;
    vendor2 = (await api(app, a).post('/procurement/vendors', { name: 'Container Supplier', originCountry: 'USA' }).expect(201)).body.id;
    // A loose lot: 60 kg for 6,000. A container with one lot: 40 kg for 8,000 (dearer per kg).
    looseId = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 60, purchaseCost: 6000, vendorId: vendor1 }).expect(201)).body.id;
    const container = (await api(app, a).post('/procurement/containers', { vendorId: vendor2, netWeightKg: 40, purchaseCost: 8000, withLot: true }).expect(201)).body;
    containerId = container.id;
    containerLotId = container.rags[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('two lots become one mix: weight and cost add up, the lots are closed for sorting, the queue shows the mix', async () => {
    await api(app, a).post('/sorting/stage-1/mix', { ragIds: [looseId] }).expect(400);
    const mix = (await api(app, a).post('/sorting/stage-1/mix', { ragIds: [looseId, containerLotId] }).expect(201)).body;
    mixId = mix.id;
    expect(mix.code).toMatch(/^MIX-\d{4}-001$/);
    expect([mix.kg, mix.cost, mix.status]).toEqual(['100', '14000', 'NOT_STARTED']);
    expect(mix.sources.map((s: any) => [s.id, s.supplier, s.kg, s.cost, s.sharePercent])).toEqual([
      [looseId, 'Loose Supplier', '60', '6000', 60],
      [containerLotId, 'Container Supplier', '40', '8000', 40],
    ]);
    expect((await prisma.rag.findMany({ where: { id: { in: [looseId, containerLotId] } }, select: { status: true } })).map((r) => r.status)).toEqual(['MIXED', 'MIXED']);

    // Only the mix waits to be sorted; a lot inside it cannot be sorted or mixed again.
    const queue = (await api(app, a).get('/sorting/stage-1/queue').expect(200)).body.data.map((r: any) => r.id);
    expect(queue).toEqual([mixId]);
    await api(app, a).post('/sorting/stage-1/start', { ragId: looseId }).expect(409);
    expect((await api(app, a).post('/sorting/stage-1/mix', { ragIds: [looseId, containerLotId] }).expect(409)).body.code).toBe('NOT_WAITING');
    // Each lot's page says where it went, and the mix's page what it was made from.
    expect((await api(app, a).get(`/workspace/sorting/${looseId}`).expect(200)).body.lot.mixedInto).toMatchObject({ id: mixId, sharePercent: 60 });
    expect((await api(app, a).get(`/workspace/sorting/${mixId}`).expect(200)).body.lot.mixedFrom).toHaveLength(2);
    // Another business can neither see nor undo it, nor mix these lots.
    await api(app, b).get(`/sorting/stage-1/mix/${mixId}`).expect(404);
    await api(app, b).post(`/sorting/stage-1/mix/${mixId}/undo`, {}).expect(404);
    await api(app, b).post('/sorting/stage-1/mix', { ragIds: [looseId, containerLotId] }).expect(404);
  });

  it('a charge added to a lot after mixing goes into the mix', async () => {
    await api(app, a).post(`/procurement/containers/${containerId}/charges`, { chargeType: 'FREIGHT', amount: 1000 }).expect(201);
    const mix = (await api(app, a).get(`/sorting/stage-1/mix/${mixId}`).expect(200)).body;
    expect([mix.cost, mix.sources[1].cost]).toEqual(['15000', '9000']);
  });

  it('the mix is sorted and sold as one lot; each lot, container and supplier gets its share by weight, at its own cost', async () => {
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: mixId }).expect(201)).body.session;
    const made = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeansId, gradeId, bales: 2, baleWeightKg: 50 }).expect(200)).body;
    sessionId = session.id;
    baleIds = made.baleIds;
    // Sorting has started: the mix stays together.
    expect((await api(app, a).post(`/sorting/stage-1/mix/${mixId}/undo`, {}).expect(409)).body.code).toBe('SORTING_STARTED');
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: made.baleIds[0] } });
    // A bale of the mix costs half of 15,000.
    expect(item.totalCost.toString()).toBe('7500');
    const buyer = (await api(app, a).post('/customers', { name: 'Mix Buyer', phone: '+923001240001' }).expect(201)).body;
    await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 10000 }] }).expect(201);

    const tr = (await api(app, a).get('/workspace/finance/trading?months=1').expect(200)).body;
    // The mix is not a purchase: only the two real lots are listed and counted as bought.
    expect(tr.stock.bought).toBe('15000');
    expect(tr.byLot.map((l: any) => l.kind).sort()).toEqual(['CONTAINER', 'LOT']);
    const loose = tr.byLot.find((l: any) => l.id === looseId);
    const cont = tr.byLot.find((l: any) => l.id === containerId);
    // Sold for 10,000: 60% and 40% by weight. Cost of what sold (7,500): 6,000/15,000 and 9,000/15,000 of it.
    expect([loose.revenue, loose.costSold, loose.profit]).toEqual(['6000', '3000', '3000']);
    expect([cont.revenue, cont.costSold, cont.profit]).toEqual(['4000', '4500', '-500']);
    // The parts add up to the sale.
    expect(D(loose.revenue).add(cont.revenue).toString()).toBe('10000');
    expect(D(loose.profit).add(cont.profit).toString()).toBe('2500');
    const supplier = (id: string) => tr.bySupplier.find((s: any) => s.id === id);
    expect([supplier(vendor1).revenue, supplier(vendor1).profit, supplier(vendor2).revenue, supplier(vendor2).profit]).toEqual(['6000', '3000', '4000', '-500']);
    // The monthly lines are untouched by the sharing: one sale, its real cost.
    const p = (await api(app, a).get('/workspace/finance/pnl?months=1').expect(200)).body.totals;
    expect([p.revenue, p.cost, p.grossProfit, p.bought]).toEqual(['10000', '7500', '2500', '15000']);
  });

  it('yield, each lot\'s and container\'s page and export bale records show the mix under the lots it came from', async () => {
    await api(app, a).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: wasteId }).expect(200);
    // Yield by supplier: each supplier's share of the mix by weight.
    const y = (await api(app, a).get('/workspace/sorting/yield?by=supplier').expect(200)).body;
    const row = (k: string) => y.rows.find((r: any) => r.key === k);
    expect([row('Loose Supplier').inputKg, row('Loose Supplier').outputKg, row('Loose Supplier').lots]).toEqual(['60', '60', 1]);
    expect([row('Container Supplier').inputKg, row('Container Supplier').outputKg]).toEqual(['40', '40']);
    // By month the mix is one lot, sorted once.
    expect((await api(app, a).get('/workspace/sorting/yield?by=month').expect(200)).body.rows[0]).toMatchObject({ lots: 1, inputKg: '100' });

    // The loose lot's page lists the mix's bales with its share: 30 of each 50 kg, 40% of the cost (6,000 of 15,000).
    const lot = (await api(app, a).get(`/workspace/sorting/${looseId}`).expect(200)).body;
    expect(lot.bales.map((b: any) => [b.kg, b.cost])).toEqual([['30', '3000'], ['30', '3000']]);
    // The container's page: the bales at its share of the cost, and the sale at its share by weight.
    const cont = (await api(app, a).get(`/workspace/containers/${containerId}`).expect(200)).body;
    expect(cont.bales.map((b: any) => b.costFromHere)).toEqual(['4500', '4500']);
    expect(cont.sales.map((x: any) => [x.revenue, x.profit])).toEqual([['4000', '-500']]);

    // An export sale of the other bale: its record names both lots, inside the mix, with their kg.
    const row2 = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...new Set([...row2.enabledModules, 'EXPORT'])] } });
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: baleIds[1] } });
    const buyer = (await api(app, a).post('/customers', { name: 'Export Buyer', phone: '+971501110001' }).expect(201)).body;
    const sale = (await api(app, a).post('/sales', { customerId: buyer.id, type: 'EXPORT', paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 9000 }] }).expect(201)).body;
    const pack = (await api(app, a).get(`/sales/${sale.id}/export-pack`).expect(200)).body;
    const lots = await prisma.rag.findMany({ where: { id: { in: [looseId, containerLotId] } }, select: { id: true, ragCode: true } });
    const code = (id: string) => lots.find((l) => l.id === id)!.ragCode;
    expect(pack.records[0].from.map((f: any) => [f.lot, f.supplier, f.amount, !!f.mix])).toEqual([
      [code(looseId), 'Loose Supplier', '30', true],
      [code(containerLotId), 'Container Supplier', '20', true],
    ]);
  });

  it('a mix nobody has started sorting can be taken apart; lots without a weight and mixes cannot be mixed', async () => {
    const one = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 30, purchaseCost: 3000 }).expect(201)).body.id;
    const two = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 20, purchaseCost: 1000 }).expect(201)).body.id;
    const mix = (await api(app, a).post('/sorting/stage-1/mix', { ragIds: [one, two] }).expect(201)).body;
    // A mix is not mixed again: take it apart and mix all the lots.
    const three = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 500 }).expect(201)).body.id;
    expect((await api(app, a).post('/sorting/stage-1/mix', { ragIds: [mix.id, three] }).expect(400)).body.code).toBe('ALREADY_A_MIX');
    await api(app, a).post(`/sorting/stage-1/mix/${mix.id}/undo`, {}).expect(200);
    expect(await prisma.rag.findUnique({ where: { id: mix.id } })).toBeNull();
    expect((await prisma.rag.findMany({ where: { id: { in: [one, two] } }, select: { status: true } })).map((r) => r.status)).toEqual(['NOT_STARTED', 'NOT_STARTED']);
    expect(await prisma.lotMixSource.count({ where: { sourceRagId: { in: [one, two] } } })).toBe(0);
    // A lot counted only in pieces has no weight to share by.
    const noWeight = await prisma.rag.create({ data: { tenantId: a.tenantId, ragCode: 'LOT-PCS-1', ragBaleType: 'BALE', weightKg: 0, pieces: 100, allocatedCost: 1000, sourceType: 'LOOSE_BALE' } });
    expect((await api(app, a).post('/sorting/stage-1/mix', { ragIds: [one, noWeight.id] }).expect(400)).body.code).toBe('NEEDS_WEIGHT');
    expect((await prisma.rag.findUniqueOrThrow({ where: { id: one } })).status).toBe('NOT_STARTED');
  });
});
