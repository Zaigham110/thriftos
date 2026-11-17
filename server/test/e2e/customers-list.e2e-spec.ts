import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWith, createUserWithoutPermissions, TestTenant } from './fixtures';

/**
 * Customers list (owner, 2026-11-17: "can't see Customer module"): everybody a business sells to, with their
 * bills, what they bought, their last sale and what they owe; only this business's customers, only for the
 * people who may see sales.
 */
describe('Customers list (e2e)', () => {
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

  it('lists every customer with bills, bought, last sale and balance', async () => {
    const credit = (await api(app, a).post('/customers', { name: 'Credit Buyer', phone: '+923001110001', city: 'Lahore', openingBalance: 1000 }).expect(201)).body;
    await api(app, a).post('/customers', { name: 'Never Bought', phone: '+923001110002', city: 'Karachi' }).expect(201);
    await api(app, b).post('/customers', { name: 'Other Business Buyer', phone: '+923001110003' }).expect(201);
    const item = await prisma.inventoryItem.create({ data: { tenantId: a.tenantId, source: 'PURCHASED', name: 'Loose', unit: 'KG', quantity: 100, totalCost: 1000, unitCost: 10, avgCost: 10, weightKg: 100, status: 'AVAILABLE' } });
    await api(app, a).post('/sales', { customerId: credit.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, quantity: 10, unitPrice: 50 }] }).expect(201);
    await api(app, a).post('/sales', { customerId: credit.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: item.id, quantity: 4, unitPrice: 50 }] }).expect(201);

    const list = (await api(app, a).get('/lists/customers').expect(200)).body;
    expect(list.rows.map((r: any) => r.name)).toEqual(['Credit Buyer', 'Never Bought']);
    const row = list.rows[0];
    // Two bills of 500 and 200; the cash one is paid, so what is owed is the old 1,000 and the credit bill.
    expect([row.bills, row.bought, row.balance, row.city, row.status]).toEqual([2, '700', '1500', 'Lahore', 'ACTIVE']);
    expect(row.lastSale).toBeTruthy();
    expect([list.rows[1].bills, list.rows[1].bought, list.rows[1].balance, list.rows[1].lastSale]).toEqual([0, '0', '0', null]);
    expect(list.totals).toMatchObject({ bought: '700', balance: '1500' });
    // Search and filter work on what is stored.
    expect((await api(app, a).get('/lists/customers?q=karachi').expect(200)).body.rows.map((r: any) => r.name)).toEqual(['Never Bought']);
  });

  it('another business sees only its own customers; only people who may see sales open the list', async () => {
    expect((await api(app, b).get('/lists/customers').expect(200)).body.rows.map((r: any) => r.name)).toEqual(['Other Business Buyer']);
    const plain = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, plain).get('/lists/customers').expect(403);
    const seller = await createUserWith(app, a.tenantId, ['sale.create']);
    await api(app, seller).get('/lists/customers').expect(200);
  });
});
