import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { businessDay } from '../../src/workspace/receivables.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

const today = () => businessDay(new Date());
const tomorrow = () => new Date(new Date(`${today()}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

type Line = { kind: string; ref: string | null; party: string | null; out: string; link?: { type: string; id: string } | null };
const charges = (lines: Line[]) => lines.filter((l) => l.kind === 'CHARGE').map((l) => `${l.ref}|${l.party}|${l.out}|${l.link?.type}`).sort();

/**
 * Lot and container charges say where they were paid from (owner, 2026-11-19): a charge paid from the drawer or
 * the bank leaves that book today and counts as money out in the cash close, but is not an expense (it is already
 * in the lot's cost). Charges entered before (no "paid from") are in no book. A cash charge on a closed day stays
 * as it is. Another business sees and changes nothing.
 */
describe('Charges paid from the drawer or the bank (e2e)', () => {
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

  it('cash and bank charges leave their book, old charges leave none, and none is an expense', async () => {
    const lot = (
      await api(app, a)
        .post('/procurement/rags', {
          ragBaleType: 'BALE', weightKg: 800, purchaseCost: 160000,
          charges: [{ kind: 'TRANSPORT', amount: 6000, paidFrom: 'CASH' }, { kind: 'LABOUR', amount: 2500, paidFrom: 'BANK' }, { kind: 'OTHER', amount: 700 }],
        })
        .expect(201)
    ).body;
    expect(lot.charges.map((c: { kind: string; paidFrom: string | null }) => [c.kind, c.paidFrom])).toEqual([['TRANSPORT', 'CASH'], ['LABOUR', 'BANK'], ['OTHER', null]]);
    const supplier = await api(app, a).post('/procurement/vendors', { name: 'Busan Rag Trading' }).expect(201);
    const box = (
      await api(app, a)
        .post('/procurement/containers', { vendorId: supplier.body.id, containerNumber: 'MSKU1234567', netWeightKg: 10000, purchaseCost: 1000000, status: 'ARRIVED', withLot: true, charges: [{ chargeType: 'CLEARING', amount: 40000, paidFrom: 'CASH' }] })
        .expect(201)
    ).body;
    await api(app, a).post(`/procurement/containers/${box.id}/charges`, { chargeType: 'TRANSPORT', amount: 15000, paidFrom: 'BANK' }).expect(201);
    await api(app, a).post(`/procurement/containers/${box.id}/charges`, { chargeType: 'DUTY', amount: 90000 }).expect(201);

    const cash = (await api(app, a).get('/workspace/finance/book?method=CASH').expect(200)).body;
    expect(cash).toMatchObject({ out: '46000', closing: '-46000' });
    expect(charges(cash.lines)).toEqual([`CONTAINER:CLEARING|MSKU1234567|40000|container`, `LOT:TRANSPORT|${lot.ragCode}|6000|lot`].sort());
    const bank = (await api(app, a).get('/workspace/finance/book?method=BANK').expect(200)).body;
    expect(bank).toMatchObject({ out: '17500' });
    expect(charges(bank.lines)).toEqual([`CONTAINER:TRANSPORT|MSKU1234567|15000|container`, `LOT:LABOUR|${lot.ragCode}|2500|lot`].sort());

    // Today's cash close counts them as money out, not as moves.
    const close = (await api(app, a).get(`/workspace/finance/close?day=${today()}`).expect(200)).body;
    expect(close).toMatchObject({ out: '46000', movedOut: '0', expected: '-46000' });

    // Not an expense: running costs stay at nothing.
    const pnl = (await api(app, a).get('/workspace/finance/pnl?months=1').expect(200)).body;
    expect(pnl.totals).toMatchObject({ expenseTotal: '0' });

    // The container page says how each charge was paid.
    const page = (await api(app, a).get(`/workspace/containers/${box.id}`).expect(200)).body;
    expect(page.cost.charges.map((c: { type: string; paidFrom: string | null }) => [c.type, c.paidFrom]).sort()).toEqual([['CLEARING', 'CASH'], ['DUTY', null], ['TRANSPORT', 'BANK']]);

    // Another business: nothing in its books.
    expect(charges((await api(app, b).get('/workspace/finance/book?method=CASH').expect(200)).body.lines)).toEqual([]);
    expect(charges((await api(app, b).get('/workspace/finance/book?method=BANK').expect(200)).body.lines)).toEqual([]);
  });

  it('changing a lot keeps the charges that did not change as they were paid', async () => {
    const lot = (await api(app, a).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 20000, charges: [{ kind: 'TRANSPORT', amount: 1000 }] }).expect(201)).body;
    // The old charge (paid outside) stays outside; a new one is from the drawer.
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { weightKg: 110, charges: [{ kind: 'TRANSPORT', amount: 1000 }, { kind: 'LABOUR', amount: 300, paidFrom: 'CASH' }] }).expect(200);
    const rows = await prisma.lotCharge.findMany({ where: { ragId: lot.id }, orderBy: { kind: 'asc' } });
    expect(rows.map((c) => [c.kind, c.paidFrom, c.paidOn ? 'day' : null])).toEqual([['TRANSPORT', null, null], ['LABOUR', 'CASH', 'day']].sort((x, y) => String(x[0]).localeCompare(String(y[0]))));

    // The same again: the cash charge is kept, not paid a second time.
    const before = rows.find((c) => c.kind === 'LABOUR')!;
    await api(app, a).patch(`/procurement/rags/${lot.id}`, { weightKg: 120, charges: [{ kind: 'TRANSPORT', amount: 1000 }, { kind: 'LABOUR', amount: 300, paidFrom: 'CASH' }] }).expect(200);
    const after = await prisma.lotCharge.findFirstOrThrow({ where: { ragId: lot.id, kind: 'LABOUR' } });
    expect([after.paidFrom, after.paidOn?.toISOString()]).toEqual([before.paidFrom, before.paidOn?.toISOString()]);
    expect(await prisma.lotCharge.count({ where: { ragId: lot.id } })).toBe(2);

    // Another business cannot change the lot.
    await api(app, b).patch(`/procurement/rags/${lot.id}`, { charges: [] }).expect(404);
  });

  it("once today's cash is closed: a new cash charge counts in tomorrow's drawer, and a cash charge of the closed day stays as it is", async () => {
    const t = await createTenantWithOwner(app);
    const lot = (await api(app, t).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 100, purchaseCost: 20000, charges: [{ kind: 'TRANSPORT', amount: 1000, paidFrom: 'CASH' }] }).expect(201)).body;
    const supplier = await api(app, t).post('/procurement/vendors', { name: 'Busan Rag Trading' }).expect(201);
    const box = (await api(app, t).post('/procurement/containers', { vendorId: supplier.body.id, netWeightKg: 1000, purchaseCost: 100000, withLot: true, charges: [{ chargeType: 'DUTY', amount: 5000, paidFrom: 'CASH' }] }).expect(201)).body;
    const chargeId = box.containerCharges[0].id as string;

    await api(app, t).post('/workspace/finance/cash-moves', { day: today(), direction: 'IN', kind: 'OTHER', amount: 10000, note: 'Float' }).expect(201);
    expect((await api(app, t).get(`/workspace/finance/close?day=${today()}`).expect(200)).body).toMatchObject({ out: '6000', expected: '4000' });
    await api(app, t).post('/workspace/finance/close', { day: today(), counted: 4000 }).expect(201);

    const late = (await api(app, t).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 100, charges: [{ kind: 'TRANSPORT', amount: 50, paidFrom: 'CASH' }] }).expect(201)).body;
    expect(late.charges[0].paidOn.slice(0, 10)).toBe(tomorrow());
    await api(app, t).post('/procurement/rags', { ragBaleType: 'BALE', weightKg: 10, purchaseCost: 100, charges: [{ kind: 'TRANSPORT', amount: 50, paidFrom: 'BANK' }] }).expect(201);
    await api(app, t).post(`/procurement/containers/${box.id}/charges`, { chargeType: 'TRANSPORT', amount: 100, paidFrom: 'CASH' }).expect(201);
    // Today stays as counted; tomorrow starts with the 150 already out.
    expect((await api(app, t).get(`/workspace/finance/close?day=${today()}`).expect(200)).body).toMatchObject({ out: '6000', expected: '4000' });
    expect((await api(app, t).get(`/workspace/finance/close?day=${tomorrow()}`).expect(200)).body).toMatchObject({ out: '150' });
    // That late charge can still be changed (tomorrow is open).
    await api(app, t).patch(`/procurement/rags/${late.id}`, { charges: [{ kind: 'TRANSPORT', amount: 60, paidFrom: 'CASH' }] }).expect(200);

    expect((await api(app, t).patch(`/procurement/containers/${box.id}/charges/${chargeId}`, { amount: 6000 }).expect(409)).body.code).toBe('CASH_CLOSED');
    expect((await api(app, t).delete(`/procurement/containers/${box.id}/charges/${chargeId}`).expect(409)).body.code).toBe('CASH_CLOSED');
    // Only its note: fine.
    await api(app, t).patch(`/procurement/containers/${box.id}/charges/${chargeId}`, { description: 'Bill 12' }).expect(200);
    expect((await api(app, t).patch(`/procurement/rags/${lot.id}`, { charges: [] }).expect(409)).body.code).toBe('CASH_CLOSED');
    expect(await prisma.lotCharge.count({ where: { ragId: lot.id } })).toBe(1);
  });
});
