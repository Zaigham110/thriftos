import { localPhone } from '../common/phone/phone';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { PasswordService } from '../auth/password.service';
import { toE164 } from '../common/phone/phone';
import { Language, localeOf, Texts, toLanguage } from '../common/language/language';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { QuickCreateTenantDto, UpdatePersonDto, WorkingsDto } from './dto/quick-create.dto';
import { DEFAULT_MODULES, moduleProblem, storedModules } from '../common/modules/modules';
import { SYSTEM_COMPANY_CODE } from '../common/guards/module.guard';
import { DEFAULT_GRADES, KARACHI_CATEGORIES } from '../tenant/setup-template';

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

/** The message with a new PIN, in the owner's language. */
export function newPinMessage(lang: Language, p: { owner: string; business: string; url: string; phone: string; pin: string }): string {
  const t: Texts<string> = {
    en: `Assalam o Alaikum ${p.owner}!\nYour new PIN for ThriftOS (${p.business}):\nPIN: ${p.pin}\nPhone: ${p.phone}\nOpen: ${p.url}`,
    ur: `السلام علیکم ${p.owner}!\n${p.business} کے ThriftOS کے لیے آپ کا نیا PIN:\nPIN: ${p.pin}\nفون: ${p.phone}\nکھولیں: ${p.url}`,
    roman: `Assalam o Alaikum ${p.owner}!\n${p.business} ke ThriftOS ke liye aap ka naya PIN:\nPIN: ${p.pin}\nPhone: ${p.phone}\nKholein: ${p.url}`,
  };
  return t[lang];
}

/** Company code from the business name: letters and digits, up to 12, then -2, -3… if taken. */
export function companyCodeFrom(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
  return base.length >= 2 ? base : `BIZ${base}`;
}

/** The message the super admin sends the owner on WhatsApp, in the owner's language. */
/** The message the super admin sends a new owner: email and first password (v2: owners sign in with email). */
export function welcomeMessage(lang: Language, p: { owner: string; business: string; url: string; email: string; password: string }): string {
  const t: Texts<string> = {
    en: `Assalam o Alaikum ${p.owner}!\nThriftOS for ${p.business} is ready.\nOpen: ${p.url}\nEmail: ${p.email}\nPassword: ${p.password}\nThe first time, you choose your own password; then you can start.`,
    ur: `السلام علیکم ${p.owner}!\n${p.business} کے لیے آپ کا ThriftOS تیار ہے۔\nکھولیں: ${p.url}\nای میل: ${p.email}\nپاس ورڈ: ${p.password}\nپہلی بار اپنا پاس ورڈ بنائیں، پھر کام شروع کریں۔`,
    roman: `Assalam o Alaikum ${p.owner}!\n${p.business} ke liye aap ka ThriftOS tayyar hai.\nKholein: ${p.url}\nEmail: ${p.email}\nPassword: ${p.password}\nPehli baar apna password banayein, phir kaam shuru karein.`,
  };
  return t[lang];
}

const MODULE_PROBLEMS = {
  NO_BUYING: 'Turn on at least one way of buying: containers, loose lots or ready bales.',
  SORT_NEEDS_LOTS: 'Sorting needs containers or loose lots to sort. Turn one on, or choose no sorting.',
} as const;

