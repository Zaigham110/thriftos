import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export interface TestTenant {
  tenantId: string;
  userId: string;
  email: string;
  token: string;
}

const PASSWORD = 'test-password-1';

/** A fresh tenant with one owner user holding every permission, already logged in. */
export async function createTenantWithOwner(app: INestApplication): Promise<TestTenant> {
  const prisma = app.get(PrismaService);
  const suffix = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({
    data: { name: `Test ${suffix}`, companyCode: `T${suffix}`.toUpperCase() },
  });
  const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Owner' } });
  const permissions = await prisma.permission.findMany({ select: { id: true } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });
  const email = `owner-${suffix}@test.local`;
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Owner',
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      userRoles: { create: { roleId: role.id } },
    },
  });
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return { tenantId: tenant.id, userId: user.id, email, token: res.body.accessToken };
}

/** A logged-in user in an existing tenant with no roles (so no permissions). */
export async function createUserWithoutPermissions(app: INestApplication, tenantId: string): Promise<TestTenant> {
  const prisma = app.get(PrismaService);
  const email = `plain-${randomUUID().slice(0, 8)}@test.local`;
  const user = await prisma.user.create({
    data: { tenantId, name: 'Plain', email, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return { tenantId, userId: user.id, email, token: res.body.accessToken };
}

export function api(app: INestApplication, tenant: TestTenant) {
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer ${tenant.token}` };
  return {
    get: (url: string) => request(server).get(`/api${url}`).set(auth),
    post: (url: string, body?: object) => request(server).post(`/api${url}`).set(auth).send(body),
    patch: (url: string, body?: object) => request(server).patch(`/api${url}`).set(auth).send(body),
    delete: (url: string) => request(server).delete(`/api${url}`).set(auth),
  };
}

/** Master data (reused per tenant) and one new unsorted loose lot (100 kg costing Rs 50,000). */
export async function seedSortableLot(app: INestApplication, tenantId: string) {
  const prisma = app.get(PrismaService);
  const raw =
    (await prisma.rawCategory.findFirst({ where: { tenantId, name: 'Mixed' } })) ??
    (await prisma.rawCategory.create({ data: { tenantId, name: 'Mixed', rawType: 'BALE' } }));
  const category = async (name: string) =>
    (await prisma.category.findFirst({ where: { tenantId, name } })) ??
    (await prisma.category.create({ data: { tenantId, name } }));
  const grade = async (name: string, rank: number) =>
    (await prisma.grade.findFirst({ where: { tenantId, name } })) ??
    (await prisma.grade.create({ data: { tenantId, name, rank } }));
  const jeans = await category('Jeans');
  const shirts = await category('Shirts');
  const gradeA = await grade('A', 1);
  const gradeB = await grade('B', 2);
  const waste =
    (await prisma.wasteCategory.findFirst({ where: { tenantId, name: 'Katran' } })) ??
    (await prisma.wasteCategory.create({ data: { tenantId, name: 'Katran', unitType: 'KG' } }));
  const lot = await prisma.rag.create({
    data: {
      tenantId,
      ragCode: `LOT-${randomUUID().slice(0, 6)}`,
      ragBaleType: 'BALE',
      rawCategoryId: raw.id,
      weightKg: 100,
      allocatedCost: 50000,
      sourceType: 'LOOSE_BALE',
    },
  });
  return { lot, jeans, shirts, gradeA, gradeB, waste };
}
