import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

/** Task 2.1: stock bought ready to sell, and bales opened into pieces by price tier. */
describe('Direct stock (e2e)', () => {
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

  it('receives stock by kg, bale or piece with only a name, a quantity and a cost', async () => {
    const kg = await api(app, a).post('/stock/items', { name: 'Mixed tops', unit: 'KG', quantity: 500, totalCost: 100000 }).expect(201);
    expect(kg.body).toMatchObject({
      source: 'PURCHASED',
      name: 'Mixed tops',
      unit: 'KG',
      quantity: '500',
      usedQuantity: '0',
      totalCost: '100000',
      unitCost: '200',
      weightKg: '500',
      avgCost: '200',
      status: 'AVAILABLE',
      repackUnitId: null,
      categoryId: null,
    });

    const pieces = await api(app, a).post('/stock/items', { name: 'Ladies jackets', unit: 'PIECE', quantity: 40, totalCost: 9999.99, salePrice: 450 }).expect(201);
    expect(pieces.body).toMatchObject({ unit: 'PIECE', pcsCount: 40, unitCost: '249.9998', salePrice: '450', weightKg: null, avgCost: null });

    const movements = await prisma.stockMovement.findMany({ where: { inventoryItemId: kg.body.id } });
    expect(movements.map((m) => [m.movementType, m.quantityKg.toFixed(2)])).toEqual([['INTAKE', '500.00']]);
  });

  it('needs a name or a category, and whole bales or pieces', async () => {
    await api(app, a).post('/stock/items', { unit: 'KG', quantity: 10, totalCost: 100 }).expect(400);
    await api(app, a).post('/stock/items', { name: 'Shoes', unit: 'BALE', quantity: 1.5, totalCost: 100 }).expect(400);
    await api(app, a).post('/stock/items', { name: 'Shoes', unit: 'BALE', quantity: 2, totalCost: 10.123 }).expect(400);
  });

  it('opens bales into price tiers, and the pieces carry exactly the bales\' cost', async () => {
    const supplier = await prisma.vendor.create({ data: { tenantId: a.tenantId, name: 'Tariq Traders' } });
    const category = await prisma.category.create({ data: { tenantId: a.tenantId, name: 'Jackets' } });
    const bales = await api(app, a)
      .post('/stock/items', { categoryId: category.id, vendorId: supplier.id, unit: 'BALE', quantity: 4, totalCost: 100000, weightKg: 200 })
      .expect(201);
    expect(bales.body).toMatchObject({ unitCost: '25000', avgCost: '500', vendor: { name: 'Tariq Traders' }, category: { name: 'Jackets' } });

    const first = await api(app, a)
      .post(`/stock/items/${bales.body.id}/open`, { tiers: [{ price: 300, pieces: 30 }, { price: 500, pieces: 20 }, { price: 800, pieces: 7, label: 'Best' }] })
      .expect(201);
    expect(first.body.cost).toBe('25000');
    expect(first.body.pieces.map((p: any) => [p.priceTier, p.quantity, p.totalCost, p.salePrice, p.parentItemId])).toEqual([
      ['300', '30', '13157.89', '300', bales.body.id],
      ['500', '20', '8771.93', '500', bales.body.id],
      ['Best', '7', '3070.18', '800', bales.body.id],
    ]);
    expect(first.body.pieces[0]).toMatchObject({ unit: 'PIECE', categoryId: category.id, vendorId: supplier.id, source: 'PURCHASED' });

    await api(app, a).post(`/stock/items/${bales.body.id}/open`, { bales: 4, tiers: [{ price: 300, pieces: 10 }] }).expect(409);
    const rest = await api(app, a).post(`/stock/items/${bales.body.id}/open`, { bales: 3, tiers: [{ price: 400, pieces: 100 }, { price: 900, pieces: 41 }] }).expect(201);
    expect(rest.body.cost).toBe('75000');

    const parent = await api(app, a).get(`/stock/items/${bales.body.id}`).expect(200);
    expect(parent.body).toMatchObject({ usedQuantity: '4', remainingQuantity: '0', status: 'SOLD' });
    const pieces = await prisma.inventoryItem.aggregate({ where: { parentItemId: bales.body.id }, _sum: { totalCost: true } });
    expect(pieces._sum.totalCost!.toFixed(2)).toBe('100000.00');

    const opened = await api(app, a).get(`/stock/items/${first.body.pieces[0].id}`).expect(200);
    expect(opened.body.parentItem).toMatchObject({ id: bales.body.id, unit: 'BALE' });
  });

  it('only opens bales', async () => {
    const kg = await api(app, a).post('/stock/items', { name: 'Socks', unit: 'KG', quantity: 5, totalCost: 500 }).expect(201);
    await api(app, a).post(`/stock/items/${kg.body.id}/open`, { tiers: [{ price: 50, pieces: 10 }] }).expect(400);
    await api(app, a).post(`/stock/items/${kg.body.id}/open`, { tiers: [] }).expect(400);
  });

  it('lists bought stock with what is left', async () => {
    const list = await api(app, a).get('/stock/items?source=PURCHASED&query=mixed').expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ name: 'Mixed tops', remainingQuantity: '500' });
  });

  it('keeps tenants apart', async () => {
    const own = await api(app, a).post('/stock/items', { name: 'Kids', unit: 'BALE', quantity: 2, totalCost: 20000 }).expect(201);
    const supplier = await prisma.vendor.findFirstOrThrow({ where: { tenantId: a.tenantId } });
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId: a.tenantId } });

    await api(app, b).get(`/stock/items/${own.body.id}`).expect(404);
    await api(app, b).post(`/stock/items/${own.body.id}/open`, { tiers: [{ price: 100, pieces: 10 }] }).expect(404);
    await api(app, b).post('/stock/items', { name: 'X', vendorId: supplier.id, unit: 'KG', quantity: 1, totalCost: 1 }).expect(400);
    await api(app, b).post('/stock/items', { categoryId: category.id, unit: 'KG', quantity: 1, totalCost: 1 }).expect(400);
    const listB = await api(app, b).get('/stock/items').expect(200);
    expect(listB.body.items).toHaveLength(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: own.body.id } })).usedQuantity.toFixed(0)).toBe('0');
  });

  it('needs stock permissions', async () => {
    const plain = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, plain).post('/stock/items', { name: 'X', unit: 'KG', quantity: 1, totalCost: 1 }).expect(403);
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { tenantId: a.tenantId, unit: 'BALE', status: 'AVAILABLE' } });
    await api(app, plain).post(`/stock/items/${item.id}/open`, { tiers: [{ price: 1, pieces: 1 }] }).expect(403);
  });
});
