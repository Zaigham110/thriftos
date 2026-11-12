import { INestApplication } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

/**
 * Phase 9.2 acceptance: an export shipment produces a packing list and per-bale records from existing data —
 * the bales sold, their kg and pieces, and where each came from (lot, container, supplier, origin), its grade,
 * when it was sorted and by whom. Only export sales, only with the EXPORT module, only this business.
 */
describe('Phase 9.2 export pack: shipment, packing list, commercial invoice, bale records (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    for (const t of [a, b]) {
      const row = await prisma.tenant.findUniqueOrThrow({ where: { id: t.tenantId }, select: { enabledModules: true } });
      await prisma.tenant.update({ where: { id: t.tenantId }, data: { enabledModules: [...row.enabledModules, 'EXPORT', 'CONTAINERS'] } });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('an export sale with its shipment gives the packing list, invoice and each bale\'s sorting record', async () => {
    const { jeans, gradeA } = await seedSortableLot(app, a.tenantId);
    const vendor = (await api(app, a).post('/procurement/vendors', { name: 'Texas Recyclers', originCountry: 'USA' }).expect(201)).body;
    const container = (await api(app, a).post('/procurement/containers', { vendorId: vendor.id, netWeightKg: 500, purchaseCost: 50000, withLot: true }).expect(201)).body;
    const lot = container.rags[0];
    const worker = await prisma.worker.create({ data: { tenantId: a.tenantId, name: 'Akram', payType: 'KG', rate: 10, createdBy: a.userId } });
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session;
    const made = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, bales: 2, baleWeightKg: 45, workerId: worker.id }).expect(200)).body;
    const items = await prisma.inventoryItem.findMany({ where: { repackUnitId: { in: made.baleIds } }, include: { repackUnit: { select: { unitCode: true } } } });
    const buyer = await prisma.customer.create({ data: { tenantId: a.tenantId, name: 'Dubai Traders LLC', phone: '+971501234567', city: 'Dubai' } });

    const shipment = { destinationCountry: 'UAE', portOfLoading: 'Karachi', portOfDischarge: 'Jebel Ali', vesselName: 'MSC Aurora', billOfLadingNumber: 'BL-7788', containerSealNumber: 'SEAL-55', freightForwarder: 'Speedy Freight' };
    const sale = (await api(app, a).post('/sales', {
      customerId: buyer.id, type: 'EXPORT', paymentMode: 'CASH', paymentMethod: 'CASH', shipment,
      lines: items.map((i) => ({ inventoryItemId: i.id, unit: 'BALE', quantity: 1, unitPrice: 30000 })),
    }).expect(201)).body;
    expect(sale).toMatchObject({ type: 'EXPORT', billOfLadingNumber: 'BL-7788', destinationCountry: 'UAE' });

    const pack = (await api(app, a).get(`/sales/${sale.id}/export-pack`).expect(200)).body;
    expect(pack.buyer).toMatchObject({ name: 'Dubai Traders LLC', city: 'Dubai' });
    expect(pack.shipment).toEqual(shipment);
    expect(pack.packing.map((p: any) => [p.code, p.item, p.unit, p.kg])).toEqual(items.map((i) => [i.repackUnit!.unitCode, 'Jeans · A', 'BALE', '45']));
    expect(pack.totals).toMatchObject({ lines: 2, bales: 2, kg: '90', amount: '60000' });
    expect(pack.records).toHaveLength(2);
    expect(pack.records[0].from[0]).toMatchObject({ lot: lot.ragCode, container: container.containerNumber, supplier: 'Texas Recyclers', origin: 'USA', category: 'Jeans', grade: 'A', sortedBy: 'Akram' });
    expect(pack.records[0].from[0].sortedAt).toBeTruthy();

    // The packing list as the bale list sheet: the sample's eleven columns; "Cost" is what the buyer pays, never our cost.
    const sheetOf = async (who: TestTenant, saleId: string, status = 200) => api(app, who).get(`/sales/${saleId}/export-pack/bale-list`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(status);
    const file = await sheetOf(a, sale.id);
    expect(file.headers['content-disposition']).toBe(`attachment; filename="bale-list-${sale.saleNumber}.xlsx"`);
    const wb = new Workbook();
    await wb.xlsx.load(file.body as never);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Bale list');
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(['Bale no', 'Item', 'Category', 'Grade', 'Brand', 'Weight kg', 'Pieces', 'Cost', 'Bale sale price', 'Piece price', 'Notes']);
    expect(ws.getRow(1).font?.bold).toBe(true);
    expect(ws.rowCount).toBe(3);
    expect((ws.getRow(2).values as unknown[]).slice(1, 9)).toEqual([items[0].repackUnit!.unitCode, 'Jeans · A', 'Jeans', 'A', null, 45, null, 30000].map((v) => v ?? undefined));
    expect([9, 10, 11].map((c) => ws.getRow(2).getCell(c).value)).toEqual([null, null, null]);
    await sheetOf(b, sale.id, 404);

    // The shipment can be filled in later.
    const after = (await api(app, a).patch(`/sales/${sale.id}/shipment`, { vesselName: 'MSC Bella', billOfLadingNumber: '' }).expect(200)).body;
    expect([after.vesselName, after.billOfLadingNumber]).toEqual(['MSC Bella', null]);

    // A local sale has no export pack or shipment; another business sees nothing.
    const local = (await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: (await prisma.inventoryItem.create({ data: { tenantId: a.tenantId, source: 'PURCHASED', name: 'Loose', unit: 'KG', quantity: 10, totalCost: 100, unitCost: 10, avgCost: 10, weightKg: 10, status: 'AVAILABLE' } })).id, quantity: 5, unitPrice: 20 }] }).expect(201)).body;
    await api(app, a).get(`/sales/${local.id}/export-pack`).expect(400);
    await api(app, a).patch(`/sales/${local.id}/shipment`, { vesselName: 'X' }).expect(400);
    await api(app, b).get(`/sales/${sale.id}/export-pack`).expect(404);
    await api(app, b).patch(`/sales/${sale.id}/shipment`, { vesselName: 'X' }).expect(404);

    // A local sale can be made an export sale afterwards, with its shipment; its stock then went out as export.
    await api(app, b).patch(`/sales/${local.id}/shipment`, { makeExport: true }).expect(404);
    const madeExport = (await api(app, a).patch(`/sales/${local.id}/shipment`, { makeExport: true, destinationCountry: 'Kenya', portOfDischarge: 'Mombasa' }).expect(200)).body;
    expect([madeExport.type, madeExport.destinationCountry, madeExport.portOfDischarge]).toEqual(['EXPORT', 'Kenya', 'Mombasa']);
    expect((await prisma.stockMovement.findMany({ where: { referenceId: local.id }, select: { movementType: true } })).map((m) => m.movementType)).toEqual(['EXPORT']);
    expect((await api(app, a).get(`/sales/${local.id}/export-pack`).expect(200)).body.shipment.destinationCountry).toBe('Kenya');
    expect(await prisma.auditLog.count({ where: { tenantId: a.tenantId, action: 'SALE_MADE_EXPORT', entityId: local.id } })).toBe(1);

    // Without the EXPORT module: no export pack.
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: row.enabledModules.filter((m) => m !== 'EXPORT') } });
    await api(app, a).get(`/sales/${sale.id}/export-pack`).expect(403);
    const other = (await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: (await prisma.inventoryItem.create({ data: { tenantId: a.tenantId, source: 'PURCHASED', name: 'Loose', unit: 'KG', quantity: 10, totalCost: 100, unitCost: 10, avgCost: 10, weightKg: 10, status: 'AVAILABLE' } })).id, quantity: 5, unitPrice: 20 }] }).expect(201)).body;
    await api(app, a).patch(`/sales/${other.id}/shipment`, { makeExport: true }).expect(403);
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: row.enabledModules } });
  });
});