/** v2 6.5: Super Admin onboarding tools — quick create and last activity per business. */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bootstrap: TenantBootstrapService,
    private readonly passwords: PasswordService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Makes the business with its defaults (roles, categories, grades, godown) and the owner in the Admin role, who signs
   * in with phone + a new 6-digit PIN. The PIN is returned once (for the welcome message) and never stored readable.
   */
  async quickCreate(dto: QuickCreateTenantDto, actorId: string) {
    // The owner signs in with email and a first password made here (v2); their phone is only for reaching them.
    const email = dto.ownerEmail.trim().toLowerCase();
    if (await this.prisma.user.findFirst({ where: { email }, select: { id: true } })) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'This email already has a login' });
    const phone = dto.ownerPhone?.trim() ? toE164(dto.ownerPhone) : null;
    if (dto.ownerPhone?.trim() && !phone) throw new BadRequestException({ code: 'PHONE_INVALID', message: 'Enter a valid phone number, e.g. 0300 1234567' });
    const taken = phone ? await this.prisma.user.findUnique({ where: { phone }, select: { id: true, tenant: { select: { name: true } } } }) : null;
    if (taken) throw new ConflictException({ code: 'PHONE_TAKEN', message: `This phone is already someone's login (${taken.tenant.name})` });

    const base = companyCodeFrom(dto.businessName);
    let companyCode = base;
    for (let n = 2; await this.prisma.tenant.findUnique({ where: { companyCode }, select: { id: true } }); n++) companyCode = `${base}-${n}`;

    const language = dto.language ?? 'ur';
    const sortingStages = dto.sortingStages ?? 2;
    const chosen = dto.modules ?? DEFAULT_MODULES;
    const problem = moduleProblem(chosen, sortingStages);
    if (problem) throw new BadRequestException({ code: problem, message: MODULE_PROBLEMS[problem] });
    const businessPhone = dto.businessPhone?.trim() ? toE164(dto.businessPhone) : null;
    if (dto.businessPhone?.trim() && !businessPhone) throw new BadRequestException({ code: 'BUSINESS_PHONE_INVALID', message: "Enter a valid business phone, e.g. 021 32412345 or 0300 1234567" });
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.businessName.trim(),
        companyCode,
        defaultLanguage: language,
        locale: localeOf(language),
        ...(dto.currency ? { currency: dto.currency } : {}),
        phone: businessPhone,
        address: dto.address?.trim() || null,
        city: dto.city?.trim() || null,
        sortingStages,
        enabledModules: storedModules(sortingStages, chosen),
        // Everything the owner's setup would ask is chosen here, and the lists are made below: no setup for the owner.
        setupCompletedAt: new Date(),
      },
    });
    const boot = await this.bootstrap.bootstrapTenant(tenant.id, undefined, undefined, undefined, { sortingStages });
    // A new customer tries the Workshop plan for 14 days; its modules come from the plan (Phase 7).
    if ((dto.plan ?? 'TRIAL') === 'TRIAL') await this.billing.startTrial(tenant.id);
    const adminRole = await this.prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Admin' }, select: { id: true } });
    if (!adminRole) throw new Error('Business made without an Admin role');

    const password = this.passwords.generateTemporaryPassword();
    const owner = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: dto.ownerName.trim(),
        phone,
        email,
        passwordHash: await this.passwords.hash(password),
        mustChangePassword: true,
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
      owner: { ...owner, phoneLocal: phone ? localPhone(phone) : null },
      temporaryPassword: password,
      signInUrl: url,
      welcome: welcomeMessage(language, { owner: owner.name, business: tenant.name, url, email, password }),
    };
  }

  /**
   * A new 6-digit PIN for someone who signs in with their phone (the owner lost it, or is locked out after wrong
   * tries). Unlocks them, signs them out everywhere, and returns the PIN once with the message to send. The PIN is
   * not in the audit log.
   */
  async newPin(tenantId: string, userId: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, name: true, phone: true, passwordHash: true, tenant: { select: { name: true, defaultLanguage: true } } } });
    if (!user) throw new NotFoundException('Person not found in this business');
    // Owners sign in with email (v2): a PIN is only for staff.
    if (user.passwordHash) throw new BadRequestException({ code: 'USES_PASSWORD', message: 'This person signs in with email. Make a new password instead.' });
    if (!user.phone) throw new BadRequestException('This person has no phone number. Add one first, then make a PIN.');
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.user.update({ where: { id: user.id }, data: { pinHash: await this.passwords.hash(pin), failedPinAttempts: 0, pinLockedUntil: null } });
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ userId: actorId, tenantId, action: 'USER_PIN_RESET', entityType: 'User', entityId: user.id, metadataJson: { userName: user.name, bySuperAdmin: true } });
    const language = toLanguage(user.tenant.defaultLanguage, 'ur');
    const url = `${(process.env.PUBLIC_APP_URL || 'http://localhost:4200').replace(/\/$/, '')}/auth/login`;
    return { pin, phone: user.phone, message: newPinMessage(language, { owner: user.name, business: user.tenant.name, url, phone: localPhone(user.phone), pin }) };
  }

  /** A temporary password for someone who signs in with email, in their own business (shown once). */
  async newPassword(tenantId: string, userId: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, name: true, email: true } });
    if (!user) throw new NotFoundException('Person not found in this business');
    if (!user.email) throw new BadRequestException('This person signs in with phone and PIN. Make a new PIN instead.');
    const temporaryPassword = this.passwords.generateTemporaryPassword();
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(temporaryPassword), mustChangePassword: true } });
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ userId: actorId, tenantId, action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: user.id, metadataJson: { userName: user.name, bySuperAdmin: true } });
    return { email: user.email, temporaryPassword };
  }

  /** Fix a person's name or phone (a typo in the owner's number). The phone stays unique: it is their login. */
  async updatePerson(tenantId: string, userId: string, dto: UpdatePersonDto, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, name: true, phone: true } });
    if (!user) throw new NotFoundException('Person not found in this business');
    const data: { name?: string; phone?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) {
      const phone = toE164(dto.phone);
      if (!phone) throw new BadRequestException('Enter a valid phone number, e.g. 0300 1234567');
      const other = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, tenant: { select: { name: true } } } });
      if (other && other.id !== user.id) throw new ConflictException(`This phone already has a login (${other.tenant.name})`);
      data.phone = phone;
    }
    const updated = await this.prisma.user.update({ where: { id: user.id }, data, select: { id: true, name: true, phone: true } });
    await this.audit.log({ userId: actorId, tenantId, action: 'USER_UPDATED', entityType: 'User', entityId: user.id, metadataJson: { before: { name: user.name, phone: user.phone }, after: data, bySuperAdmin: true } });
    return updated;
  }

  /**
   * The business type and modules, set by the super admin (the owner can also change them in Settings). Switching
   * to trading only hides the Sorting tab; nothing already recorded is removed.
   */
  async setWorkings(tenantId: string, dto: WorkingsDto, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { sortingStages: true, enabledModules: true, companyCode: true } });
    if (!tenant || tenant.companyCode === SYSTEM_COMPANY_CODE) throw new NotFoundException('Business not found');
    const sortingStages = dto.sortingStages ?? tenant.sortingStages;
    const chosen = dto.modules ?? tenant.enabledModules;
    const problem = moduleProblem(chosen, sortingStages);
    if (problem) throw new BadRequestException({ code: problem, message: MODULE_PROBLEMS[problem] });
    if (sortingStages >= 1 && !(await this.prisma.category.count({ where: { tenantId, isActive: true } }))) {
      await this.prisma.category.createMany({ data: KARACHI_CATEGORIES.map((name, i) => ({ tenantId, name, sortOrder: i, isActive: true })), skipDuplicates: true });
    }
    if (sortingStages === 2 && !(await this.prisma.grade.count({ where: { tenantId, isActive: true } }))) {
      await this.prisma.grade.createMany({ data: DEFAULT_GRADES.map((name, i) => ({ tenantId, name, rank: i + 1, isActive: true })), skipDuplicates: true });
    }
    const enabledModules = storedModules(sortingStages, chosen, tenant.enabledModules);
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: { sortingStages, enabledModules }, select: { sortingStages: true, enabledModules: true } });
    await this.audit.log({
      userId: actorId,
      tenantId,
      action: 'TENANT_WORKINGS_CHANGED',
      entityType: 'Tenant',
      entityId: tenantId,
      metadataJson: { before: { sortingStages: tenant.sortingStages, enabledModules: tenant.enabledModules }, after: updated, bySuperAdmin: true },
    });
    return updated;
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

export { localPhone };
