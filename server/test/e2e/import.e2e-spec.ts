import { INestApplication } from '@nestjs/common';
import { Workbook } from 'exceljs';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

/** v2 6.1: a business's paper register comes in from Excel/CSV — preview with plain errors, confirm, never twice. */
describe('Import from register / Excel (e2e)', () => {
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

  async function xlsx(rows: Array<Array<string | number | null>>): Promise<Buffer> {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Sheet1');
    rows.forEach((r) => ws.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  const send = (t: TestTenant, url: string, file: Buffer, name: string) =>
    request(app.getHttpServer()).post(`/api/import/${url}`).set('Authorization', `Bearer ${t.token}`).attach('file', file, name);

  // A register as people really type it: Roman Urdu names, every phone format, blank rows, "Rs 1,25,000".
  const register = () =>
    xlsx([
      ['Party Name', 'Mobile', 'Shehar', 'Baqaya', 'Remarks'],
      ['Haji  Rafiq ', '0300-1234567', 'Lahore', 'Rs 1,25,000', 'old khata'],
      [null, null, null, null, null],
      ['Bilal Bhai', '92 321 7654321', 'Karachi', '1.5 lakh', null],
      ['Shakeel sahib', '3331112223', null, '5000 advance', null],
      ['Ustad Nazir', '021-111', null, '20000', null], // landline: not a WhatsApp number
      ['haji rafiq', '03001234567', null, '1000', null], // same name as row 2, other case
      ['Kamran', null, null, 'abc', null], // not an amount
      [null, '03005556667', null, '500', null], // no name
      ['Javed', '+92 345 0001112', 'Faisalabad', null, null],
    ]);

  it('previews every row with its problem in plain words, and saves nothing', async () => {
    const res = await send(a, 'customers/preview', await register(), 'register.xlsx').expect(201);
    expect(res.body.missingColumns).toEqual([]);
    expect(res.body.counts).toEqual({ new: 4, exists: 0, imported: 0, error: 4 });
    const byLine = Object.fromEntries(res.body.rows.map((r: { line: number }) => [r.line, r]));
    expect(byLine[2].values).toMatchObject({ name: 'Haji Rafiq', phone: '+923001234567', city: 'Lahore', openingBalance: '125000.00', notes: 'old khata' });
    expect(byLine[4].values).toMatchObject({ name: 'Bilal Bhai', phone: '+923217654321', openingBalance: '150000.00' });
    expect(byLine[5].values).toMatchObject({ phone: '+923331112223', openingBalance: '-5000.00' });
    expect(byLine[6].errors).toEqual(['Phone "021-111" is not a mobile number (e.g. 0300-1234567)']);
    expect(byLine[6].issues).toEqual([{ level: 'error', code: 'phoneBad', params: { value: '021-111' } }]); // for the app's Urdu text
    expect(byLine[8].issues).toEqual([{ level: 'error', code: 'notAmount', params: { field: 'openingBalance', value: 'abc' } }]);
    expect(byLine[7].errors[0]).toMatch(/^Same name as row 2/);
    expect(byLine[8].errors).toEqual(['Opening balance: "abc" is not an amount']);
    expect(byLine[9].errors).toEqual(['Name is empty']);
    expect(byLine[3]).toBeUndefined(); // blank row left out
    expect(await prisma.customer.count({ where: { tenantId: a.tenantId } })).toBe(0);
  });

  it('confirms the good rows; the same file again adds nothing', async () => {
    const first = await send(a, 'customers/commit', await register(), 'register.xlsx').expect(201);
    expect(first.body).toMatchObject({ added: 4, skippedErrors: 4, skippedImported: 0 });
    const rafiq = await prisma.customer.findFirstOrThrow({ where: { tenantId: a.tenantId, name: 'Haji Rafiq' } });
    expect(rafiq.openingBalance.toFixed(2)).toBe('125000.00');
    expect(rafiq.phone).toBe('+923001234567');

    const again = await send(a, 'customers/commit', await register(), 'register (1).xlsx').expect(201);
    expect(again.body).toMatchObject({ added: 0, skippedImported: 4 });
    expect(await prisma.customer.count({ where: { tenantId: a.tenantId } })).toBe(4);

    const preview = await send(a, 'customers/preview', await register(), 'register.xlsx').expect(201);
    expect(preview.body.counts).toMatchObject({ new: 0, imported: 4 });

    const audit = await prisma.auditLog.findFirst({ where: { tenantId: a.tenantId, action: 'DATA_IMPORTED' } });
    expect(audit?.userId).toBe(a.userId);
  });

  it('leaves customers added by hand as they are', async () => {
    await request(app.getHttpServer()).post('/api/customers').set('Authorization', `Bearer ${a.token}`).send({ name: 'Manual Khan', phone: '03009998887' }).expect(201);
    const csv = Buffer.from('﻿Name,Udhaar\r\nmanual khan,9000\r\n"Naya, Gahak",700\r\n', 'utf8');
    const res = await send(a, 'customers/commit', csv, 'more.csv').expect(201);
    expect(res.body).toMatchObject({ added: 1, skippedExisting: 1 });
    const manual = await prisma.customer.findFirstOrThrow({ where: { tenantId: a.tenantId, name: 'Manual Khan' } });
    expect(manual.openingBalance.toFixed(2)).toBe('0.00');
    expect(await prisma.customer.count({ where: { tenantId: a.tenantId, name: 'Naya, Gahak' } })).toBe(1);
  });

  it('imports opening stock with cost, matching categories and adding new suppliers once', async () => {
    const jeans = await prisma.category.create({ data: { tenantId: a.tenantId, name: 'Jeans' } });
    const file = await xlsx([
      ['مال', 'قسم', 'اکائی', 'تعداد', 'وزن', 'کل لاگت', 'قیمت فروخت', 'سپلائر'],
      ['Jeans A bale', 'jeans', 'گانٹھ', 12, 540, 'Rs 3,60,000', '36,000', 'Texas Recycling'],
      ['Loose tops', null, 'kg', '250.5', null, '1.25 lakh', null, 'texas recycling'],
      [null, 'Jackets', 'pcs', 40, null, null, null, null], // no cost
      ['Shirts', null, 'bale', '2.5', null, '1000', null, null], // half a bale
      ['Kids mix', 'Kids', 'bale', 3, null, null, null, null],
    ]);
    const preview = await send(a, 'stock/preview', file, 'stock.xlsx').expect(201);
    expect(preview.body.counts).toEqual({ new: 2, exists: 0, imported: 0, error: 3 });
    expect(preview.body.rows[2].errors).toEqual(['Total cost is empty (or fill "Cost per unit")']);
    expect(preview.body.rows[3].errors).toEqual(['Bales and pieces are counted in whole numbers']);
    expect(preview.body.rows[0].notes).toEqual(['New supplier "Texas Recycling" will be added.']);

    const res = await send(a, 'stock/commit', file, 'stock.xlsx').expect(201);
    expect(res.body).toMatchObject({ added: 2, newSuppliers: 1 });
    const items = await prisma.inventoryItem.findMany({ where: { tenantId: a.tenantId }, orderBy: { createdAt: 'asc' } });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: 'Jeans A bale', categoryId: jeans.id, unit: 'BALE', source: 'PURCHASED', status: 'AVAILABLE' });
    expect(items[0].quantity.toFixed(0)).toBe('12');
    expect(items[0].totalCost.toFixed(2)).toBe('360000.00');
    expect(items[0].salePrice?.toFixed(2)).toBe('36000.00');
    expect(items[0].avgCost?.toFixed(2)).toBe('666.67');
    expect(items[1].weightKg?.toFixed(2)).toBe('250.50');
    expect(items[1].totalCost.toFixed(2)).toBe('125000.00');
    expect(items[0].vendorId).toBe(items[1].vendorId);
    expect(await prisma.vendor.count({ where: { tenantId: a.tenantId } })).toBe(1);
    expect(await prisma.stockMovement.count({ where: { inventoryItemId: { in: items.map((i) => i.id) }, movementType: 'INTAKE' } })).toBe(2);

    const again = await send(a, 'stock/commit', file, 'stock.xlsx').expect(201);
    expect(again.body.added).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { tenantId: a.tenantId } })).toBe(2);
  });

  it('keeps an unknown category in the item name instead of losing it', async () => {
    const file = await xlsx([
      ['Item', 'Category', 'Grade', 'Unit', 'Quantity', 'Cost per unit'],
      ['Mixed', 'Sweaters', 'B', 'bale', 2, '15,000'],
    ]);
    const preview = await send(a, 'stock/preview', file, 'unknown.xlsx').expect(201);
    expect(preview.body.rows[0].values).toMatchObject({ item: 'Mixed Sweaters B', totalCost: '30000.00', categoryId: null });
    expect(preview.body.rows[0].notes).toHaveLength(2);
  });

  it('imports suppliers', async () => {
    const csv = Buffer.from('Supplier;Country;Contact;Phone\nGlobal Rags Ltd;UK;Mr Smith;+44 20 7946 0000\nSeoul Textiles;Korea;;\n', 'utf8');
    const res = await send(b, 'suppliers/commit', csv, 'suppliers.csv').expect(201);
    expect(res.body.added).toBe(2);
    const uk = await prisma.vendor.findFirstOrThrow({ where: { tenantId: b.tenantId, name: 'Global Rags Ltd' } });
    expect(uk).toMatchObject({ country: 'UK', originCountry: 'UK', contactPerson: 'Mr Smith', contactPhone: '+442079460000' });
  });

  it('keeps businesses apart: the same file in another business imports again there only', async () => {
    const res = await send(b, 'customers/commit', await register(), 'register.xlsx').expect(201);
    expect(res.body.added).toBe(4);
    expect(await prisma.customer.count({ where: { tenantId: b.tenantId } })).toBe(4);
    expect(await prisma.customer.count({ where: { tenantId: a.tenantId } })).toBe(6);
    expect(await prisma.inventoryItem.count({ where: { tenantId: b.tenantId } })).toBe(0);
  });

  it('says plainly what is wrong with the file itself', async () => {
    const noName = await send(a, 'customers/preview', Buffer.from('City,Phone\nLahore,0300\n'), 'x.csv').expect(201);
    expect(noName.body.missingColumns).toEqual([{ en: 'Name', ur: 'نام' }]);
    await send(a, 'customers/commit', Buffer.from('City,Phone\nLahore,0300\n'), 'x.csv').expect(400);
    const pdf = await send(a, 'customers/preview', Buffer.from('%PDF-1.4'), 'register.pdf').expect(400);
    expect(pdf.body.message).toBe('Use an Excel (.xlsx) or CSV file');
    const broken = await send(a, 'customers/preview', Buffer.from('not a zip'), 'register.xlsx').expect(400);
    expect(broken.body.message).toMatch(/could not be read/);
    await send(a, 'cars/preview', Buffer.from('a'), 'a.csv').expect(400);
  });

  it('gives a template with English and Urdu headers that imports as it is', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/import/customers/template')
      .set('Authorization', `Bearer ${a.token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-disposition']).toContain('thriftos-customers.xlsx');
    const wb = new Workbook();
    await wb.xlsx.load(res.body);
    const sheet = wb.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe('Name * / نام');
    expect(sheet.getRow(1).getCell(4).value).toBe('Opening balance / پرانا ادھار');
    expect(wb.worksheets[1].name).toBe('Help - مدد');
    sheet.addRow(['Template Test', '0301-2223334', 'Multan', '2,000']);
    const filled = Buffer.from(await wb.xlsx.writeBuffer());
    const preview = await send(b, 'customers/preview', filled, 'thriftos-customers.xlsx').expect(201);
    expect(preview.body.rows).toEqual([expect.objectContaining({ status: 'new', values: expect.objectContaining({ name: 'Template Test', openingBalance: '2000.00' }) })]);
  });

  it('is for the owner only', async () => {
    const munshi = await createUserWithoutPermissions(app, a.tenantId);
    await send(munshi, 'customers/preview', Buffer.from('Name\nX\n'), 'x.csv').expect(403);
    await request(app.getHttpServer()).get('/api/import/stock/template').set('Authorization', `Bearer ${munshi.token}`).expect(403);
  });
});
