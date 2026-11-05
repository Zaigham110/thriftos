import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/**
 * v2 review, container form: a container is received as "arrived" (or "on the way") on its own date with what is
 * inside it, and the edit form changes its kg while sorting has not started.
 */
describe('Container form: status, date, raw type and editing the kg (e2e)', () => {
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

  const rawType = async (t: TestTenant, name: string) =>
    (await api(app, t).post('/tenant/raw-categories', { name: `${name} ${Date.now()}`, rawType: 'BOTH' }).expect(201)).body.id as string;

  it('receives an arrived container on an earlier date, with its raw type on the lot', async () => {
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'London Clothing Bank', originCountry: 'UK' }).expect(201);
    const jeans = await rawType(a, 'Jeans mix');
    const r = await api(app, a)
      .post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 21000, purchaseCost: 9000, purchaseCurrency: 'USD', fxRate: 280, status: 'ARRIVED', receivedAt: '2026-10-28', rawCategoryId: jeans, withLot: true, charges: [{ chargeType: 'TAX', amount: 1000 }, { chargeType: 'PORT_HANDLING', amount: 500 }] })
      .expect(201);
    const c = await prisma.container.findUniqueOrThrow({ where: { id: r.body.id }, include: { rags: true, containerCharges: true } });
    expect(c.status).toBe('ARRIVED');
    expect(c.createdAt.toISOString().slice(0, 10)).toBe('2026-10-28');
    expect(c.arrivedAt?.toISOString().slice(0, 10)).toBe('2026-10-28');
    expect(c.rags).toHaveLength(1);
    expect(c.rags[0].rawCategoryId).toBe(jeans);
    expect(c.containerCharges.map((x) => x.chargeType).sort()).toEqual(['PORT_HANDLING', 'TAX']);
    // 9,000 × 280 + 1,500 over 21,000 kg.
    expect(Number(c.landedCostPerKg)).toBeCloseTo(120.07, 2);

    // Without a status it still starts on the way (other callers keep their behaviour).
    const onTheWay = await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 1000, purchaseCost: 1000 }).expect(201);
    expect(onTheWay.body.status).toBe('IN_TRANSIT');
    expect(onTheWay.body.arrivedAt).toBeNull();
  });

  it('refuses a date in the future and another business\'s raw type', async () => {
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Busan Rag Trading' }).expect(201);
    await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 1000, purchaseCost: 1000, receivedAt: '2099-01-01' }).expect(400);
    const theirs = await rawType(b, 'Their raw type');
    await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 1000, purchaseCost: 1000, withLot: true, rawCategoryId: theirs }).expect(400);
    // And B cannot edit A's container.
    const mine = await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 1000, purchaseCost: 1000 }).expect(201);
    await api(app, b).patch(`/procurement/containers/${mine.body.id}`, { netWeightKg: 2000 }).expect(404);
  });

  it('edits kg, date and status; the single lot follows the kg until sorting starts', async () => {
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Global Textile Recyclers' }).expect(201);
    const r = await api(app, a).post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 10000, purchaseCost: 1000000, withLot: true }).expect(201);
    const id = r.body.id as string;

    await api(app, a).patch(`/procurement/containers/${id}`, { netWeightKg: 12500, status: 'ARRIVED', receivedAt: '2026-11-01' }).expect(200);
    let c = await prisma.container.findUniqueOrThrow({ where: { id }, include: { rags: true } });
    expect(Number(c.netWeight)).toBe(12500);
    expect(Number(c.landedCostPerKg)).toBe(80);
    expect(Number(c.rags[0].weightKg)).toBe(12500);
    expect(c.status).toBe('ARRIVED');
    expect(c.arrivedAt?.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(c.createdAt.toISOString().slice(0, 10)).toBe('2026-11-01');

    const denim = await rawType(a, 'Denim');
    await api(app, a).patch(`/procurement/containers/${id}`, { rawCategoryId: denim }).expect(200);
    expect((await prisma.rag.findUniqueOrThrow({ where: { id: c.rags[0].id } })).rawCategoryId).toBe(denim);
    await api(app, a).patch(`/procurement/containers/${id}`, { rawCategoryId: await rawType(b, 'Theirs') }).expect(400);

    await api(app, a).post('/sorting/stage-1/start', { ragId: c.rags[0].id }).expect(201);
    await api(app, a).patch(`/procurement/containers/${id}`, { netWeightKg: 13000 }).expect(409);
    // Other fields still change.
    await api(app, a).patch(`/procurement/containers/${id}`, { netWeightKg: 12500, purchaseCost: 1100000 }).expect(200);
    c = await prisma.container.findUniqueOrThrow({ where: { id }, include: { rags: true } });
    expect(Number(c.landedCostPerKg)).toBe(88);
  });
});
