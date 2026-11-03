import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions } from './fixtures';

describe('API smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports healthy database', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/procurement/vendors').expect(401);
  });

  it("does not show another tenant's suppliers", async () => {
    const a = await createTenantWithOwner(app);
    const b = await createTenantWithOwner(app);
    await api(app, a).post('/procurement/vendors', { name: 'Only In A' }).expect(201);

    const seenByB = await api(app, b).get('/procurement/vendors').expect(200);
    const names = JSON.stringify(seenByB.body);
    expect(names).not.toContain('Only In A');

    const seenByA = await api(app, a).get('/procurement/vendors').expect(200);
    expect(JSON.stringify(seenByA.body)).toContain('Only In A');
  });

  it('needs category permissions to change raw categories', async () => {
    const owner = await createTenantWithOwner(app);
    const plain = await createUserWithoutPermissions(app, owner.tenantId);
    await api(app, plain).post('/tenant/raw-categories', { name: 'Mixed', rawType: 'BALE' }).expect(403);
    await api(app, plain).get('/tenant/raw-categories').expect(200);
  });
});
