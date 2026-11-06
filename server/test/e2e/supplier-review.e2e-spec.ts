import { INestApplication } from '@nestjs/common';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** v2 review, Suppliers: a supplier's page counts its loose lots too, with one kg total; added and edited per business. */
describe('Suppliers review: loose lots on the supplier page, add and edit (e2e)', () => {
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

  it('shows containers and loose lots with matching kg and cost; contact details; another business sees nothing', async () => {
    const s = await api(app, a)
      .post('/admin/vendors', { name: 'Shershah Traders', originCountry: 'Pakistan', country: 'Pakistan', contactPhone: '+923001234567', contactPerson: 'Haji Aslam', physicalAddress: 'Karachi' })
      .expect(201);
    await api(app, a).post('/procurement/containers', { vendorId: s.body.id, netWeightKg: 10000, purchaseCost: 1000000, withLot: true }).expect(201);
    await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 800, purchaseCost: 160000, vendorId: s.body.id }).expect(201);

    const page = (await api(app, a).get(`/workspace/suppliers/${s.body.id}`).expect(200)).body;
    expect(page.supplier).toMatchObject({ name: 'Shershah Traders', contactPhone: '+923001234567', contactPerson: 'Haji Aslam', physicalAddress: 'Karachi' });
    expect(page.supplier.paymentTerms).toBeUndefined();
    expect(page.totals).toMatchObject({ containers: 1, lots: 1, kg: '10800', landed: '1160000' });
    expect(page.lots).toHaveLength(1);
    expect(page.lots[0]).toMatchObject({ kg: '800', cost: '160000', costPerKg: '200', status: 'NOT_STARTED', sortedPercent: 0 });

    // The Suppliers list counts the same kg (containers + loose lots).
    const list = (await api(app, a).get('/lists/suppliers?q=Shershah').expect(200)).body;
    expect(list.rows[0]).toMatchObject({ containers: 1, lots: 1, kg: '10800' });

    // Edit: name and phone change; another business can neither see nor change it.
    await api(app, a).patch(`/admin/vendors/${s.body.id}`, { name: 'Shershah Traders Karachi', contactPhone: '+923009999999' }).expect(200);
    expect((await api(app, a).get(`/workspace/suppliers/${s.body.id}`).expect(200)).body.supplier.name).toBe('Shershah Traders Karachi');
    await api(app, b).get(`/workspace/suppliers/${s.body.id}`).expect(404);
    await api(app, b).patch(`/admin/vendors/${s.body.id}`, { name: 'Taken over' }).expect(404);
  });
});
