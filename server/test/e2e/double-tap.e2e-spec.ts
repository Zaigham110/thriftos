import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp, TestTenant } from './fixtures';

/**
 * Audit 2026-11, M4 (second half): an expense, a worker's advance and cash taken out of the drawer are saved
 * once when the same entry arrives twice (a double tap or a retry on a slow line), like sales and payments.
 */
describe('Money entries are saved once on a double tap (audit M4) (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { enabledModules: true } });
    await prisma.tenant.update({ where: { id: a.tenantId }, data: { enabledModules: [...new Set([...t.enabledModules, 'EXPENSES', 'CASH_CLOSE', 'PAYROLL'])] } });
  });

  afterAll(async () => {
    await app.close();
  });

  /** The same entry three times at once, then once more afterwards: one row, and the later repeat gets the first answer. */
  async function once(url: string, body: object, count: () => Promise<number>) {
    const key = randomUUID();
    const send = () => api(app, a).post(url, body).set('Idempotency-Key', key);
    const answers = await Promise.all([send(), send(), send()]);
    const saved = answers.filter((r) => r.status === 201 || r.status === 200);
    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(answers.every((r) => [200, 201, 409].includes(r.status))).toBe(true);
    const later = await send();
    expect(later.body.id).toBe(saved[0].body.id);
    expect(await count()).toBe(1);
    // A new entry (a new key) is saved as its own.
    await api(app, a).post(url, body).set('Idempotency-Key', randomUUID());
    expect(await count()).toBe(2);
  }

  it('an expense', async () => {
    await once('/workspace/expenses', { category: 'RENT', amount: 3000 }, () => prisma.expense.count({ where: { tenantId: a.tenantId } }));
  });

  it('a worker\'s advance', async () => {
    const w = (await api(app, a).post('/payroll/workers', { name: 'Akram', payType: 'DAY', rate: 1000 }).expect(201)).body;
    await once(`/payroll/workers/${w.id}/advances`, { amount: 500 }, () => prisma.workerAdvance.count({ where: { tenantId: a.tenantId } }));
  });

  it('cash put into the drawer', async () => {
    const day = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
    await once('/workspace/finance/cash-moves', { day, direction: 'IN', kind: 'OWNER', amount: 2000 }, () => prisma.cashMove.count({ where: { tenantId: a.tenantId } }));
  });
});
