import { INestApplication } from '@nestjs/common';
import { CostingService } from '../../src/costing/costing.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/**
 * The whole money chain through the API: container → 3 lots → sort (2 stages) → bales → sale.
 * At every stage the parts add up to their parent to the paisa, recalculating changes nothing,
 * and a late charge flows all the way down. Expected figures were computed independently
 * (Python decimal, same largest-remainder rule).
 */
const total = (values: (string | number)[]) =>
  (values.reduce<number>((acc, v) => acc + Math.round(Number(v) * 100), 0) / 100).toFixed(2);
const money = (v: string | number) => Number(v).toFixed(2);

describe('cost chain (tasks 1.3 + 1.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let costing: CostingService;
  let owner: TestTenant;
  let other: TestTenant;
  const ids = {} as Record<string, string>;
  const lotIds: string[] = [];
  const baleIds: string[] = [];

  const lots = () => prisma.rag.findMany({ where: { containerId: ids.container }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const categories = () => prisma.categoryOutput.findMany({ where: { ragId: lotIds[0] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const grades = () => prisma.gradeOutput.findMany({ where: { gradeBucket: { gradeSession: { categoryOutputId: ids.jeansOutput } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const bales = () => prisma.repackUnit.findMany({ where: { id: { in: baleIds } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    costing = app.get(CostingService);
    owner = await createTenantWithOwner(app);
    other = await createTenantWithOwner(app);
    const t = owner.tenantId;
    ids.raw = (await prisma.rawCategory.create({ data: { tenantId: t, name: 'Mixed', rawType: 'BALE' } })).id;
    for (const name of ['Jeans', 'Shirts', 'Kids']) ids[name] = (await prisma.category.create({ data: { tenantId: t, name } })).id;
    for (const name of ['A', 'B', 'C']) ids[`grade${name}`] = (await prisma.grade.create({ data: { tenantId: t, name } })).id;
    ids.waste = (await prisma.wasteCategory.findFirstOrThrow({ where: { tenantId: t, name: 'Waste/Katran' } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('container: landed cost = USD purchase × FX + PKR charges', async () => {
    const supplier = await api(app, owner).post('/procurement/vendors', { name: 'Texas Recyclers', originCountry: 'USA' }).expect(201);
    const po = await api(app, owner).post('/procurement/purchase-orders', { poType: 'CONTAINER', vendorId: supplier.body.id }).expect(201);
    ids.po = po.body.id;
    const container = await api(app, owner)
      .post('/procurement/containers', { purchaseOrderId: ids.po, netWeightKg: 20000, purchaseCost: 16000, purchaseCurrency: 'USD', fxRate: 280 })
      .expect(201);
    ids.container = container.body.id;
    expect(container.body.vendorId).toBe(supplier.body.id);

    const empty = (await api(app, owner).get(`/procurement/containers/${ids.container}/cost-breakdown`).expect(200)).body;
    expect(empty.totalWeight).toBe('20000');

    await api(app, owner).post(`/procurement/containers/${ids.container}/charges`, { chargeType: 'DUTY', amount: 350000 }).expect(201);
    await api(app, owner).post(`/procurement/containers/${ids.container}/charges`, { chargeType: 'CLEARING', amount: 120000.5 }).expect(201);
    const c = await prisma.container.findUniqueOrThrow({ where: { id: ids.container } });
    expect(money(c.landedCostPKR.toString())).toBe('4950000.50');
    expect(money((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: ids.po } })).totalCost.toString())).toBe('4950000.50');
  });

  it('lots: split by lot weight and add up to the landed cost', async () => {
    for (const weightKg of [7000, 8000, 5000]) {
      const lot = await api(app, owner).post('/procurement/rags', { containerId: ids.container, ragBaleType: 'BALE', rawCategoryId: ids.raw, weightKg }).expect(201);
      lotIds.push(lot.body.id);
    }
    const rows = await lots();
    expect(rows.map((r) => money(r.allocatedCost.toString()))).toEqual(['1732500.18', '1980000.20', '1237500.12']);
    expect(total(rows.map((r) => r.allocatedCost.toString()))).toBe('4950000.50');
  });

  it('stage 1: category outputs add up to the lot cost (waste carries none)', async () => {
    const started = await api(app, owner).post('/sorting/stage-1/start', { ragId: lotIds[0] }).expect(201);
    const sessionId = started.body.session.id;
    for (const [category, amountKg] of [['Jeans', 3000], ['Shirts', 2500], ['Kids', 1200]] as const) {
      await api(app, owner).post('/sorting/stage-1/allocate', { sessionId, categoryId: ids[category], amountKg }).expect(200);
    }
    await api(app, owner).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: ids.waste }).expect(200);
    const rows = await categories();
    expect(rows.map((r) => money(r.allocatedCost.toString()))).toEqual(['775746.35', '646455.29', '310298.54']);
    expect(total(rows.map((r) => r.allocatedCost.toString()))).toBe('1732500.18');
    ids.jeansOutput = rows[0].id;
  });

  it('stage 2: grade outputs add up to the category output cost', async () => {
    const started = await api(app, owner).post('/sorting/stage-2/start', { categoryOutputId: ids.jeansOutput }).expect(201);
    const sessionId = started.body.session.id;
    for (const [grade, amountKg] of [['gradeA', 1400], ['gradeB', 1100], ['gradeC', 450]] as const) {
      await api(app, owner).post('/sorting/stage-2/allocate', { sessionId, gradeId: ids[grade], amountKg }).expect(200);
    }
    await api(app, owner).patch(`/sorting/stage-2/${sessionId}/seal`, { wasteCategoryId: ids.waste }).expect(200);
    const rows = await grades();
    expect(rows.map((r) => money(r.allocatedCost.toString()))).toEqual(['368150.81', '289261.35', '118334.19']);
    expect(total(rows.map((r) => r.allocatedCost.toString()))).toBe('775746.35');
  });

  it('bales: FIFO bales from grade A add up to its cost', async () => {
    for (const weightKg of [400, 400, 400, 200]) {
      const bale = await api(app, owner).post('/stock/bales', { categoryId: ids.Jeans, gradeId: ids.gradeA, weightKg }).expect(201);
      baleIds.push(bale.body.id);
    }
    const rows = await bales();
    expect(rows.map((b) => money(b.totalCost.toString()))).toEqual(['105185.95', '105185.94', '105185.95', '52592.97']);
    expect(total(rows.map((b) => b.totalCost.toString()))).toBe('368150.81');
  });

  it('sale: line cost is the bale cost and profit is price minus cost', async () => {
    const customer = await api(app, owner)
      .post('/customers', { name: 'Peshawar Landa House', phone: '+923001234567' })
      .expect(201);
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { repackUnitId: baleIds[0] } });
    const sale = await api(app, owner)
      .post('/sales', {
        customerId: customer.body.id,
        paymentMode: 'CREDIT',
        lines: [{ inventoryItemId: item.id, unit: 'KG', quantity: 400, unitPrice: 375 }],
      })
      .expect(201);
    ids.sale = sale.body.id;
    const line = sale.body.lines[0];
    expect(money(line.lineTotal)).toBe('150000.00');
    expect(money(line.lineCost)).toBe('105185.95');
    expect(money(line.profit)).toBe('44814.05');
  });

  it('recalculating unchanged data changes nothing (parity with the stored chain)', async () => {
    const result = await costing.recalculateContainer(owner.tenantId, ids.container);
    expect(result.changed).toEqual({ containers: 0, lots: 0, categoryOutputs: 0, gradeOutputs: 0, baleInputs: 0, bales: 0 });
    expect(result.adjustments).toHaveLength(0);
  });

  it('a late charge flows down the whole chain; the sold line keeps its cost and the change is logged', async () => {
    await api(app, owner).post(`/procurement/containers/${ids.container}/charges`, { chargeType: 'TRANSPORT', amount: 49999.5 }).expect(201);

    expect(money((await prisma.container.findUniqueOrThrow({ where: { id: ids.container } })).landedCostPKR.toString())).toBe('5000000.00');
    expect(money((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: ids.po } })).totalCost.toString())).toBe('5000000.00');
    expect((await lots()).map((r) => money(r.allocatedCost.toString()))).toEqual(['1750000.00', '2000000.00', '1250000.00']);
    expect((await categories()).map((r) => money(r.allocatedCost.toString()))).toEqual(['783582.09', '652985.07', '313432.84']);
    expect((await grades()).map((r) => money(r.allocatedCost.toString()))).toEqual(['371869.47', '292183.15', '119529.47']);
    const baleRows = await bales();
    expect(baleRows.map((b) => money(b.totalCost.toString()))).toEqual(['106248.42', '106248.42', '106248.42', '53124.21']);
    expect(total(baleRows.map((b) => b.totalCost.toString()))).toBe('371869.47');

    const line = await prisma.saleLine.findFirstOrThrow({ where: { saleId: ids.sale } });
    expect(money(line.lineCost.toString())).toBe('105185.95');
    const adjustment = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: owner.tenantId, action: 'COST_ADJUSTMENT', entityId: baleIds[0] } });
    expect(adjustment.metadataJson).toEqual({ previousCost: '105185.95', newCost: '106248.42', difference: '1062.47' });

    const again = await costing.recalculateContainer(owner.tenantId, ids.container);
    expect(Object.values(again.changed).every((n) => n === 0)).toBe(true);
  });

  it('lot corrections re-run costs and follow the rules', async () => {
    // Unsorted container lot: weight change re-splits the container.
    await api(app, owner).patch(`/procurement/rags/${lotIds[2]}`, { weightKg: 4000 }).expect(200);
    const rows = await lots();
    expect(rows.map((r) => money(r.allocatedCost.toString()))).toEqual(['1842105.26', '2105263.16', '1052631.58']);
    expect(total(rows.map((r) => r.allocatedCost.toString()))).toBe('5000000.00');

    await api(app, owner).patch(`/procurement/rags/${lotIds[0]}`, { weightKg: 6999 }).expect(409);
    await api(app, owner).patch(`/procurement/rags/${lotIds[2]}`, { purchaseCost: 1 }).expect(400);
    await api(app, owner).patch(`/procurement/rags/${lotIds[2]}`, { weightKg: 9001 }).expect(400);
    await api(app, other).patch(`/procurement/rags/${lotIds[2]}`, { notes: 'not yours' }).expect(404);

    // Loose lot: a price correction after sorting re-costs its outputs.
    const loose = await api(app, owner).post('/procurement/rags', { ragBaleType: 'BALE', rawCategoryId: ids.raw, weightKg: 100, purchaseCost: 30000 }).expect(201);
    const started = await api(app, owner).post('/sorting/stage-1/start', { ragId: loose.body.id }).expect(201);
    const sessionId = started.body.session.id;
    await api(app, owner).post('/sorting/stage-1/allocate', { sessionId, categoryId: ids.Shirts, amountKg: 60 }).expect(200);
    await api(app, owner).post('/sorting/stage-1/allocate', { sessionId, categoryId: ids.Kids, amountKg: 30 }).expect(200);
    await api(app, owner).patch(`/sorting/stage-1/${sessionId}/seal`, { wasteCategoryId: ids.waste }).expect(200);
    await api(app, owner).patch(`/procurement/rags/${loose.body.id}`, { purchaseCost: 31000 }).expect(200);
    const outputs = await prisma.categoryOutput.findMany({ where: { ragId: loose.body.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    expect(outputs.map((o) => money(o.allocatedCost.toString()))).toEqual(['20666.67', '10333.33']);
  });

  it("refuses another tenant's container or lot, even when called directly", async () => {
    await expect(costing.recalculateContainer(other.tenantId, ids.container)).rejects.toThrow('Container not found');
    await expect(costing.recalculateLot(other.tenantId, lotIds[0])).rejects.toThrow('Lot not found');
  });

  it('keeps the cost of a loose lot recorded without a price', async () => {
    const lot = await prisma.rag.create({
      data: { tenantId: owner.tenantId, ragCode: 'NO-PRICE-1', weightKg: 10, allocatedCost: 1234.5, sourceType: 'LOOSE_BALE' },
    });
    const result = await costing.recalculateLot(owner.tenantId, lot.id);
    expect(result.changed.lots).toBe(0);
    expect(money((await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } })).allocatedCost.toString())).toBe('1234.50');
  });
});
