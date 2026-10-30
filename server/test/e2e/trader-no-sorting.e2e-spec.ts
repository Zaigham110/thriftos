import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTestApp, login, TestTenant } from './fixtures';

/**
 * Phase 2 acceptance: a trader who does not sort (sortingStages = 0, no SORT module) can buy
 * ready stock, sell on credit, take a payment and see the right balance, with no sorting step.
 */
describe('Trader without sorting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const superAdmin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
    const code = `TR${randomUUID().slice(0, 6)}`.toUpperCase();
    const email = `trader-${code.toLowerCase()}@test.local`;
    await api(app, superAdmin)
      .post('/superadmin/tenants', { name: 'Gul Traders', companyCode: code, adminEmail: email, adminName: 'Gul', adminPassword: 'trader-pass-1' })
      .expect(201);
    owner = await login(app, email, 'trader-pass-1');
    await api(app, owner)
      .patch('/tenant/settings', { sortingStages: 0, enabledModules: ['RECEIVE', 'STOCK', 'SELL', 'KHATA'] })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('buys ready stock, sells on udhaar, takes a payment and shows the right balance', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: owner.tenantId } });
    expect(tenant).toMatchObject({ sortingStages: 0, enabledModules: ['RECEIVE', 'STOCK', 'SELL', 'KHATA'] });

    // Maal aya: 10 bales of A-grade jeans for Rs 3,00,000 and 250 kg of mixed tops for Rs 75,000.
    const jeans = (await api(app, owner).post('/stock/items', { name: 'Jeans A grade', unit: 'BALE', quantity: 10, totalCost: 300000 }).expect(201)).body;
    const tops = (await api(app, owner).post('/stock/items', { name: 'Mixed tops', unit: 'KG', quantity: 250, totalCost: 75000 }).expect(201)).body;

    // A customer from the old register who already owes Rs 15,000.
    const customer = (await api(app, owner).post('/customers', { name: 'Haji Rafiq', phone: '0333-5551234', openingBalance: 15000 }).expect(201)).body;
    expect(customer.phone).toBe('+923335551234');

    // Becho on udhaar: 3 bales at Rs 36,000 and 100 kg at Rs 340.
    const sale = await api(app, owner)
      .post('/sales', {
        customerId: customer.id,
        paymentMode: 'CREDIT',
        lines: [
          { inventoryItemId: jeans.id, quantity: 3, unitPrice: 36000 },
          { inventoryItemId: tops.id, quantity: 100, unitPrice: 340 },
        ],
      })
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    expect(sale.body).toMatchObject({
      status: 'ISSUED',
      totalAmount: '142000',
      totalCost: '120000',
      totalProfit: '22000',
      due: '142000',
      customerBalance: '157000',
    });
    expect(sale.body.lines.map((l: any) => [l.lineTotal, l.lineCost, l.profit])).toEqual([
      ['108000', '90000', '18000'],
      ['34000', '30000', '4000'],
    ]);

    // Vasooli: Rs 50,000 by JazzCash pays the old balance first, then this sale.
    const payment = await api(app, owner)
      .post('/khata/payments', { customerId: customer.id, amount: 50000, method: 'JAZZCASH' })
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    expect(payment.body.balance).toBe('107000');

    const ledger = await api(app, owner).get(`/khata/customers/${customer.id}`).expect(200);
    expect(ledger.body.balance).toBe('107000');
    expect(ledger.body.lines.find((l: any) => l.kind === 'SALE')).toMatchObject({ status: 'PARTIALLY_PAID', paid: '35000', due: '107000' });
    const khata = await api(app, owner).get('/khata').expect(200);
    expect(khata.body).toMatchObject({ totalOwed: '107000', customers: [{ name: 'Haji Rafiq', balance: '107000' }] });

    // Stock left: 7 bales and 150 kg; nothing went through sorting.
    expect((await api(app, owner).get(`/stock/items/${jeans.id}`).expect(200)).body.remainingQuantity).toBe('7');
    expect((await api(app, owner).get(`/stock/items/${tops.id}`).expect(200)).body.remainingQuantity).toBe('150');
    expect(await prisma.sortSession.count({ where: { tenantId: owner.tenantId } })).toBe(0);
    expect(await prisma.repackUnit.count({ where: { tenantId: owner.tenantId } })).toBe(0);
  });
});
