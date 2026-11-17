import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantBootstrapService } from '../../src/superadmin/tenant-bootstrap.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/**
 * Settings review, second part (owner, 2026-11-17: "Fix all 20"): raw types can be changed and put in order,
 * one in use is turned off instead of deleted, one name is one raw type, the last one stays; a godown that
 * holds stock cannot be turned off; a new business starts with "Main godown".
 */
describe('Settings review 2: raw types and godowns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    await prisma.rawCategory.deleteMany({ where: { tenantId: { in: [a.tenantId, b.tenantId] } } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('a raw type can be renamed, change how it comes and move in the order', async () => {
    const mixed = (await api(app, a).post('/tenant/raw-categories', { name: 'Mixed', rawType: 'BALE', sortOrder: 0 }).expect(201)).body;
    const winter = (await api(app, a).post('/tenant/raw-categories', { name: 'Winter', rawType: 'BALE', sortOrder: 1 }).expect(201)).body;
    const changed = (await api(app, a).put(`/tenant/raw-categories/${winter.id}`, { name: 'Winter mix', rawType: 'BOTH' }).expect(200)).body;
    expect([changed.name, changed.rawType]).toEqual(['Winter mix', 'BOTH']);
    await api(app, a).put(`/tenant/raw-categories/${winter.id}`, { sortOrder: 0 }).expect(200);
    await api(app, a).put(`/tenant/raw-categories/${mixed.id}`, { sortOrder: 1 }).expect(200);
    expect((await api(app, a).get('/tenant/raw-categories').expect(200)).body.map((r: any) => r.name)).toEqual(['Winter mix', 'Mixed']);
    // Another business can neither change nor remove it.
    await api(app, b).put(`/tenant/raw-categories/${mixed.id}`, { name: 'Theirs' }).expect(404);
    await api(app, b).delete(`/tenant/raw-categories/${mixed.id}`).expect(404);
  });

  it('one name is one raw type, whatever it comes as', async () => {
    await api(app, a).post('/tenant/raw-categories', { name: 'mixed', rawType: 'RAG' }).expect(409);
    const other = (await api(app, a).post('/tenant/raw-categories', { name: 'Summer', rawType: 'RAG' }).expect(201)).body;
    await api(app, a).put(`/tenant/raw-categories/${other.id}`, { name: 'MIXED' }).expect(409);
    // The same name in another business is its own.
    await api(app, b).post('/tenant/raw-categories', { name: 'Mixed', rawType: 'BALE' }).expect(201);
  });

  it('removing a raw type that lots were bought as turns it off and the lots keep it; an unused one is deleted', async () => {
    const [mixed, summer] = await Promise.all(['Mixed', 'Summer'].map((name) => prisma.rawCategory.findFirstOrThrow({ where: { tenantId: a.tenantId, name } })));
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 10000, rawCategoryId: mixed.id }).expect(201)).body;
    await api(app, a).delete(`/tenant/raw-categories/${mixed.id}`).expect(200);
    expect((await prisma.rag.findUniqueOrThrow({ where: { id: lot.id } })).rawCategoryId).toBe(mixed.id);
    expect((await prisma.rawCategory.findUniqueOrThrow({ where: { id: mixed.id } })).isActive).toBe(false);
    // Not offered when buying; Settings still lists it, and it can be turned on again.
    expect((await api(app, a).get('/tenant/raw-categories').expect(200)).body.map((r: any) => r.name)).not.toContain('Mixed');
    expect((await api(app, a).get('/tenant/raw-categories?all=true').expect(200)).body.map((r: any) => r.name)).toContain('Mixed');
    await api(app, a).put(`/tenant/raw-categories/${mixed.id}`, { isActive: true }).expect(200);
    await api(app, a).delete(`/tenant/raw-categories/${summer.id}`).expect(200);
    expect(await prisma.rawCategory.findUnique({ where: { id: summer.id } })).toBeNull();
  });

  it('the last raw type that is on stays on', async () => {
    const on = await prisma.rawCategory.findMany({ where: { tenantId: a.tenantId, isActive: true }, orderBy: { sortOrder: 'asc' } });
    for (const r of on.slice(1)) await api(app, a).put(`/tenant/raw-categories/${r.id}`, { isActive: false }).expect(200);
    const last = on[0];
    expect((await api(app, a).put(`/tenant/raw-categories/${last.id}`, { isActive: false }).expect(409)).body.code).toBe('LAST_ONE');
    expect((await api(app, a).delete(`/tenant/raw-categories/${last.id}`).expect(409)).body.code).toBe('LAST_ONE');
  });

  it('a godown that holds stock cannot be turned off; an empty one can', async () => {
    const row = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...new Set([...row.enabledModules, 'WAREHOUSES'])] } });
    // The business's first godown is its main one; the second is the one tried here.
    await api(app, a).post('/admin/warehouses', { name: 'Main godown', code: 'MAIN' }).expect(201);
    const shop = (await api(app, a).post('/admin/warehouses', { name: 'Shop', code: 'SHOP' }).expect(201)).body;
    const item = await prisma.inventoryItem.create({ data: { tenantId: a.tenantId, source: 'PURCHASED', name: 'Loose', unit: 'KG', quantity: 10, totalCost: 100, unitCost: 10, avgCost: 10, weightKg: 10, status: 'AVAILABLE', warehouseId: shop.id } });
    const refused = (await api(app, a).patch(`/admin/warehouses/${shop.id}`, { isActive: false }).expect(409)).body;
    expect([refused.code, refused.count]).toEqual(['HAS_STOCK', 1]);
    // Another business cannot touch it at all.
    await api(app, b).patch(`/admin/warehouses/${shop.id}`, { isActive: false }).expect(404);
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { status: 'SOLD', usedQuantity: 10 } });
    expect((await api(app, a).patch(`/admin/warehouses/${shop.id}`, { isActive: false }).expect(200)).body.isActive).toBe(false);
  });

  it('a new business starts with a godown called Main godown, with no made-up place', async () => {
    const fresh = await prisma.tenant.create({ data: { name: `Fresh ${Date.now()}`, companyCode: `F${Date.now().toString(36).toUpperCase()}` } });
    await app.get(TenantBootstrapService).bootstrapTenant(fresh.id, undefined, undefined, undefined, { sortingStages: 1 });
    const first = await prisma.warehouse.findFirstOrThrow({ where: { tenantId: fresh.id } });
    expect([first.name, first.location]).toEqual(['Main godown', null]);
  });
});
