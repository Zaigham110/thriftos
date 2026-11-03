import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ensureBaseData, ensureFirstSuperAdmin, PERMISSIONS, SYSTEM_COMPANY_CODE } from '../../src/bootstrap/base-data';
import { createTestApp, login } from './fixtures';

/**
 * v2 5.2: production has no seed, so the server image creates the base data on every start and the first
 * super admin once (dist/bootstrap/bootstrap.js). Same code as the dev/test seed.
 */
describe('Production bootstrap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('base data is idempotent and points super admins at the SYSTEM business', async () => {
    const first = await ensureBaseData(prisma);
    const second = await ensureBaseData(prisma);
    expect(second).toBe(first);
    expect(await prisma.tenant.count({ where: { companyCode: SYSTEM_COMPANY_CODE } })).toBe(1);

    const codes = new Set(PERMISSIONS.map((p) => p.code));
    expect(await prisma.permission.count({ where: { code: { in: [...codes] } } })).toBe(codes.size);

    const config = await prisma.globalConfig.findUniqueOrThrow({ where: { key: 'system.superAdminTenantId' } });
    expect((config.valueJson as { tenantId: string }).tenantId).toBe(first);
  });

  it('never replaces an existing super admin, and creates one for an empty business that signs in', async () => {
    const systemTenantId = await ensureBaseData(prisma);
    const before = await prisma.user.findFirstOrThrow({ where: { tenantId: systemTenantId } });
    expect(await ensureFirstSuperAdmin(prisma, systemTenantId, 'other@example.com', 'x')).toBe(false);
    const after = await prisma.user.findFirstOrThrow({ where: { id: before.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(await prisma.user.count({ where: { tenantId: systemTenantId } })).toBe(1);

    // A business with no users yet gets exactly one first user, with the given password.
    const empty = await prisma.tenant.create({ data: { name: 'Bootstrap Check', companyCode: `BOOT${Date.now()}` } });
    const hash = await bcrypt.hash('a-long-first-password', 4);
    expect(await ensureFirstSuperAdmin(prisma, empty.id, ' First@Example.com ', hash)).toBe(true);
    expect(await ensureFirstSuperAdmin(prisma, empty.id, 'second@example.com', hash)).toBe(false);
    const users = await prisma.user.findMany({ where: { tenantId: empty.id } });
    expect(users.map((u) => u.email)).toEqual(['first@example.com']);
    expect((await login(app, 'first@example.com', 'a-long-first-password')).token).toBeTruthy();
  });
});
