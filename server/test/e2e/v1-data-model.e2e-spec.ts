import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, login, TestTenant } from './fixtures';

/** Helpers that drive the API the way the screens do. */
async function looseLot(app: INestApplication, t: TestTenant, rawCategoryId: string, weightKg: number, purchaseCost: number) {
  const res = await api(app, t).post('/procurement/rags', { ragBaleType: 'BALE', rawCategoryId, weightKg, purchaseCost }).expect(201);
  return res.body as { id: string; allocatedCost: string };
}

async function sortLot(app: INestApplication, t: TestTenant, ragId: string, outputs: [string, number][], wasteCategoryId?: string) {
  const started = await api(app, t).post('/sorting/stage-1/start', { ragId }).expect(201);
  const sessionId = started.body.session.id;
  for (const [categoryId, amountKg] of outputs) {
    await api(app, t).post('/sorting/stage-1/allocate', { sessionId, categoryId, amountKg }).expect(200);
  }
  return (await api(app, t).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId }).expect(200)).body;
}

describe('v1 data model', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a fresh tenant closes a lot with a remainder using its default Waste/Katran type', async () => {
    const superAdmin = await login(app, 'superadmin@thriftos.com', 'SuperAdmin@123');
    const code = `FRESH${randomUUID().slice(0, 6).toUpperCase()}`;
    const adminEmail = `${code.toLowerCase()}@test.local`;
    const created = await api(app, superAdmin)
      .post('/superadmin/tenants', { name: `Fresh ${code}`, companyCode: code, adminEmail, adminName: 'Seth', adminPassword: 'fresh-pass-1' })
      .expect(201);
    expect(created.body.currencyCode).toBe('PKR');

    const owner = await login(app, adminEmail, 'fresh-pass-1');
    const waste = (await api(app, owner).get('/tenant/waste-categories').expect(200)).body as { id: string; name: string }[];
    const katran = waste.find((w) => w.name === 'Waste/Katran');
    expect(katran).toBeDefined();

    const raw = await api(app, owner).post('/tenant/raw-categories', { name: 'Mixed', rawType: 'BALE' }).expect(201);
    const categories = (await api(app, owner).get('/tenant/categories').expect(200)).body as { id: string }[];
    const lot = await looseLot(app, owner, raw.body.id, 120, 24000);

    const closed = await sortLot(app, owner, lot.id, [[categories[0].id, 100]], katran!.id);
    expect(closed.session.status).toBe('CLOSED');
    expect(closed.wasteLineItems).toHaveLength(1);
    expect(closed.wasteLineItems[0].wasteCategoryId).toBe(katran!.id);
    expect(Number(closed.wasteLineItems[0].amount)).toBe(20);
  });

  describe('a container bought straight from a supplier', () => {
    let owner: TestTenant;
    let other: TestTenant;
    let containerId: string;
    let rawCategoryId: string;

    beforeAll(async () => {
      owner = await createTenantWithOwner(app);
      other = await createTenantWithOwner(app);
      rawCategoryId = (await api(app, owner).post('/tenant/raw-categories', { name: 'Mixed', rawType: 'BALE' }).expect(201)).body.id;
    });

    it('needs no purchase order and works out landed cost in PKR', async () => {
      const supplier = await api(app, owner).post('/procurement/vendors', { name: 'Texas Recyclers', originCountry: 'USA' }).expect(201);
      const container = await api(app, owner)
        .post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 20000, purchaseCost: 16000, purchaseCurrency: 'USD', fxRate: 280 })
        .expect(201);
      containerId = container.body.id;
      expect(container.body.purchaseOrderId).toBeNull();
      expect(container.body.originCountry).toBe('USA');
      expect(container.body.landedCostPKR).toBe('4480000');

      await api(app, owner).post(`/procurement/containers/${containerId}/charges`, { chargeType: 'DUTY', amount: 350000 }).expect(201);
      await api(app, owner).post(`/procurement/containers/${containerId}/charges`, { chargeType: 'CLEARING', amount: 120000.5 }).expect(201);

      for (const weightKg of [7000, 8000, 5000]) {
        await api(app, owner).post('/procurement/rags', { containerId, ragBaleType: 'BALE', rawCategoryId, weightKg }).expect(201);
      }
      const breakdown = (await api(app, owner).get(`/procurement/containers/${containerId}/cost-breakdown`).expect(200)).body;
      expect(breakdown.totalCost).toBe('4950000.5');
      expect(breakdown.rags.map((r: any) => r.allocatedCost)).toEqual(['1732500.18', '1980000.2', '1237500.12']);
    });

    it('rejects a USD purchase without an FX rate', async () => {
      const supplier = await api(app, owner).post('/procurement/vendors', { name: 'No Rate Ltd' }).expect(201);
      const res = await api(app, owner)
        .post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 100, purchaseCost: 10, purchaseCurrency: 'USD' })
        .expect(400);
      expect(res.body.message).toContain('USD to PKR rate');
    });

    it("is invisible to another tenant", async () => {
      await api(app, other).get(`/procurement/containers/${containerId}`).expect(404);
      await api(app, other).get(`/procurement/containers/${containerId}/cost-breakdown`).expect(404);
      await api(app, other)
        .post('/procurement/rags', { containerId, ragBaleType: 'BALE', rawCategoryId, weightKg: 1 })
        .expect(400);
      const list = (await api(app, other).get('/procurement/containers').expect(200)).body;
      expect(JSON.stringify(list)).not.toContain(containerId);
    });
  });

  describe('one-stage sorting (sortingStages = 1): bales straight from category outputs', () => {
    let owner: TestTenant;
    let jeans: string;
    let shirts: string;

    beforeAll(async () => {
      owner = await createTenantWithOwner(app);
      // How a business sorts is set by the super admin (v2 modules).
      await prisma.tenant.update({ where: { id: owner.tenantId }, data: { sortingStages: 1 } });
      const raw = (await api(app, owner).post('/tenant/raw-categories', { name: 'Mixed', rawType: 'BALE' }).expect(201)).body.id;
      jeans = (await prisma.category.create({ data: { tenantId: owner.tenantId, name: 'Jeans' } })).id;
      shirts = (await prisma.category.create({ data: { tenantId: owner.tenantId, name: 'Shirts' } })).id;
      const waste = (await api(app, owner).get('/tenant/waste-categories').expect(200)).body.find((w: any) => w.name === 'Waste/Katran').id;

      // Older lot: 100 kg, Rs 50,000 → jeans 60 kg (33,333.33), shirts 30 kg (16,666.67), 10 kg waste.
      const older = await looseLot(app, owner, raw, 100, 50000);
      await sortLot(app, owner, older.id, [[jeans, 60], [shirts, 30]], waste);
      // Newer lot: 100 kg, Rs 30,000 → jeans 70 kg (30,000.00), 30 kg waste.
      const newer = await looseLot(app, owner, raw, 100, 30000);
      await sortLot(app, owner, newer.id, [[jeans, 70]], waste);
    });

    it('takes FIFO from the oldest output and the bales add up to the outputs to the paisa', async () => {
      const available = (await api(app, owner).get(`/stock/bales/available-stock?categoryId=${jeans}`).expect(200)).body;
      expect(available.map((s: any) => [s.source, s.remainingAmount, s.allocatedCost])).toEqual([
        ['CATEGORY', '60', '33333.33'],
        ['CATEGORY', '70', '30000'],
      ]);

      const costs: string[] = [];
      for (const weightKg of [50, 40, 40]) {
        const bale = (await api(app, owner).post('/stock/bales', { categoryId: jeans, weightKg }).expect(201)).body;
        expect(bale.grade).toBeNull();
        expect(bale.inputAllocations.every((a: any) => a.categoryOutputId && !a.gradingOutputId)).toBe(true);
        costs.push(bale.totalCost);
      }
      expect(costs).toEqual(['27777.78', '18412.69', '17142.86']);

      const empty = await api(app, owner).post('/stock/bales', { categoryId: jeans, weightKg: 1 }).expect(400);
      expect(empty.body.message).toContain('0.00 kg available');
    });

    it('requires exactly one source per hand-picked input, in the service and in the database', async () => {
      const shirtsOutput = (await api(app, owner).get(`/stock/bales/available-stock?categoryId=${shirts}`).expect(200)).body[0];
      const both = await api(app, owner)
        .post('/stock/bales', {
          categoryId: shirts,
          weightKg: 5,
          allocations: [{ gradingOutputId: shirtsOutput.id, categoryOutputId: shirtsOutput.id, amountKg: 5 }],
        })
        .expect(400);
      expect(both.body.message).toContain('exactly one');
      await api(app, owner)
        .post('/stock/bales', { categoryId: shirts, weightKg: 5, allocations: [{ amountKg: 5 }] })
        .expect(400);

      const bale = await prisma.repackUnit.findFirstOrThrow({ where: { tenantId: owner.tenantId } });
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO "RepackInputAllocation" (id, "tenantId", "repackUnitId", "amountUsed", "measurementType", "updatedAt")
           VALUES ('no-source', $1, $2, 1, 'WEIGHT', now())`,
          owner.tenantId,
          bale.id,
        ),
      ).rejects.toThrow(/RepackInputAllocation_exactly_one_source/);
    });

    it('does not let baled stock be graded afterwards', async () => {
      const shirtsOutput = (await api(app, owner).get(`/stock/bales/available-stock?categoryId=${shirts}`).expect(200)).body[0];
      await api(app, owner)
        .post('/stock/bales', { categoryId: shirts, weightKg: 10, allocations: [{ categoryOutputId: shirtsOutput.id, amountKg: 10 }] })
        .expect(201);

      const queue = (await api(app, owner).get('/sorting/stage-2/queue').expect(200)).body.data;
      expect(queue.map((o: any) => o.id)).not.toContain(shirtsOutput.id);
      const res = await api(app, owner).post('/sorting/stage-2/start', { categoryOutputId: shirtsOutput.id }).expect(409);
      expect(res.body.message).toContain('already in bales');
    });
  });
});
