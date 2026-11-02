import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** Task 2.2: customers need only a name; payments belong to the customer and pay the oldest debt first. */
describe('Customers and payments (e2e)', () => {
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

  /** An issued sale straight in the database (the sale flow itself is tested in sales.e2e-spec). */
  const issuedSale = async (tenant: TestTenant, customerId: string, total: string, daysAgo: number) =>
    prisma.sale.create({
      data: {
        tenantId: tenant.tenantId,
        customerId,
        saleNumber: `S-${randomUUID().slice(0, 8)}`,
        type: 'LOCAL',
        paymentMode: 'CREDIT',
        billToken: randomUUID(),
        status: 'ISSUED',
        currencyCode: 'PKR',
        totalAmount: total,
        createdBy: tenant.userId,
        issuedAt: new Date(Date.now() - daysAgo * 86_400_000),
      },
    });
  const statuses = async (ids: string[]) =>
    (await prisma.sale.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } })).sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id)).map((s) => s.status);

  it('creates a customer with name + phone in any local format; both are required', async () => {
    const basic = await api(app, a).post('/customers', { name: 'Haji Bashir', phone: '3015550001' }).expect(201);
    expect(basic.body).toMatchObject({ name: 'Haji Bashir', phone: '+923015550001', city: null, openingBalance: '0', currencyCode: 'PKR' });

    const withPhone = await api(app, a).post('/customers', { name: 'Imran Cloth House', phone: '0300-1234567', city: 'Lahore' }).expect(201);
    expect(withPhone.body).toMatchObject({ phone: '+923001234567', city: 'Lahore' });

    await api(app, a).post('/customers', { name: 'No number' }).expect(400);
    await api(app, a).post('/customers', { name: 'Blank number', phone: '' }).expect(400);
    await api(app, a).post('/customers', { name: 'Spaces only', phone: '   ' }).expect(400);
    await api(app, a).post('/customers', { name: 'Bad number', phone: '12345' }).expect(400);
    await api(app, a).post('/customers', { name: 'Haji Bashir', phone: '3015550002' }).expect(409);
    await api(app, a).post('/customers', { phone: '03001234567' }).expect(400);

    // The number can be changed but not cleared.
    await api(app, a).patch(`/customers/${basic.body.id}`, { phone: '' }).expect(400);
    await api(app, a).patch(`/customers/${basic.body.id}`, { phone: 'abc' }).expect(400);
    const changed = await api(app, a).patch(`/customers/${basic.body.id}`, { phone: '0092 301 5550009' }).expect(200);
    expect(changed.body.phone).toBe('+923015550009');

    const found = await api(app, a).get('/customers?search=300123').expect(200);
    expect(found.body.map((c: any) => c.name)).toEqual(['Imran Cloth House']);
  });

  it('applies payments to the opening balance first, then the oldest sales', async () => {
    const customer = await api(app, a).post('/customers', { name: 'Shafiq & Sons', phone: '+92 321 7654321', openingBalance: 10000 }).expect(201);
    const s1 = await issuedSale(a, customer.body.id, '20000', 10);
    const s2 = await issuedSale(a, customer.body.id, '15000', 5);

    const first = await api(app, a).post('/khata/payments', { customerId: customer.body.id, amount: 25000 }).expect(201);
    expect(first.body).toMatchObject({ balance: '20000', advance: '0', payment: { method: 'CASH', saleId: null, hasPhoto: false } });
    expect(await statuses([s1.id, s2.id])).toEqual(['PARTIALLY_PAID', 'ISSUED']);

    await api(app, a).post('/khata/payments', { customerId: customer.body.id, amount: 5000, method: 'JAZZCASH', reference: 'TX-991' }).expect(201);
    expect(await statuses([s1.id, s2.id])).toEqual(['PAID', 'ISSUED']);

    // Paid against the newer sale: it pays that sale even though nothing older is owed.
    const onSale = await api(app, a).post('/khata/payments', { customerId: customer.body.id, saleId: s2.id, amount: 15000, method: 'RAAST' }).expect(201);
    expect(onSale.body.balance).toBe('0');
    expect(await statuses([s1.id, s2.id])).toEqual(['PAID', 'PAID']);

    // Lowering the opening balance re-applies payments: the extra becomes an advance.
    await api(app, a).patch(`/customers/${customer.body.id}`, { openingBalance: 4000 }).expect(200);
    const extra = await api(app, a).post('/khata/payments', { customerId: customer.body.id, amount: 1 }).expect(201);
    expect(extra.body).toMatchObject({ balance: '-6001', advance: '6001' });
    const audit = await prisma.auditLog.findFirst({ where: { tenantId: a.tenantId, action: 'CUSTOMER_OPENING_BALANCE_CHANGED', entityId: customer.body.id } });
    expect(audit?.metadataJson).toEqual({ previous: '10000.00', new: '4000.00' });
  });

  it('records a payment once when the same Idempotency-Key is sent twice', async () => {
    const customer = await api(app, a).post('/customers', { name: 'Offline Ali', openingBalance: 5000, phone: '03015550015' }).expect(201);
    const key = randomUUID();
    const body = { customerId: customer.body.id, amount: 1200 };
    const first = await api(app, a).post('/khata/payments', body).set('Idempotency-Key', key).expect(201);
    const again = await api(app, a).post('/khata/payments', body).set('Idempotency-Key', key).expect(201);
    expect(again.body).toEqual(first.body);
    expect(await prisma.payment.count({ where: { customerId: customer.body.id } })).toBe(1);

    // Sent at the same moment (double tap / two syncs): still one payment.
    const raceKey = randomUUID();
    const [r1, r2] = await Promise.all([
      api(app, a).post('/khata/payments', body).set('Idempotency-Key', raceKey),
      api(app, a).post('/khata/payments', body).set('Idempotency-Key', raceKey),
    ]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(r2.body).toEqual(r1.body);
    expect(await prisma.payment.count({ where: { customerId: customer.body.id } })).toBe(2);

    // A key is per tenant.
    const other = await api(app, b).post('/customers', { name: 'Offline Ali', phone: '03015550016' }).expect(201);
    await api(app, b).post('/khata/payments', { customerId: other.body.id, amount: 10 }).set('Idempotency-Key', key).expect(201);
    expect(await prisma.payment.count({ where: { customerId: other.body.id } })).toBe(1);
  });

  it('stores a receipt photo and only shows it to its tenant', async () => {
    const customer = await api(app, a).post('/customers', { name: 'Photo Payer', openingBalance: 100, phone: '03015550017' }).expect(201);
    const paid = await api(app, a).post('/khata/payments', { customerId: customer.body.id, amount: 100, method: 'EASYPAISA' }).expect(201);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const server = app.getHttpServer();
    const upload = await request(server)
      .post(`/api/khata/payments/${paid.body.payment.id}/photo`)
      .set('Authorization', `Bearer ${a.token}`)
      .attach('file', png, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(201);
    expect(upload.body).toMatchObject({ hasPhoto: true });
    expect(upload.body.attachmentUrl).toBeUndefined();

    const photo = await api(app, a).get(`/khata/payments/${paid.body.payment.id}/photo`).expect(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(photo.body, png)).toBe(0);

    await api(app, b).get(`/khata/payments/${paid.body.payment.id}/photo`).expect(404);
    await request(server)
      .post(`/api/khata/payments/${paid.body.payment.id}/photo`)
      .set('Authorization', `Bearer ${b.token}`)
      .attach('file', png, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(404);
    await request(server)
      .post(`/api/khata/payments/${paid.body.payment.id}/photo`)
      .set('Authorization', `Bearer ${a.token}`)
      .attach('file', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('keeps tenants apart', async () => {
    const own = await api(app, a).post('/customers', { name: 'Private Customer', openingBalance: 900, phone: '03015550018' }).expect(201);
    const sale = await issuedSale(a, own.body.id, '500', 1);
    const theirs = await api(app, b).post('/customers', { name: 'Their Customer', phone: '03015550019' }).expect(201);

    await api(app, b).get(`/customers/${own.body.id}`).expect(404);
    await api(app, b).patch(`/customers/${own.body.id}`, { openingBalance: 0 }).expect(404);
    await api(app, b).delete(`/customers/${own.body.id}`).expect(404);
    await api(app, b).post('/khata/payments', { customerId: own.body.id, amount: 50 }).expect(404);
    await api(app, b).post('/khata/payments', { customerId: theirs.body.id, saleId: sale.id, amount: 50 }).expect(400);
    const listB = await api(app, b).get('/customers').expect(200);
    expect(listB.body.map((c: any) => c.name)).not.toContain('Private Customer');
    expect(await prisma.payment.count({ where: { customerId: own.body.id } })).toBe(0);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: own.body.id } })).openingBalance.toFixed(2)).toBe('900.00');
  });

  it('deletes only customers with no sales or payments', async () => {
    const fresh = await api(app, a).post('/customers', { name: 'Typo Customer', phone: '03015550020' }).expect(201);
    await api(app, a).delete(`/customers/${fresh.body.id}`).expect(200);
    const paying = await api(app, a).post('/customers', { name: 'Paying Customer', phone: '03015550021' }).expect(201);
    await api(app, a).post('/khata/payments', { customerId: paying.body.id, amount: 10 }).expect(201);
    await api(app, a).delete(`/customers/${paying.body.id}`).expect(409);
  });
});
