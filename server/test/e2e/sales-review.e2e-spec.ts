import { INestApplication } from '@nestjs/common';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** v2 review, Sales: each bill names the payments that paid it; the list shows paid and due with totals. */
describe('Sales review: payments that paid a bill, paid and due on the list (e2e)', () => {
  let app: INestApplication;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a khata payment shows on the oldest bill it paid; paid and due add up on the list', async () => {
    const tag = Date.now().toString().slice(-6);
    const customer = (await api(app, a).post('/customers', { name: `Ali Traders ${tag}`, phone: `0300${tag}9` }).expect(201)).body;
    const item = (await api(app, a).post('/stock/items', { name: `Jeans A ${tag}`, unit: 'BALE', quantity: 4, totalCost: 40000 }).expect(201)).body;
    const sale = (i: number) =>
      api(app, a).post('/sales', { customerId: customer.id, paymentMode: 'CREDIT', lines: [{ inventoryItemId: item.id, unit: 'BALE', quantity: 1, unitPrice: 30000 + i }] }).expect(201);
    const s1 = (await sale(0)).body;
    const s2 = (await sale(1)).body;
    await api(app, a).post('/khata/payments', { customerId: customer.id, amount: 40000, method: 'JAZZCASH', reference: 'TX-1' }).expect(201);

    const first = (await api(app, a).get(`/sales/${s1.id}`).expect(200)).body;
    expect(first).toMatchObject({ paid: '30000', due: '0' });
    expect(first.paidBy).toEqual([expect.objectContaining({ method: 'JAZZCASH', reference: 'TX-1', applied: '30000', withSale: false })]);
    const second = (await api(app, a).get(`/sales/${s2.id}`).expect(200)).body;
    expect(second).toMatchObject({ paid: '10000', due: '20001' });
    expect(second.paidBy.map((p: { applied: string }) => p.applied)).toEqual(['10000']);

    const list = (await api(app, a).get(`/lists/sales?q=${encodeURIComponent(`Ali Traders ${tag}`)}`).expect(200)).body;
    expect(list.rows.find((r: { id: string }) => r.id === s2.id)).toMatchObject({ paid: '10000', due: '20001' });
    expect(list.totals).toMatchObject({ total: '60001', paid: '40000', due: '20001' });

    // Another business sees neither the bill nor its payments.
    await api(app, b).get(`/sales/${s1.id}`).expect(404);
    expect((await api(app, b).get(`/lists/sales?q=${encodeURIComponent(`Ali Traders ${tag}`)}`).expect(200)).body.rows).toHaveLength(0);
  });
});
