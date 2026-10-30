import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** Task 2.3: one-step sales by kg, bale or piece; cash, udhaar or part paid; exact cost per line. */
describe('Sales (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;
  let kg: any;
  let bales: any;
  let pieces: any;
  let ali: any;
  let bilal: any;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    kg = (await api(app, a).post('/stock/items', { name: 'Mixed tops', unit: 'KG', quantity: 500, totalCost: 100000 }).expect(201)).body;
    bales = (await api(app, a).post('/stock/items', { name: 'Jeans A', unit: 'BALE', quantity: 4, totalCost: 100000, weightKg: 200 }).expect(201)).body;
    pieces = (await api(app, a).post('/stock/items', { name: 'Jackets', unit: 'PIECE', quantity: 40, totalCost: 10000, salePrice: 450 }).expect(201)).body;
    ali = (await api(app, a).post('/customers', { name: 'Ali Traders', phone: '03001112233' }).expect(201)).body;
    bilal = (await api(app, a).post('/customers', { name: 'Bilal Cloth' }).expect(201)).body;
  });

  afterAll(async () => {
    await app.close();
  });

  const item = (id: string) => prisma.inventoryItem.findUniqueOrThrow({ where: { id } });

  it('cash sale by kg: paid in full, stock used, profit per line', async () => {
    const sale = await api(app, a)
      .post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [{ inventoryItemId: kg.id, quantity: 200, unitPrice: 260 }] })
      .expect(201);
    expect(sale.body).toMatchObject({
      type: 'LOCAL',
      paymentMode: 'CASH',
      status: 'PAID',
      totalAmount: '52000',
      totalCost: '40000',
      totalProfit: '12000',
      paid: '52000',
      due: '0',
      customerBalance: '0',
      customer: { name: 'Ali Traders', phone: '+923001112233' },
    });
    expect(sale.body.billToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(sale.body.lines[0]).toMatchObject({ unit: 'KG', quantity: '200', unitPrice: '260', lineCost: '40000', profit: '12000', description: 'Mixed tops' });
    expect(sale.body.payments).toEqual([expect.objectContaining({ amount: '52000', method: 'CASH', hasPhoto: false })]);

    expect(await item(kg.id)).toMatchObject({ status: 'AVAILABLE' });
    expect((await item(kg.id)).usedQuantity.toFixed(2)).toBe('200.00');
    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { inventoryItemId: kg.id, movementType: 'SALE' } });
    expect([movement.quantityKg.toFixed(2), movement.referenceId]).toEqual(['200.00', sale.body.id]);
  });

  it('udhaar sale by bale, and part-paid sale by piece', async () => {
    const credit = await api(app, a)
      .post('/sales', { customerId: bilal.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: bales.id, quantity: 2, unitPrice: 30000 }] })
      .expect(201);
    expect(credit.body).toMatchObject({ status: 'ISSUED', totalAmount: '60000', totalCost: '50000', paid: '0', due: '60000', customerBalance: '60000', payments: [] });

    const part = await api(app, a)
      .post('/sales', { customerId: bilal.id, paymentMode: 'PARTIAL', paidAmount: 4000, paymentMethod: 'EASYPAISA', lines: [{ inventoryItemId: pieces.id, quantity: 20, unitPrice: 500 }] })
      .expect(201);
    expect(part.body).toMatchObject({ status: 'PARTIALLY_PAID', totalAmount: '10000', totalCost: '5000', paid: '4000', due: '6000', customerBalance: '66000' });
    expect((await item(bales.id)).usedQuantity.toFixed(0)).toBe('2');
  });

  it('a bale can be sold by kg, in whole bales', async () => {
    await api(app, a).post('/sales', { customerId: bilal.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: bales.id, unit: 'KG', quantity: 70, unitPrice: 600 }] }).expect(400);
    const sale = await api(app, a)
      .post('/sales', { customerId: bilal.id, paymentMode: 'CASH', lines: [{ inventoryItemId: bales.id, unit: 'KG', quantity: 50, unitPrice: 600 }] })
      .expect(201);
    expect(sale.body.lines[0]).toMatchObject({ unit: 'KG', quantity: '50', lineTotal: '30000', lineCost: '25000' });
  });

  it('refuses bad sales and writes nothing', async () => {
    const before = await prisma.sale.count({ where: { tenantId: a.tenantId } });
    const line = { inventoryItemId: pieces.id, quantity: 1, unitPrice: 500 };
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'PARTIAL', lines: [line] }).expect(400);
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'PARTIAL', paidAmount: 500, lines: [line] }).expect(400);
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CREDIT', paidAmount: 100, lines: [line] }).expect(400);
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [line, line] }).expect(400);
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [{ ...line, quantity: 1.5 }] }).expect(400);
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CASH', type: 'EXPORT', lines: [line] }).expect(400);
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [] }).expect(400);
    // The second line is short, so the first line's stock must not be used either.
    await api(app, a)
      .post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [line, { inventoryItemId: kg.id, quantity: 301, unitPrice: 1 }] })
      .expect(409);
    expect(await prisma.sale.count({ where: { tenantId: a.tenantId } })).toBe(before);
    expect((await item(pieces.id)).usedQuantity.toFixed(0)).toBe('20');
  });

  it('selling the rest of an item costs exactly what is left, then it is sold out', async () => {
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [{ inventoryItemId: kg.id, quantity: 100.33, unitPrice: 250 }] }).expect(201);
    await api(app, a).post('/sales', { customerId: bilal.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: kg.id, quantity: 199.67, unitPrice: 250 }] }).expect(201);
    const costs = await prisma.saleLine.aggregate({ where: { inventoryItemId: kg.id }, _sum: { lineCost: true } });
    expect(costs._sum.lineCost!.toFixed(2)).toBe('100000.00');
    expect(await item(kg.id)).toMatchObject({ status: 'SOLD' });
    await api(app, a).post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [{ inventoryItemId: kg.id, quantity: 1, unitPrice: 250 }] }).expect(409);
  });

  it('suggests the last price: this customer, then any customer, then the item price', async () => {
    const own = await api(app, a).get(`/sales/last-price?customerId=${ali.id}&inventoryItemId=${kg.id}`).expect(200);
    expect(own.body).toEqual({ unit: 'KG', unitPrice: '250', from: 'CUSTOMER' });
    const another = (await api(app, a).post('/stock/items', { name: 'Mixed tops', unit: 'KG', quantity: 100, totalCost: 20000 }).expect(201)).body;
    const newCustomer = (await api(app, a).post('/customers', { name: 'New Buyer' }).expect(201)).body;
    const any = await api(app, a).get(`/sales/last-price?customerId=${newCustomer.id}&inventoryItemId=${another.id}`).expect(200);
    expect(any.body).toEqual({ unit: 'KG', unitPrice: '250', from: 'ANY_CUSTOMER' });
    const fresh = (await api(app, a).post('/stock/items', { name: 'Shoes', unit: 'PIECE', quantity: 10, totalCost: 1000, salePrice: 300 }).expect(201)).body;
    const fromItem = await api(app, a).get(`/sales/last-price?customerId=${ali.id}&inventoryItemId=${fresh.id}`).expect(200);
    expect(fromItem.body).toEqual({ unit: 'PIECE', unitPrice: '300', from: 'ITEM' });
  });

  it('creates one sale when the same Idempotency-Key is sent twice', async () => {
    const key = randomUUID();
    const body = { customerId: ali.id, paymentMode: 'CASH', lines: [{ inventoryItemId: pieces.id, quantity: 2, unitPrice: 450 }] };
    const first = await api(app, a).post('/sales', body).set('Idempotency-Key', key).expect(201);
    const again = await api(app, a).post('/sales', body).set('Idempotency-Key', key).expect(201);
    expect(again.body).toEqual(first.body);
    expect(await prisma.sale.count({ where: { id: first.body.id } })).toBe(1);
    expect(await prisma.saleLine.count({ where: { sale: { tenantId: a.tenantId }, inventoryItemId: pieces.id, quantity: 2 } })).toBe(1);
    expect((await item(pieces.id)).usedQuantity.toFixed(0)).toBe('22');
  });

  it('records the handover separately', async () => {
    const sale = (await prisma.sale.findFirstOrThrow({ where: { tenantId: a.tenantId } })).id;
    await api(app, a).post(`/sales/${sale}/fulfill`, { fulfillmentReference: 'Loader LES-123' }).expect(201);
    await api(app, a).post(`/sales/${sale}/fulfill`, {}).expect(409);
  });

  it('keeps tenants apart', async () => {
    const theirCustomer = (await api(app, b).post('/customers', { name: 'Their Buyer' }).expect(201)).body;
    const theirStock = (await api(app, b).post('/stock/items', { name: 'Theirs', unit: 'KG', quantity: 10, totalCost: 100 }).expect(201)).body;
    const sale = await prisma.sale.findFirstOrThrow({ where: { tenantId: a.tenantId } });

    await api(app, b).post('/sales', { customerId: theirCustomer.id, paymentMode: 'CASH', lines: [{ inventoryItemId: pieces.id, quantity: 1, unitPrice: 1 }] }).expect(400);
    await api(app, b).post('/sales', { customerId: ali.id, paymentMode: 'CASH', lines: [{ inventoryItemId: theirStock.id, quantity: 1, unitPrice: 1 }] }).expect(404);
    await api(app, b).get(`/sales/${sale.id}`).expect(404);
    await api(app, b).post(`/sales/${sale.id}/fulfill`, {}).expect(404);
    await api(app, b).get(`/sales/last-price?customerId=${theirCustomer.id}&inventoryItemId=${pieces.id}`).expect(404);
    await api(app, b).get(`/sales/last-price?customerId=${ali.id}&inventoryItemId=${theirStock.id}`).expect(404);
    expect((await api(app, b).get('/sales').expect(200)).body).toHaveLength(0);
    expect((await item(pieces.id)).usedQuantity.toFixed(0)).toBe('22');
  });
});
