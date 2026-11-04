import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** v2 6.3: what a printed bill and a payment receipt carry; each business sees only its own. */
describe('Printing bills and receipts (e2e)', () => {
  let app: INestApplication;
  let a: TestTenant;
  let b: TestTenant;
  let sale: { id: string; saleNumber: string };
  let paymentId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { name: 'Al-Madina Traders' } });
    const stock = (await api(app, a).post('/stock/items', { name: 'Jeans A', unit: 'BALE', quantity: 10, totalCost: 250000 }).expect(201)).body;
    const customer = (await api(app, a).post('/customers', { name: 'Shafiq', phone: '0321 7654321', openingBalance: 10000 }).expect(201)).body;
    sale = (await api(app, a).post('/sales', { customerId: customer.id, paymentMode: 'PARTIAL', paidAmount: 20000, paymentMethod: 'CASH', lines: [{ inventoryItemId: stock.id, quantity: 2, unitPrice: 30000 }] }).expect(201)).body;
    paymentId = (await api(app, a).post('/khata/payments', { customerId: customer.id, amount: 15000, method: 'JAZZCASH', reference: 'TX99' }).expect(201)).body.payment.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('gives a printable bill with the balance now and the bill link', async () => {
    const res = await api(app, a).get(`/sales/${sale.id}/print`).expect(200);
    expect(res.body).toMatchObject({
      business: 'Al-Madina Traders',
      saleNumber: sale.saleNumber,
      customer: 'Shafiq',
      total: '60000',
      lines: [expect.objectContaining({ description: 'Jeans A', unit: 'BALE', quantity: '2', unitPrice: '30000', lineTotal: '60000' })],
      customerBalance: '35000', // 10,000 + 60,000 − 20,000 − 15,000
    });
    expect(res.body.billUrl).toMatch(/\/bill\/[A-Za-z0-9_-]{20,}$/);
    expect(res.body.billQrSvg).toMatch(/^<svg/);
  });

  it('gives a printable payment receipt', async () => {
    const res = await api(app, a).get(`/khata/payments/${paymentId}/receipt`).expect(200);
    expect(res.body).toMatchObject({
      business: 'Al-Madina Traders',
      customer: 'Shafiq',
      amount: '15000',
      method: 'JAZZCASH',
      reference: 'TX99',
      saleNumber: null,
      balance: '35000',
    });
    expect(res.body.receiptNo).toMatch(/^R-[A-Z0-9]{6}$/);
    expect(res.body.receivedBy).toBeTruthy();
  });

  it('does not show another business its bills or receipts', async () => {
    await api(app, b).get(`/sales/${sale.id}/print`).expect(404);
    await api(app, b).get(`/khata/payments/${paymentId}/receipt`).expect(404);
  });
});
