import { INestApplication } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../src/prisma/prisma.service';
import { kindCode, kindCodeOf } from '../../src/stock/bale-kind';
import { Prisma } from '@prisma/client';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * Shared bale codes (owner, 2026-11-16): bales of the same category, grade and weight/pieces carry one code and
 * are counted as a quantity in stock, on sales and on export sales. Each bale stays its own stock item, so its
 * cost and where it came from stay exact; selling a quantity takes the oldest bales first.
 */
describe('shared bale codes: one code per kind, sold and counted as a quantity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let kindId: string;
  let buyerId: string;
  const made: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'EXPORT', 'CONTAINERS'])] } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('the code rule: category, grade, kg and pieces; Latin letters only', () => {
    const d = (n: number) => new Prisma.Decimal(n);
    expect(kindCode('Jeans', '1', d(45), 0)).toBe('JEANS-1-45');
    expect(kindCode('T-Shirts (kids)', 'Cream', d(45.5), 0)).toBe('TSHIRTSKID-CREAM-45.5');
    expect(kindCode('Jeans', 'Grade A', d(45), 0)).toBe('JEANS-A-45');
    expect(kindCode('Jeans', null, d(0), 200)).toBe('JEANS-200P');
    expect(kindCode('Jeans', 'A', d(40), 200)).toBe('JEANS-A-40-200P');
    expect(kindCode('جینز', 'A', d(45), 0)).toBe('K-A-45');
    expect(kindCodeOf('KIND:ACME:JEANS-1-45')).toBe('JEANS-1-45');
    expect(kindCodeOf(' jeans-1-45 ')).toBe('JEANS-1-45');
  });

  it('bales of the same category, grade and weight share one code; another weight is another code', async () => {
    const { jeans, gradeA } = await seedSortableLot(app, a.tenantId);
    const vendor = (await api(app, a).post('/procurement/vendors', { name: 'Texas Recyclers', originCountry: 'USA' }).expect(201)).body;
    const container = (await api(app, a).post('/procurement/containers', { vendorId: vendor.id, netWeightKg: 500, purchaseCost: 50000, withLot: true }).expect(201)).body;
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: container.rags[0].id }).expect(201)).body.session;
    const same = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, bales: 3, baleWeightKg: 45 }).expect(200)).body;
    const other = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, bales: 1, baleWeightKg: 50 }).expect(200)).body;
    made.push(...same.baleIds, ...other.baleIds);

    const items = await prisma.inventoryItem.findMany({ where: { repackUnitId: { in: made } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { baleKind: true, repackUnit: { select: { unitCode: true } } } });
    expect(items.map((i) => i.baleKind!.code)).toEqual(['JEANS-A-45', 'JEANS-A-45', 'JEANS-A-45', 'JEANS-A-50']);
    expect(new Set(items.map((i) => i.baleKindId)).size).toBe(2);
    // Each bale keeps its own number behind the scenes.
    expect(new Set(items.map((i) => i.repackUnit!.unitCode)).size).toBe(4);
    kindId = items[0].baleKindId!;

    // Every sticker of a kind is the same: the shared code and a QR of it.
    const labels = (await api(app, a).get(`/stock/bales/labels?ids=${made.join(',')}`).expect(200)).body;
    expect(labels.map((l: any) => l.code)).toEqual(['JEANS-A-45', 'JEANS-A-45', 'JEANS-A-45', 'JEANS-A-50']);
    expect(new Set(labels.slice(0, 3).map((l: any) => l.qr)).size).toBe(1);
    expect(labels[0].qr).toMatch(/^KIND:.+:JEANS-A-45$/);

    // The stock list and Inventory by item read the shared code and count the bales.
    const list = (await api(app, a).get('/lists/stock?pageSize=50').expect(200)).body;
    expect(list.rows.filter((r: any) => r.code === 'JEANS-A-45')).toHaveLength(3);
    expect(list.rows.every((r: any) => r.kindId)).toBe(true);
    const byItem = (await api(app, a).get('/workspace/stock/by-item').expect(200)).body;
    expect(byItem.filter((r: any) => r.code).map((r: any) => [r.code, r.bales, r.baleKg])).toEqual([['JEANS-A-45', '3', '135'], ['JEANS-A-50', '1', '50']]);
  });

  it('a name that gives a code already taken ends in -2', async () => {
    const twin = await prisma.category.create({ data: { tenantId: a.tenantId, name: 'JEANS!' } });
    const grade = await prisma.grade.findFirstOrThrow({ where: { tenantId: a.tenantId, name: 'A' } });
    const { kindFor } = await import('../../src/stock/bale-kind');
    const kind = await kindFor(prisma, a.tenantId, { categoryId: twin.id, gradeId: grade.id, weightKg: new Prisma.Decimal(45), pieces: 0 });
    expect(kind.code).toBe('JEANS-A-45-2');
    // Asked again: the same kind, not a third code.
    expect((await kindFor(prisma, a.tenantId, { categoryId: twin.id, gradeId: grade.id, weightKg: new Prisma.Decimal(45), pieces: 0 })).id).toBe(kind.id);
  });

  it('a scan of the shared code (typed or its QR) finds the oldest bale and how many there are', async () => {
    const typed = (await api(app, a).get('/sales/scan/qr/jeans-a-45').expect(200)).body;
    const oldest = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: made[0] }, include: { repackUnit: { select: { unitCode: true } } } });
    expect([typed.id, typed.inStock, typed.baleKind.code]).toEqual([oldest.id, 3, 'JEANS-A-45']);
    const label = (await api(app, a).get(`/stock/bales/labels?ids=${made[0]}`).expect(200)).body[0];
    expect((await api(app, a).get(`/sales/scan/qr/${encodeURIComponent(label.qr)}`).expect(200)).body.id).toBe(oldest.id);
    // A sticker printed before shared codes still finds its bale.
    expect((await api(app, a).get(`/sales/scan/qr/${oldest.repackUnit!.unitCode}`).expect(200)).body.id).toBe(oldest.id);
    // Another business has no such code.
    await api(app, b).get('/sales/scan/qr/JEANS-A-45').expect(404);
    await api(app, b).get(`/sales/scan/qr/${encodeURIComponent(label.qr)}`).expect(404);
  });

  it('selling a quantity of a kind takes the oldest bales, one line each; the bill and export list read one row', async () => {
    const buyer = await prisma.customer.create({ data: { tenantId: a.tenantId, name: 'Dubai Traders LLC', phone: '+971501234567', city: 'Dubai' } });
    buyerId = buyer.id;
    // More than there are: nothing is sold.
    const short = await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ baleKindId: kindId, quantity: 4, unitPrice: 30000 }] }).expect(409);
    expect(short.body.message).toBe('Only 3 of JEANS-A-45 in stock');
    await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ baleKindId: kindId, quantity: 1.5, unitPrice: 30000 }] }).expect(400);
    // Another business cannot sell this kind.
    const theirs = await prisma.customer.create({ data: { tenantId: b.tenantId, name: 'Other', phone: '+923001112223' } });
    await api(app, b).post('/sales', { customerId: theirs.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ baleKindId: kindId, quantity: 1, unitPrice: 30000 }] }).expect(400);

    const sale = (await api(app, a).post('/sales', {
      customerId: buyer.id, type: 'EXPORT', paymentMode: 'CASH', paymentMethod: 'CASH', shipment: { destinationCountry: 'UAE' },
      lines: [{ baleKindId: kindId, quantity: 2, unitPrice: 30000 }],
    }).expect(201)).body;
    expect(sale.totalAmount).toBe('60000');
    const items = await prisma.inventoryItem.findMany({ where: { repackUnitId: { in: made.slice(0, 3) } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    // The two oldest went out, each on its own line with its own cost; the third is still in stock.
    expect(items.map((i) => i.status)).toEqual(['SOLD', 'SOLD', 'AVAILABLE']);
    expect(sale.lines.map((l: any) => [l.inventoryItemId, l.quantity, l.code])).toEqual(items.slice(0, 2).map((i) => [i.id, '1', 'JEANS-A-45']));
    expect(sale.lines.map((l: any) => l.lineCost)).toEqual(items.slice(0, 2).map((i) => i.totalCost.toString()));
    expect((await api(app, a).get('/sales/scan/qr/JEANS-A-45').expect(200)).body.inStock).toBe(1);

    // The bill: one row, quantity 2.
    const bill = (await api(app, a).get(`/sales/${sale.id}/print`).expect(200)).body;
    expect(bill.lines.map((l: any) => [l.description, l.quantity, l.lineTotal])).toEqual([['Jeans A · JEANS-A-45', '2', '60000']]);

    // The export packing list and the bale list sheet: one row with Qty; each bale's record stays behind it.
    const pack = (await api(app, a).get(`/sales/${sale.id}/export-pack`).expect(200)).body;
    expect(pack.packing.map((p: any) => [p.code, p.quantity, p.kg, p.total])).toEqual([['JEANS-A-45', '2', '90', '60000']]);
    expect(pack.totals).toMatchObject({ lines: 1, bales: 2, kg: '90', amount: '60000' });
    expect(pack.records.map((r: any) => r.code)).toEqual(['JEANS-A-45', 'JEANS-A-45']);
    expect(new Set(pack.records.map((r: any) => r.number)).size).toBe(2);
    const file = await api(app, a).get(`/sales/${sale.id}/export-pack/bale-list`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(file.body as never);
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(2);
    expect((ws.getRow(1).values as unknown[]).slice(1, 4)).toEqual(['Bale no', 'Qty', 'Item']);
    expect((ws.getRow(2).values as unknown[]).slice(1, 3)).toEqual(['JEANS-A-45', 2]);
  });

  it('a kind and one of its own bales on the same sale never take the same bale twice', async () => {
    const last = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: made[2] } });
    // One left of the kind, and it is named on its own line: the kind line has nothing to take.
    await api(app, a).post('/sales', { customerId: buyerId, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: last.id, quantity: 1, unitPrice: 30000 }, { baleKindId: kindId, quantity: 1, unitPrice: 30000 }] }).expect(409);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: last.id } })).status).toBe('AVAILABLE');
  });
});
