import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/** v2 review, container page: fix a charge typed wrong, see the shipping papers and each lot's raw type, close it. */
describe('Container page: charges, shipping details and closing (e2e)', () => {
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

  it('edits and removes a charge (cost per kg follows), only in its own business, never once closed', async () => {
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Busan Rag Trading' }).expect(201);
    const c = await api(app, a)
      .post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 10000, purchaseCost: 1000000, status: 'ARRIVED', withLot: true, billOfLadingNumber: 'MSK123', portOfLoading: 'Busan', charges: [{ chargeType: 'DUTY', amount: 100000 }] })
      .expect(201);
    const id = c.body.id as string;
    const chargeId = c.body.containerCharges[0].id as string;

    // Typed 100,000 instead of 200,000, and it was clearing.
    await api(app, a).patch(`/procurement/containers/${id}/charges/${chargeId}`, { chargeType: 'CLEARING', amount: 200000, description: 'Agent bill 44' }).expect(200);
    let row = await prisma.container.findUniqueOrThrow({ where: { id }, include: { containerCharges: true } });
    expect(row.containerCharges[0]).toMatchObject({ chargeType: 'CLEARING', description: 'Agent bill 44' });
    expect(Number(row.landedCostPerKg)).toBe(120);
    expect(await prisma.auditLog.count({ where: { tenantId: a.tenantId, action: 'CONTAINER_CHARGE_UPDATED', entityId: chargeId } })).toBe(1);

    // Another business can neither change nor remove it.
    await api(app, b).patch(`/procurement/containers/${id}/charges/${chargeId}`, { amount: 1 }).expect(404);
    await api(app, b).delete(`/procurement/containers/${id}/charges/${chargeId}`).expect(404);

    // The page shows the shipping papers and the lot's raw type.
    const page = (await api(app, a).get(`/workspace/containers/${id}`).expect(200)).body;
    expect(page.container.shipping).toMatchObject({ billOfLading: 'MSK123', portOfLoading: 'Busan' });
    expect(page.lots[0].rawType).toBe('Mixed');
    expect(page.cost.charges[0]).toMatchObject({ type: 'CLEARING', description: 'Agent bill 44' });

    // Remove it: back to the price alone.
    await api(app, a).delete(`/procurement/containers/${id}/charges/${chargeId}`).expect(200);
    row = await prisma.container.findUniqueOrThrow({ where: { id }, include: { containerCharges: true } });
    expect(row.containerCharges).toHaveLength(0);
    expect(Number(row.landedCostPerKg)).toBe(100);

    // Arrived → cleared → closed; a closed container takes no more charges.
    await api(app, a).patch(`/procurement/containers/${id}/status`, { status: 'CLEARED' }).expect(200);
    await api(app, a).patch(`/procurement/containers/${id}/status`, { status: 'CLOSED' }).expect(200);
    await api(app, a).post(`/procurement/containers/${id}/charges`, { chargeType: 'TRANSPORT', amount: 5000 }).expect(409);
  });
});
