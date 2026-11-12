import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { STAFF_PERMISSIONS } from '../../src/users/staff';
import { api, createTenantWithOwner, createTestApp, createUserWith, TestTenant } from './fixtures';

/**
 * Audit 2026-11, H1 and H2: sales, customers, the khata, receivables, the sales list and search are for people
 * who sell, take payments or keep the books. A Sorter or Buyer reads and changes none of it; a Salesman works
 * with it but never sees what a sale cost or earned; a credit limit needs the books.
 */
describe('Who may open sales, customers and the khata (audit H1/H2) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestTenant;
  let sorter: TestTenant;
  let buyer: TestTenant;
  let salesman: TestTenant;
  let cashier: TestTenant;
  let customerId: string;
  let saleId: string;
  let paymentId: string;
  let promiseId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    owner = await createTenantWithOwner(app);
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: owner.tenantId }, data: { enabledModules: [...new Set([...t.enabledModules, 'KHATA', 'EXPORT'])] } });
    sorter = await createUserWith(app, owner.tenantId, STAFF_PERMISSIONS.Sorter);
    buyer = await createUserWith(app, owner.tenantId, STAFF_PERMISSIONS.Buyer);
    salesman = await createUserWith(app, owner.tenantId, STAFF_PERMISSIONS.Salesman);
    cashier = await createUserWith(app, owner.tenantId, STAFF_PERMISSIONS.Cashier);

    customerId = (await api(app, owner).post('/customers', { name: 'Hidden Traders', phone: '0300 5550101', city: 'Lahore' }).expect(201)).body.id;
    const item = await prisma.inventoryItem.create({ data: { tenantId: owner.tenantId, source: 'PURCHASED', name: 'Loose jeans', unit: 'KG', quantity: 100, totalCost: 10000, unitCost: 100, avgCost: 100, weightKg: 100, status: 'AVAILABLE' } });
    const sale = (await api(app, owner).post('/sales', { customerId, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, quantity: 10, unitPrice: 250 }] }).expect(201)).body;
    saleId = sale.id;
    expect([sale.totalCost, sale.totalProfit, sale.lines[0].lineCost]).toEqual(['1000', '1500', '1000']);
    paymentId = (await api(app, owner).post('/khata/payments', { customerId, amount: 500, method: 'CASH' }).expect(201)).body.id;
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    promiseId = (await api(app, owner).post(`/workspace/customers/${customerId}/promises`, { amount: 500, promisedFor: day }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const reads = () => [
    '/sales', `/sales/${saleId}`, `/sales/${saleId}/whatsapp`, `/sales/${saleId}/print`, `/sales/${saleId}/export-pack`,
    `/sales/last-price?customerId=${customerId}`, '/sales/scan/qr/NOPE',
    '/customers', `/customers/${customerId}`,
    '/khata', `/khata/customers/${customerId}`, `/khata/customers/${customerId}/reminder`, `/khata/payments/${paymentId}/receipt`, `/khata/payments/${paymentId}/photo`,
    '/workspace/receivables', `/workspace/customers/${customerId}`, `/workspace/customers/${customerId}/statement`,
    '/lists/sales', '/lists/sales/export?format=csv',
  ];

  it.each([['Sorter', () => sorter], ['Buyer', () => buyer]])('a %s reads none of it', async (_name, who) => {
    for (const url of reads()) {
      const res = await api(app, who()).get(url);
      expect([url, res.status]).toEqual([url, 403]);
    }
    const found = (await api(app, who()).get('/search/global?q=Hidden').expect(200)).body;
    expect(found.filter((r: { group: string }) => ['customers', 'sales', 'payments'].includes(r.group))).toEqual([]);
  });

  it.each([['Sorter', () => sorter], ['Buyer', () => buyer]])('a %s changes none of it', async (_name, who) => {
    const u = api(app, who());
    await u.post('/customers', { name: 'Sneaky', phone: '0300 5550102' }).expect(403);
    await u.patch(`/customers/${customerId}`, { city: 'Karachi' }).expect(403);
    await u.delete(`/customers/${customerId}`).expect(403);
    await u.post(`/sales/${saleId}/fulfill`, {}).expect(403);
    await u.patch(`/sales/${saleId}/shipment`, { makeExport: true }).expect(403);
    await u.post('/khata/payments', { customerId, amount: 1, method: 'CASH' }).expect(403);
    await u.post(`/khata/payments/${paymentId}/photo`).expect(403);
    await u.post(`/workspace/customers/${customerId}/promises`, { amount: 1, promisedFor: '2099-01-01' }).expect(403);
    await u.post(`/workspace/promises/${promiseId}/cancel`).expect(403);
    await u.post(`/workspace/customers/${customerId}/remind`, {}).expect(403);
    await u.patch(`/workspace/customers/${customerId}/credit-limit`, { creditLimit: 9_999_999 }).expect(403);
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect([c.city, c.creditLimit?.toString()]).toEqual(['Lahore', '0']);
    expect(await prisma.customer.count({ where: { tenantId: owner.tenantId } })).toBe(1);
  });

  it('a Salesman works with sales and customers, without what a sale cost or earned', async () => {
    const u = api(app, salesman);
    const list = (await u.get('/sales').expect(200)).body;
    expect(list).toHaveLength(1);
    expect([list[0].totalAmount, list[0].totalCost, list[0].totalProfit]).toEqual(['2500', null, null]);
    const one = (await u.get(`/sales/${saleId}`).expect(200)).body;
    expect([one.totalCost, one.totalProfit, one.lines[0].lineCost, one.lines[0].profit, one.lines[0].lineTotal]).toEqual([null, null, null, null, '2500']);
    const page = (await u.get('/lists/sales').expect(200)).body;
    expect(page.rows[0]).not.toHaveProperty('profit');
    await u.get('/customers').expect(200);
    await u.get('/khata').expect(200);
    await u.get('/workspace/receivables').expect(200);
    expect((await u.get('/search/global?q=Hidden').expect(200)).body.map((r: { group: string }) => r.group)).toEqual(expect.arrayContaining(['customers', 'sales']));

    // A new sale answers without cost too; the scanned or picked item as well.
    const item = await prisma.inventoryItem.create({ data: { tenantId: owner.tenantId, source: 'PURCHASED', name: 'Loose shirts', unit: 'KG', quantity: 50, totalCost: 5000, unitCost: 100, avgCost: 100, weightKg: 50, status: 'AVAILABLE' } });
    const made = (await u.post('/sales', { customerId, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, quantity: 5, unitPrice: 300 }] }).expect(201)).body;
    expect([made.totalAmount, made.totalCost, made.totalProfit, made.lines[0].lineCost]).toEqual(['1500', null, null, null]);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: made.id } })).totalCost.toString()).toBe('500');

    // Customers and promises are his work; a credit limit is not.
    const added = (await u.post('/customers', { name: 'Walk-in Ali', phone: '0300 5550103' }).expect(201)).body;
    await u.patch(`/customers/${added.id}`, { city: 'Multan' }).expect(200);
    await u.post(`/workspace/customers/${customerId}/remind`, {}).expect(200);
    await u.patch(`/workspace/customers/${customerId}/credit-limit`, { creditLimit: 9_999_999 }).expect(403);
    await u.delete(`/customers/${added.id}`).expect(200);
  });

  it('a Cashier reads the khata and takes payments; the owner sees cost and sets the credit limit', async () => {
    const u = api(app, cashier);
    await u.get('/khata').expect(200);
    await u.get(`/khata/customers/${customerId}`).expect(200);
    expect((await u.get(`/sales/${saleId}`).expect(200)).body.totalProfit).toBeNull();
    await u.post('/khata/payments', { customerId, amount: 100, method: 'CASH' }).expect(201);
    await u.patch(`/workspace/customers/${customerId}/credit-limit`, { creditLimit: 50000 }).expect(200);
    await u.post('/sales', { customerId, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [] }).expect(403);

    expect((await api(app, owner).get(`/sales/${saleId}`).expect(200)).body).toMatchObject({ totalCost: '1000', totalProfit: '1500' });
    expect((await api(app, owner).get('/search/global?q=Hidden').expect(200)).body.length).toBeGreaterThan(0);
  });
  it('a record\'s history, notes and files follow the record: a Sorter gets none of a sale\'s, but adds a receipt to an expense', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const upload = (who: TestTenant, type: string, id: string) =>
      request(app.getHttpServer()).post(`/api/records/${type}/${id}/attachments`).set('Authorization', `Bearer ${who.token}`).attach('file', png, { filename: 'bill.png', contentType: 'image/png' });
    await api(app, owner).post(`/records/sale/${saleId}/notes`, { text: 'He pays on Friday' }).expect(201);
    const file = (await upload(owner, 'sale', saleId).expect(201)).body;

    for (const [type, id] of [['sale', saleId], ['customer', customerId], ['payment', paymentId]]) {
      await api(app, sorter).get(`/records/${type}/${id}/activity`).expect(403);
      await api(app, sorter).post(`/records/${type}/${id}/notes`, { text: 'hello' }).expect(403);
      await upload(sorter, type, id).expect(403);
    }
    await api(app, sorter).get(`/records/attachments/${file.id}`).expect(403);
    expect(await prisma.recordNote.count({ where: { tenantId: owner.tenantId } })).toBe(1);

    // The people who work with sales read and add as before.
    expect((await api(app, salesman).get(`/records/sale/${saleId}/activity`).expect(200)).body.length).toBeGreaterThan(0);
    await api(app, salesman).get(`/records/attachments/${file.id}`).expect(200);
    await api(app, cashier).post(`/records/sale/${saleId}/notes`, { text: 'Paid part' }).expect(201);

    // An expense: whoever records it adds its receipt, but its history is for people who see the books.
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: owner.tenantId }, data: { enabledModules: [...new Set([...t.enabledModules, 'EXPENSES'])] } });
    const expense = (await api(app, sorter).post('/workspace/expenses', { category: 'TEA_FOOD', amount: 200 }).expect(201)).body;
    await upload(sorter, 'expense', expense.id).expect(201);
    await api(app, sorter).get(`/records/expense/${expense.id}/activity`).expect(403);
    await api(app, cashier).get(`/records/expense/${expense.id}/activity`).expect(200);
    // Stock and lots stay open to the floor.
    await api(app, sorter).get('/records/lot/none/activity').expect(404);
    await api(app, salesman).get('/records/lot/none/activity').expect(403);
  });
});
