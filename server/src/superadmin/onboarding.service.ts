import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { toE164 } from '../common/phone/phone';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { QuickCreateTenantDto } from './dto/quick-create.dto';

export type ActivityKind = 'sale' | 'payment' | 'container' | 'app';
export interface LastActivity {
  at: string;
  kind: ActivityKind;
}

/** Audit actions that are not the business itself using ThriftOS (support, failed sign-ins, the business being made). */
const NOT_THE_BUSINESS: Prisma.AuditLogWhereInput[] = [
  { action: { startsWith: 'SUPER' } },
  { action: { startsWith: 'SUPPORT_' } },
  { action: { in: ['TENANT_CREATED', 'AUTH_LOGIN_FAILED', 'AUTH_PIN_FAILED', 'AUTH_PIN_LOCKED', 'TENANT_CONTEXT_MISSING'] } },
];

/** Company code from the business name: letters and digits, up to 12, then -2, -3… if taken. */
export function companyCodeFrom(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
  return base.length >= 2 ? base : `BIZ${base}`;
}

/** The message the super admin sends the owner on WhatsApp, in the owner's language. */
export function welcomeMessage(lang: 'ur' | 'en', p: { owner: string; business: string; url: string; phone: string; pin: string }): string {
  return lang === 'ur'
    ? `السلام علیکم ${p.owner}!\n${p.business} کے لیے آپ کا ThriftOS تیار ہے۔\nکھولیں: ${p.url}\nفون: ${p.phone}\nPIN: ${p.pin}\nپہلی بار کھولنے پر چند سوال پوچھے جائیں گے، پھر کام شروع کریں۔`
    : `Assalam o Alaikum ${p.owner}!\nThriftOS for ${p.business} is ready.\nOpen: ${p.url}\nPhone: ${p.phone}\nPIN: ${p.pin}\nThe first time, it asks a few questions; then you can start.`;
}

/** v2 6.5: Super Admin onboarding tools — quick create and last activity per business. */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bootstrap: TenantBootstrapService,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Makes the business with its defaults (roles, categories, grades, godown) and the owner in the Admin role, who signs
   * in with phone + a new 6-digit PIN. The PIN is returned once (for the welcome message) and never stored readable.
   */
  async quickCreate(dto: QuickCreateTenantDto, actorId: string) {
    const phone = toE164(dto.ownerPhone);
    if (!phone) throw new BadRequestException('Enter a valid phone number, e.g. 0300 1234567');
    if (await this.prisma.user.findUnique({ where: { phone }, select: { id: true } })) throw new ConflictException('This phone already has a login');
    const email = dto.ownerEmail?.trim().toLowerCase() || null;
    if (email && (await this.prisma.user.findFirst({ where: { email }, select: { id: true } }))) throw new ConflictException('This email already has a login');

    const base = companyCodeFrom(dto.businessName);
    let companyCode = base;
    for (let n = 2; await this.prisma.tenant.findUnique({ where: { companyCode }, select: { id: true } }); n++) companyCode = `${base}-${n}`;

    const language = dto.language ?? 'ur';
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.businessName.trim(),
        companyCode,
        defaultLanguage: language,
        locale: language === 'ur' ? 'ur-PK' : 'en-PK',
        sortingStages: dto.sortingStages ?? 2,
      },
    });
    const boot = await this.bootstrap.bootstrapTenant(tenant.id);
    const adminRole = await this.prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Admin' }, select: { id: true } });
    if (!adminRole) throw new Error('Business made without an Admin role');

    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const owner = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: dto.ownerName.trim(),
        phone,
        email,
        pinHash: await this.passwords.hash(pin),
        userRoles: { create: { roleId: adminRole.id } },
      },
      select: { id: true, name: true, phone: true, email: true },
    });

    await this.audit.log({
      userId: actorId,
      tenantId: tenant.id,
      action: 'TENANT_CREATED',
      entityType: 'Tenant',
      entityId: tenant.id,
      metadataJson: { tenantName: tenant.name, companyCode, quick: true, owner: { id: owner.id, name: owner.name, phone }, roles: boot.roles },
    });

    const url = `${(process.env.PUBLIC_APP_URL || 'http://localhost:4200').replace(/\/$/, '')}/auth/login`;
    return {
      tenant: { id: tenant.id, name: tenant.name, companyCode },
      owner,
      pin,
      signInUrl: url,
      welcome: welcomeMessage(language, { owner: owner.name, business: tenant.name, url, phone: localPhone(phone), pin }),
    };
  }

  /** Latest sign-in or work of each business: app use (audit), a sale, a payment or a container — whichever is newest. */
  async lastActivity(tenantIds: string[]): Promise<Map<string, LastActivity>> {
    const out = new Map<string, LastActivity>();
    if (!tenantIds.length) return out;
    const where = { tenantId: { in: tenantIds } };
    const [audit, sales, payments, containers] = await Promise.all([
      this.prisma.auditLog.groupBy({ by: ['tenantId'], where: { ...where, userId: { not: null }, NOT: NOT_THE_BUSINESS }, _max: { createdAt: true } }),
      this.prisma.sale.groupBy({ by: ['tenantId'], where, _max: { createdAt: true } }),
      this.prisma.payment.groupBy({ by: ['tenantId'], where, _max: { createdAt: true } }),
      this.prisma.container.groupBy({ by: ['tenantId'], where, _max: { createdAt: true } }),
    ]);
    const take = (rows: { tenantId: string | null; _max: { createdAt: Date | null } }[], kind: ActivityKind) => {
      for (const r of rows) {
        const at = r._max.createdAt;
        if (!r.tenantId || !at) continue;
        const cur = out.get(r.tenantId);
        if (!cur || at.toISOString() > cur.at) out.set(r.tenantId, { at: at.toISOString(), kind });
      }
    };
    take(sales, 'sale');
    take(payments, 'payment');
    take(containers, 'container');
    take(audit, 'app');
    return out;
  }
}

/** +923001234567 → 0300 1234567 (how owners write it). */
export function localPhone(e164: string): string {
  const m = /^\+92(\d{3})(\d{7})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]}` : e164;
}
