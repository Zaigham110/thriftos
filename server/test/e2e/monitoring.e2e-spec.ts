import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './fixtures';

/** v2 5.4: the app reports browser errors without signing in; sizes are limited; request ids come back. */
describe('Monitoring endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a browser error report without a login and rejects oversized ones', async () => {
    const server = app.getHttpServer();
    await request(server).post('/api/client-errors').send({ message: 'TypeError: x is undefined', stack: 'at y (main.js:1:2)', path: '/thriftos/khata?search=0300' }).expect(204);
    await request(server).post('/api/client-errors').send({ message: 'x'.repeat(501) }).expect(400);
    await request(server).post('/api/client-errors').send({}).expect(400);
  });
});
