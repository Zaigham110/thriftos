import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** v2 review, loose lot form: bought on its own day, with what is inside and from whom; fixed later while not sorted. */
describe('Loose lot form: date, raw type, supplier and editing (e2e)', () => {
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

  const rawType = async (t: TestTenant, name: string) =>
    (await api(app, t).post('/tenant/raw-categories', { name: `${name} ${Date.now()}`, rawType: 'BOTH' }).expect(201)).body.id as string;

  it('saves a loose lot on an earlier day with its raw type and supplier; edits them; another business cannot', async () => {
    const shershah = await api(app, a).post('/procurement/vendors', { name: 'Shershah Gaari Wala', originCountry: 'Pakistan' }).expect(201);
    const jeans = await rawType(a, 'Jeans mix');
    const r = await api(app, a)
      .post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 800, purchaseCost: 160000, vendorId: shershah.body.id, rawCategoryId: jeans, receivedAt: '2026-11-01' })
      .expect(201);
    let lot = await prisma.rag.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(lot).toMatchObject({ sourceType: 'LOOSE_BALE', vendorId: shershah.body.id, rawCategoryId: jeans, originCountry: 'Pakistan' });
    expect(lot.createdAt.toISOString().slice(0, 10)).toBe('2026-11-01');
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 1, receivedAt: '2099-01-01' }).expect(400);

    // Fix it: other supplier, other day, kg and price.
    const other = await api(app, a).post('/procurement/vendors', { name: 'Lahore Mix Traders' }).expect(201);
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { vendorId: other.body.id, receivedAt: '2026-11-02', weightKg: 1000, purchaseCost: 150000 }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect(lot.vendorId).toBe(other.body.id);
    expect(lot.createdAt.toISOString().slice(0, 10)).toBe('2026-11-02');
    expect(Number(lot.weightKg)).toBe(1000);
    expect(Number(lot.allocatedCost)).toBe(150000);

    // Another business: not its lot, not its supplier.
    await api(app, b).patch(`/procurement/rags/${lot.id}`, { weightKg: 1 }).expect(404);
    const theirs = await api(app, b).post('/procurement/vendors', { name: 'Theirs' }).expect(201);
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { vendorId: theirs.body.id }).expect(400);

    // A container lot keeps the container's supplier and date.
    const c = await api(app, a).post('/procurement/containers', { vendorId: shershah.body.id, netWeightKg: 500, purchaseCost: 5000, withLot: true }).expect(201);
    await api(app, a).patch(`/procurement/rags/${c.body.rags[0].id}`, { vendorId: other.body.id }).expect(400);
  });

  it('rate per kg and extra charges (transport, labour): the price is kg × rate and the lot costs price + charges (owner, 2026-11-11)', async () => {
    // 800 kg at Rs 210/kg = Rs 168,000, with transport 6,000 and labour 2,500.
    const r = await api(app, a)
      .post('/procurement/rags', {
        ragBaleType: 'BALE', weightKg: 800, ratePerKg: 210,
        charges: [{ kind: 'TRANSPORT', amount: 6000, note: 'Rickshaw from Shershah' }, { kind: 'LABOUR', amount: 2500 }],
      })
      .expect(201);
    expect(r.body.charges.map((c: any) => [c.kind, Number(c.amount)])).toEqual([['TRANSPORT', 6000], ['LABOUR', 2500]]);
    let lot = await prisma.rag.findUniqueOrThrow({ where: { id: r.body.id } });
    expect([Number(lot.ratePerKg), Number(lot.purchaseCost), Number(lot.allocatedCost)]).toEqual([210, 168000, 176500]);
    expect((await api(app, a).get(`/procurement/rags/${lot.id}`).expect(200)).body.charges).toHaveLength(2);

    // Change the charges (the whole list): transport only, 4,000.
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { charges: [{ kind: 'TRANSPORT', amount: 4000 }] }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(lot.allocatedCost)).toBe(172000);
    expect(await prisma.lotCharge.count({ where: { ragId: lot.id } })).toBe(1);

    // A new rate re-prices it; typing a total instead forgets the rate.
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { ratePerKg: 200 }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect([Number(lot.purchaseCost), Number(lot.allocatedCost)]).toEqual([160000, 164000]);
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { purchaseCost: 150000 }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect([lot.ratePerKg, Number(lot.allocatedCost)]).toEqual([null, 154000]);

    // Wrong kinds and amounts are refused; a container lot takes charges on the container; another business cannot.
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 100, charges: [{ kind: 'TEA', amount: 5 }] }).expect(400);
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 100, charges: [{ kind: 'LABOUR', amount: 0 }] }).expect(400);
    const v = await api(app, a).post('/procurement/vendors', { name: 'Charge Vendor' }).expect(201);
    const c = await api(app, a).post('/procurement/containers', { vendorId: v.body.id, netWeightKg: 500, purchaseCost: 5000, withLot: true }).expect(201);
    await api(app, a).patch(`/procurement/rags/${c.body.rags[0].id}`, { charges: [{ kind: 'LABOUR', amount: 100 }] }).expect(400);
    await api(app, b).patch(`/procurement/rags/${lot.id}`, { charges: [] }).expect(404);
    expect(await prisma.lotCharge.count({ where: { tenantId: b.tenantId } })).toBe(0);

    // The cost check agrees (price + charges = lot cost) for this business.
    const rows = (await prisma.$queryRawUnsafe<{ tenantId: string }[]>(fs.readFileSync(path.resolve(__dirname, '../../../prisma/checks/cost-chain-check.sql'), 'utf8'))).filter((x) => x.tenantId === a.tenantId);
    expect(rows).toEqual([]);
  });

  it('bought by the piece (bedsheets): the price is pieces × rate per piece; one way of pricing at a time (owner, 2026-11-11)', async () => {
    // 500 bedsheets at Rs 300 each = Rs 150,000, weighing 400 kg, with transport 5,000.
    const r = await api(app, a)
      .post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 400, pieces: 500, ratePerPiece: 300, charges: [{ kind: 'TRANSPORT', amount: 5000 }] })
      .expect(201);
    let lot = await prisma.rag.findUniqueOrThrow({ where: { id: r.body.id } });
    expect([lot.pieces, Number(lot.ratePerPiece), Number(lot.purchaseCost), Number(lot.allocatedCost), lot.ratePerKg]).toEqual([500, 300, 150000, 155000, null]);
    const page = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(page.purchase).toMatchObject({ pieces: 500, ratePerPiece: '300', price: '150000', total: '155000' });

    // More pieces at the same rate re-price it; a new rate too.
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { pieces: 520 }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect([Number(lot.purchaseCost), Number(lot.allocatedCost)]).toEqual([156000, 161000]);
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { ratePerPiece: 250 }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(lot.purchaseCost)).toBe(130000);
    // Switching to a rate per kg forgets the rate per piece (the pieces stay as information).
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { ratePerKg: 300 }).expect(200);
    lot = await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } });
    expect([Number(lot.purchaseCost), lot.ratePerPiece, lot.pieces]).toEqual([120000, null, 520]);

    // A rate per piece needs pieces; not both rates; a container lot cannot; another business cannot.
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, ratePerPiece: 300 }).expect(400);
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, pieces: 5, ratePerPiece: 300, ratePerKg: 10 }).expect(400);
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, pieces: 0, ratePerPiece: 300 }).expect(400);
    const v = await api(app, a).post('/procurement/vendors', { name: 'Piece Vendor' }).expect(201);
    const c = await api(app, a).post('/procurement/containers', { vendorId: v.body.id, netWeightKg: 500, purchaseCost: 5000, withLot: true }).expect(201);
    await api(app, a).patch(`/procurement/rags/${c.body.rags[0].id}`, { pieces: 10, ratePerPiece: 5 }).expect(400);
    await api(app, b).patch(`/procurement/rags/${lot.id}`, { pieces: 1 }).expect(404);
    await api(app, b).get(`/workspace/sorting/${lot.id}`).expect(404);
  });
});
