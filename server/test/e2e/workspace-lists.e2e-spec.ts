import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Workbook } from 'exceljs';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

/**
 * Enterprise plan E2: the list contract (paging, sort, filters, search, group-by, totals), exports, saved
 * views, record activity (history, notes, mentions, attachments), global search — all per business.
 */
describe('Workspace lists, views, activity and search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  const customers: Record<string, string> = {};

  /** Direct inserts (the sale flow itself is tested elsewhere): fast and exact. */
  async function addSales(t: TestTenant, rows: Array<{ n: string; customer: string; status: 'ISSUED' | 'PAID' | 'PARTIALLY_PAID'; mode: 'CASH' | 'CREDIT' | 'PARTIAL'; total: string; cost: string; at: string }>) {
    await prisma.sale.createMany({
      data: rows.map((r) => ({
        tenantId: t.tenantId, saleNumber: r.n, customerId: customers[r.customer], status: r.status, paymentMode: r.mode, billToken: randomUUID(),
        currencyCode: 'PKR', totalAmount: r.total, totalCost: r.cost, totalProfit: (Number(r.total) - Number(r.cost)).toFixed(2), createdBy: t.userId, createdAt: new Date(r.at),
      })),
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    for (const [key, name, city, t] of [['rafiq', 'Haji Rafiq & Sons', 'Karachi', a], ['ali', 'Ali Traders', 'Lahore', a], ['other', 'Other Business Buyer', 'Karachi', b]] as const) {
      customers[key] = (await prisma.customer.create({ data: { tenantId: t.tenantId, name, city, phone: `+92300${Math.floor(1000000 + Math.random() * 8999999)}`, currencyCode: 'PKR' } })).id;
    }
    await addSales(a, [
      { n: 'S-001', customer: 'rafiq', status: 'PAID', mode: 'CASH', total: '45000.00', cost: '30000.00', at: '2026-11-02T20:00:00Z' }, // 3 Nov 01:00 in Karachi
      { n: 'S-002', customer: 'rafiq', status: 'PARTIALLY_PAID', mode: 'PARTIAL', total: '41500.50', cost: '29000.00', at: '2026-11-03T10:00:00Z' },
      { n: 'S-003', customer: 'ali', status: 'ISSUED', mode: 'CREDIT', total: '61600.00', cost: '40100.00', at: '2026-11-01T10:00:00Z' },
      { n: 'S-004', customer: 'ali', status: 'PAID', mode: 'CASH', total: '28000.00', cost: '20000.00', at: '2026-10-15T10:00:00Z' },
    ]);
    await addSales(b, [{ n: 'S-001', customer: 'other', status: 'PAID', mode: 'CASH', total: '99999.00', cost: '1.00', at: '2026-11-03T10:00:00Z' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  const list = (t: TestTenant, qs: string) => api(app, t).get(`/lists/sales?${qs}`);

  it('pages and sorts newest first by default; totals cover every matching row; only this business', async () => {
    const res = await list(a, 'pageSize=2').expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.rows.map((r: { number: string }) => r.number)).toEqual(['S-002', 'S-001']);
    expect(res.body.totals).toEqual({ total: '176100.5', cost: '119100', profit: '57000.5', paid: '0', due: '176100.5' }); // sales made without payment rows
    const p2 = await list(a, 'pageSize=2&page=2').expect(200);
    expect(p2.body.rows.map((r: { number: string }) => r.number)).toEqual(['S-003', 'S-004']);
    const byCustomer = await list(a, 'sort=customer:asc,total:desc').expect(200);
    expect(byCustomer.body.rows.map((r: { number: string }) => r.number)).toEqual(['S-003', 'S-004', 'S-001', 'S-002']);
  });

  it('filters by every operator kind, searches, and reads dates as Karachi days', async () => {
    const nums = async (qs: string) => (await list(a, qs).expect(200)).body.rows.map((r: { number: string }) => r.number).sort();
    expect(await nums('f=status:in:PAID|PARTIALLY_PAID')).toEqual(['S-001', 'S-002', 'S-004']);
    expect(await nums('f=status:ne:PAID')).toEqual(['S-002', 'S-003']);
    expect(await nums('f=total:between:41500.50..61600')).toEqual(['S-001', 'S-002', 'S-003']);
    expect(await nums('f=total:between:41500.51..61599.99')).toEqual(['S-001']);
    expect(await nums('f=total:gt:45000')).toEqual(['S-003']);
    expect(await nums('f=customer:contains:RAFIQ')).toEqual(['S-001', 'S-002']);
    expect(await nums('f=city:eq:lahore')).toEqual(['S-003', 'S-004']);
    expect(await nums('f=date:eq:2026-11-03')).toEqual(['S-001', 'S-002']);
    expect(await nums('f=date:between:2026-11-01..2026-11-02')).toEqual(['S-003']);
    expect(await nums('f=date:lt:2026-11-01')).toEqual(['S-004']);
    expect(await nums('q=ali')).toEqual(['S-003', 'S-004']);
    expect(await nums('f=customerId:eq:' + customers['other'])).toEqual([]);
  });

  it('groups with counts and subtotals, with customer names as labels', async () => {
    const res = await list(a, 'groupBy=customerId').expect(200);
    const groups = Object.fromEntries(res.body.groups.map((g: { label: string; count: number; totals: { total: string } }) => [g.label, [g.count, g.totals.total]]));
    expect(groups).toEqual({ 'Haji Rafiq & Sons': [2, '86500.5'], 'Ali Traders': [2, '89600'] });
    const byStatus = await list(a, 'groupBy=status&f=paymentMode:eq:CASH').expect(200);
    expect(byStatus.body.groups).toEqual([{ key: 'PAID', label: 'PAID', count: 2, totals: { total: '73000', cost: '50000', profit: '23000' } }]);
  });

  it('refuses unknown fields and operators; hides cost and profit without cost.view', async () => {
    await list(a, 'sort=secret:asc').expect(400);
    await list(a, 'f=total:contains:5').expect(400);
    await list(a, 'groupBy=total').expect(400);
    await list(a, 'f=status:eq:GONE').expect(400);
    await api(app, a).get('/lists/nothing').expect(404);

    const plain = await createUserWithoutPermissions(app, a.tenantId);
    const res = await list(plain, '').expect(200);
    expect(res.body.rows[0]).not.toHaveProperty('cost');
    expect(res.body.rows[0]).not.toHaveProperty('profit');
    expect(res.body.totals).toEqual({ total: '176100.5', paid: '0', due: '176100.5' });
    expect(res.body.fields.map((f: { key: string }) => f.key)).not.toContain('profit');
    await list(plain, 'sort=profit:desc').expect(400);
    await list(plain, 'f=cost:gt:0').expect(400);
  });

  it('exports the filtered rows as CSV and Excel, with column names in the chosen language', async () => {
    const csv = await api(app, a).get('/lists/sales/export?format=csv&f=customer:contains:rafiq&sort=number:asc').expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/attachment; filename="thriftos-sales-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = csv.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Sale,Date,Customer,City,Status,Payment,Type,Total (Rs),Paid (Rs),Due (Rs),Cost (Rs),Profit (Rs),Entered by');
    expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual(['S-001', 'S-002']);
    expect(lines[1]).toContain(',2026-11-03 01:00,');
    expect(lines[2]).toContain(',41500.5,');

    const xlsx = await api(app, a).get('/lists/sales/export?format=xlsx&lang=ur&columns=number,total').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(xlsx.body as never);
    const sheet = wb.worksheets[0];
    expect(sheet.getRow(1).values).toEqual([undefined, 'بکری', 'کل (روپے)']);
    expect(sheet.rowCount).toBe(5);
    expect(typeof sheet.getRow(2).getCell(2).value).toBe('number');

    const other = await api(app, b).get('/lists/sales/export?format=csv').expect(200);
    expect(other.text).not.toContain('Haji Rafiq');
    expect(await prisma.auditLog.count({ where: { tenantId: a.tenantId, action: 'LIST_EXPORTED' } })).toBe(2);
    await api(app, a).get('/lists/sales/export?format=pdf').expect(400);
  });

  it('saved views belong to one person; one default per list', async () => {
    const state = { filters: ['status:eq:PAID'], sort: 'date:desc', columns: ['number', 'total'] };
    const v1 = (await api(app, a).post('/views', { resource: 'sales', name: 'Paid', state, isDefault: true }).expect(201)).body;
    const v2 = (await api(app, a).post('/views', { resource: 'sales', name: 'Udhaar', state: { filters: ['paymentMode:eq:CREDIT'] }, isDefault: true }).expect(201)).body;
    await api(app, a).post('/views', { resource: 'sales', name: 'Paid', state }).expect(409);
    await api(app, a).post('/views', { resource: 'nothing', name: 'X', state }).expect(400);
    await api(app, a).post('/views', { resource: 'sales', name: 'Big', state: { x: 'y'.repeat(9000) } }).expect(400);
    const mine = (await api(app, a).get('/views?resource=sales').expect(200)).body;
    expect(mine.map((v: { name: string; isDefault: boolean }) => [v.name, v.isDefault])).toEqual([['Udhaar', true], ['Paid', false]]);

    await api(app, a).patch(`/views/${v1.id}`, { isDefault: true, name: 'Paid sales' }).expect(200);
    const again = (await api(app, a).get('/views?resource=sales').expect(200)).body;
    expect(again.find((v: { id: string }) => v.id === v2.id).isDefault).toBe(false);

    const colleague = await createUserWithoutPermissions(app, a.tenantId);
    expect((await api(app, colleague).get('/views?resource=sales').expect(200)).body).toEqual([]);
    await api(app, colleague).patch(`/views/${v1.id}`, { name: 'Mine now' }).expect(404);
    await api(app, b).delete(`/views/${v1.id}`).expect(404);
    await api(app, a).delete(`/views/${v1.id}`).expect(204);
  });

  it('activity merges history, notes and attachments; mentions notify; other businesses see nothing', async () => {
    const sale = await prisma.sale.findFirstOrThrow({ where: { tenantId: a.tenantId, saleNumber: 'S-003' } });
    await prisma.auditLog.create({ data: { tenantId: a.tenantId, userId: a.userId, action: 'SALE_CREATED', entityType: 'Sale', entityId: sale.id, createdAt: new Date('2026-11-01T10:00:00Z') } });
    const colleague = await createUserWithoutPermissions(app, a.tenantId);
    const outsider = await createUserWithoutPermissions(app, b.tenantId);

    await api(app, a).post(`/records/sale/${sale.id}/notes`, { text: 'Ali promised to pay on Friday', mentions: [colleague.userId] }).expect(201);
    await api(app, a).post(`/records/sale/${sale.id}/notes`, { text: 'x', mentions: [outsider.userId] }).expect(400);
    await api(app, a).post(`/records/sale/${sale.id}/notes`, { text: '   ' }).expect(400);

    const pdf = Buffer.from('%PDF-1.4\n% test\n');
    const up = await request(app.getHttpServer()).post(`/api/records/sale/${sale.id}/attachments`).set('Authorization', `Bearer ${a.token}`).attach('file', pdf, { filename: 'transfer slip.pdf', contentType: 'application/pdf' }).expect(201);
    await request(app.getHttpServer()).post(`/api/records/sale/${sale.id}/attachments`).set('Authorization', `Bearer ${a.token}`).attach('file', Buffer.from('MZ'), { filename: 'x.exe', contentType: 'application/x-msdownload' }).expect(400);

    const activity = (await api(app, a).get(`/records/sale/${sale.id}/activity`).expect(200)).body;
    expect(activity.map((i: { kind: string }) => i.kind)).toEqual(['attachment', 'note', 'change']);
    expect(activity[2]).toMatchObject({ action: 'SALE_CREATED', who: 'Owner' });
    expect(activity[0].attachment).toMatchObject({ fileName: 'transfer slip.pdf', contentType: 'application/pdf', size: pdf.length });
    const file = await api(app, a).get(`/records/attachments/${up.body.id}`).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');

    const inbox = (await api(app, colleague).get('/notifications?unread=1').expect(200)).body;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ kind: 'mention', link: `/sell/records/${sale.id}`, body: 'Ali promised to pay on Friday' });
    expect(inbox[0].title).toContain('S-003');
    await api(app, a).post(`/notifications/${inbox[0].id}/read`).expect(404);
    await api(app, colleague).post(`/notifications/${inbox[0].id}/read`).expect(204);
    expect((await api(app, colleague).get('/notifications?unread=1').expect(200)).body).toEqual([]);

    await api(app, b).get(`/records/sale/${sale.id}/activity`).expect(404);
    await api(app, b).post(`/records/sale/${sale.id}/notes`, { text: 'hi' }).expect(404);
    await api(app, b).get(`/records/attachments/${up.body.id}`).expect(404);
    await api(app, a).get(`/records/planet/${sale.id}/activity`).expect(404);
    const people = (await api(app, a).get('/records/mentionable').expect(200)).body.map((u: { id: string }) => u.id);
    expect(people).toContain(colleague.userId);
    expect(people).not.toContain(outsider.userId);
  });

  it('global search finds sales, customers and stock of this business only, with v1 links', async () => {
    const res = (await api(app, a).get('/search/global?q=rafiq').expect(200)).body as Array<{ group: string; title: string; route: string }>;
    expect(res.find((r) => r.group === 'customers')).toMatchObject({ title: 'Haji Rafiq & Sons', route: `/khata/records/${customers['rafiq']}` });
    expect(res.filter((r) => r.group === 'sales').map((r) => r.title).sort()).toEqual(['S-001', 'S-002']);
    expect(res.every((r) => !r.route.startsWith('/app/'))).toBe(true);
    const theirs = (await api(app, b).get('/search/global?q=rafiq').expect(200)).body;
    expect(theirs).toEqual([]);
    expect((await api(app, a).get('/search/global?q=S-00').expect(200)).body.filter((r: { group: string }) => r.group === 'sales')).toHaveLength(4);
  });

  it('a page of a 10,000-sale list comes back in under a second', async () => {
    const big = await createTenantWithOwner(app);
    const cust = await prisma.customer.create({ data: { tenantId: big.tenantId, name: 'Bulk Buyer', city: 'Karachi', phone: '+923009999999', currencyCode: 'PKR' } });
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    for (let i = 0; i < 10; i++) {
      await prisma.sale.createMany({
        data: Array.from({ length: 1000 }, (_, j) => {
          const n = i * 1000 + j;
          return { tenantId: big.tenantId, saleNumber: `B-${String(n).padStart(5, '0')}`, customerId: cust.id, status: n % 3 ? 'PAID' : 'ISSUED', paymentMode: 'CASH', billToken: randomUUID(), currencyCode: 'PKR', totalAmount: String(1000 + (n % 97) * 10), totalCost: '500', totalProfit: String(500 + (n % 97) * 10), createdBy: big.userId, createdAt: new Date(start + n * 60_000) };
        }),
      });
    }
    await prisma.$executeRawUnsafe('ANALYZE "Sale"');
    await list(big, 'pageSize=50').expect(200); // warm-up (connection, query plan)
    for (const qs of ['pageSize=50', 'pageSize=50&page=150&sort=total:desc', 'pageSize=50&f=status:eq:ISSUED&f=date:between:2026-01-02..2026-01-05', 'groupBy=status']) {
      const t0 = Date.now();
      const res = await list(big, qs).expect(200);
      const ms = Date.now() - t0;
      expect(res.body.total).toBeGreaterThan(0);
      expect(ms).toBeLessThan(1000);
    }
    expect((await list(big, 'pageSize=1').expect(200)).body.total).toBe(10000);
    // Inserting the 10,000 rows takes ~4 s; only the page times above are the check.
  }, 30_000);
});
