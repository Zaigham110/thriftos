import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, seedSortableLot, TestTenant } from './fixtures';

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

  it('a supplier of loose lots only shows what their stock sold for, earned and how it sorted; nothing bought reads empty', async () => {
    const prisma = app.get(PrismaService);
    const { jeans, gradeA } = await seedSortableLot(app, a.tenantId);
    const s = (await api(app, a).post('/admin/vendors', { name: 'Gaari Wala', originCountry: 'Pakistan' }).expect(201)).body;
    const idle = (await api(app, a).post('/admin/vendors', { name: 'Never Bought', originCountry: 'Pakistan' }).expect(201)).body;
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000, vendorId: s.id }).expect(201)).body;
    const session = (await api(app, a).post('/sorting/stage-1/start', { ragId: lot.id }).expect(201)).body.session;
    const made = (await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, bales: 2, baleWeightKg: 45 }).expect(200)).body;
    const items = await prisma.inventoryItem.findMany({ where: { repackUnitId: { in: made.baleIds } }, orderBy: { createdAt: 'asc' } });
    const buyer = await prisma.customer.create({ data: { tenantId: a.tenantId, name: 'Bale Buyer', phone: '+923001112233' } });
    const sale = (await api(app, a).post('/sales', { customerId: buyer.id, paymentMode: 'CASH', paymentMethod: 'CASH', lines: [{ inventoryItemId: items[0].id, unit: 'BALE', quantity: 1, unitPrice: 9000 }] }).expect(201)).body;
    const profit = sale.lines[0].profit as string;
    expect(Number(profit)).toBeGreaterThan(0);

    // Supplier page: sold, profit, sorted % (90 of 100 kg) and top grade (all A) come from the loose lot.
    const page = (await api(app, a).get(`/workspace/suppliers/${s.id}`).expect(200)).body;
    expect(page.totals).toMatchObject({ containers: 0, lots: 1, kg: '100', revenue: '9000', profit, profitPerKg: String(Number(profit) / 100), yieldPercent: 90, topGradePercent: 100 });
    expect(page.lots[0]).toMatchObject({ revenue: '9000', profit });

    // The lot's own page says what it earned; sorted kg that is in no bale yet is counted (v2 review, Sorting).
    const lotPage = (await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body;
    expect(lotPage.sold).toEqual({ revenue: '9000', profit });
    expect(lotPage.totals.notBaledKg).toBe('0');
    await api(app, a).post('/sorting/stage-1/allocate', { sessionId: session.id, categoryId: jeans.id, gradeId: gradeA.id, amountKg: 6 }).expect(200);
    expect((await api(app, a).get(`/workspace/sorting/${lot.id}`).expect(200)).body.totals.notBaledKg).toBe('6');
    await api(app, b).get(`/workspace/sorting/${lot.id}`).expect(404);

    // The Suppliers list says the same; a supplier nothing was bought from has no profit to show.
    const rows = (await api(app, a).get('/lists/suppliers').expect(200)).body.rows as { name: string; profit: string | null; profitPerKg: string | null; yield: number | null; topGrade: number | null; lots: number }[];
    expect(rows.find((r) => r.name === 'Gaari Wala')).toMatchObject({ lots: 1, profit, yield: 96, topGrade: 100 });
    expect(rows.find((r) => r.name === 'Never Bought')).toMatchObject({ lots: 0, profit: null, profitPerKg: null, yield: null });
    expect(idle.id).toBeTruthy();

    // The scorecard ranks loose-lot suppliers too, by supplier and by origin.
    const card = (await api(app, a).get('/workspace/analytics/suppliers').expect(200)).body;
    expect(card.rows.find((r: { key: string }) => r.key === 'Gaari Wala')).toMatchObject({ containers: 0, lots: 1, kg: '100', landed: '10000', costPerKg: '100', revenue: '9000', profit, yieldPercent: 96, topGradePercent: 100 });
    expect(card.totals.lots).toBeGreaterThanOrEqual(1);
    const byOrigin = (await api(app, a).get('/workspace/analytics/suppliers?by=origin').expect(200)).body;
    expect(byOrigin.rows.find((r: { key: string }) => r.key === 'Pakistan').lots).toBeGreaterThanOrEqual(1);

    // Another business sees none of it.
    const other = (await api(app, b).get('/workspace/analytics/suppliers').expect(200)).body;
    expect(other.rows).toEqual([]);
    expect(other.totals).toMatchObject({ containers: 0, lots: 0 });
  });
});
