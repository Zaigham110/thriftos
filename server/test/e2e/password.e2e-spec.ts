import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MailService } from '../../src/common/mail/mail.service';
import { resetEmail } from '../../src/auth/password-reset.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { api, createTenantWithOwner, createTestApp } from './fixtures';

/** v2 5.5: change my password; forgot password by a one-time emailed link. */
describe('Passwords (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const OLD = 'test-password-1';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  const loginStatus = async (email: string, password: string) =>
    (await request(app.getHttpServer()).post('/api/auth/login').send({ email, password })).status;

  it('changes the password only with the current one, and ends the other sessions', async () => {
    const owner = await createTenantWithOwner(app);
    const session = await request(app.getHttpServer()).post('/api/auth/login').send({ email: owner.email, password: OLD }).expect(200);

    await api(app, owner).post('/auth/password', { currentPassword: 'wrong-password', newPassword: 'a-new-password-1' }).expect(401);
    await api(app, owner).post('/auth/password', { currentPassword: OLD, newPassword: 'short' }).expect(400);
    await api(app, owner).post('/auth/password', { currentPassword: OLD, newPassword: OLD }).expect(400);
    await request(app.getHttpServer()).post('/api/auth/password').send({ currentPassword: OLD, newPassword: 'a-new-password-1' }).expect(401);

    await api(app, owner).post('/auth/password', { currentPassword: OLD, newPassword: 'a-new-password-1' }).expect(204);
    expect(await loginStatus(owner.email, OLD)).toBe(401);
    expect(await loginStatus(owner.email, 'a-new-password-1')).toBe(200);
    await request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken: session.body.refreshToken }).expect(401);
  });

  it('forgot password: same answer for any email; the emailed link works once and in time', async () => {
    const owner = await createTenantWithOwner(app);
    const server = app.getHttpServer();

    // Mail off (no SMTP_URL): nothing is created, the answer is still 202.
    await request(server).post('/api/auth/forgot-password').send({ email: owner.email }).expect(202);
    expect(await prisma.passwordResetToken.count({ where: { userId: owner.userId } })).toBe(0);

    jest.spyOn(mail, 'configured', 'get').mockReturnValue(true);
    const sent = jest.spyOn(mail, 'send').mockResolvedValue(true);
    await request(server).post('/api/auth/forgot-password').send({ email: 'nobody-here@example.com' }).expect(202);
    expect(sent).not.toHaveBeenCalled();

    await request(server).post('/api/auth/forgot-password').send({ email: owner.email.toUpperCase(), lang: 'ur' }).expect(202);
    expect(sent).toHaveBeenCalledTimes(1);
    const [to, subject, text] = sent.mock.calls[0];
    expect(to).toBe(owner.email);
    expect(subject).toBe(resetEmail('ur', '').subject);
    const token = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(text)![1];
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: owner.userId } });
    expect(row.tokenHash).not.toBe(token);

    await request(server).post('/api/auth/reset-password').send({ token, newPassword: 'short' }).expect(400);
    await request(server).post('/api/auth/reset-password').send({ token, newPassword: 'reset-password-1' }).expect(204);
    await request(server).post('/api/auth/reset-password').send({ token, newPassword: 'reset-password-2' }).expect(400);
    expect(await loginStatus(owner.email, 'reset-password-1')).toBe(200);
    expect(await loginStatus(owner.email, OLD)).toBe(401);

    // An expired link is refused.
    sent.mockClear();
    await request(server).post('/api/auth/forgot-password').send({ email: owner.email }).expect(202);
    const late = /token=([A-Za-z0-9_-]+)/.exec(sent.mock.calls[0][2])![1];
    await prisma.passwordResetToken.updateMany({ where: { userId: owner.userId, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(server).post('/api/auth/reset-password').send({ token: late, newPassword: 'reset-password-3' }).expect(400);
  });
});
