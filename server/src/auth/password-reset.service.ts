import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../common/mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';

const RESET_MINUTES = 30;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function resetEmail(lang: 'en' | 'ur', link: string): { subject: string; text: string } {
  return lang === 'ur'
    ? {
        subject: 'ThriftOS — نیا پاس ورڈ',
        text: `نیا پاس ورڈ بنانے کے لیے یہ لنک کھولیں (${RESET_MINUTES} منٹ تک چلے گا):\n${link}\n\nاگر آپ نے یہ نہیں مانگا تو اس ای میل کو نظر انداز کریں۔`,
      }
    : {
        subject: 'ThriftOS — set a new password',
        text: `Open this link to set a new password (it works for ${RESET_MINUTES} minutes):\n${link}\n\nIf you did not ask for this, ignore this email.`,
      };
}

/** Change password (signed in), and forgot/reset by a one-time emailed link. */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async change(userId: string, currentPassword: string, newPassword: string, ipAddress?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await this.passwords.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is not right');
    }
    if (currentPassword === newPassword) throw new BadRequestException('Choose a password you have not used here');
    await this.setPassword(user.id, newPassword);
    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'AUTH_PASSWORD_CHANGED', ipAddress });
  }

  /** Always succeeds from the outside, so nobody can test which emails have accounts. */
  async requestReset(email: string, lang: 'en' | 'ur' = 'en', ipAddress?: string): Promise<void> {
    if (!this.mail.configured) return;
    const user = await this.prisma.user.findFirst({ where: { email: email.trim().toLowerCase(), isActive: true, passwordHash: { not: null } } });
    if (!user?.email) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
    });
    const base = (process.env.PUBLIC_APP_URL || 'http://localhost:4200').replace(/\/$/, '');
    const { subject, text } = resetEmail(lang, `${base}/auth/reset-password?token=${token}`);
    await this.mail.send(user.email, subject, text);
    await this.audit.log({ tenantId: user.tenantId, userId: user.id, action: 'AUTH_PASSWORD_RESET_REQUESTED', ipAddress });
  }

  async reset(token: string, newPassword: string, ipAddress?: string): Promise<void> {
    const now = new Date();
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < now) throw new BadRequestException('This link has expired. Ask for a new one.');
    const used = await this.prisma.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (used.count !== 1) throw new BadRequestException('This link has expired. Ask for a new one.');
    await this.setPassword(row.userId, newPassword);
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { tenantId: true } });
    await this.audit.log({ tenantId: user?.tenantId, userId: row.userId, action: 'AUTH_PASSWORD_RESET', ipAddress });
  }

  /** New hash, and every session signed in with the old password ends. */
  private async setPassword(userId: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
  }
}
