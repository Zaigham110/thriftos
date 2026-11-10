import { BadRequestException, Injectable } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { isModuleKey } from '../common/modules/modules';
import { LANGUAGES } from '../common/language/language';
import { localPhone, toE164 } from '../common/phone/phone';
import { businessContact } from './business';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SUPPORTED_CURRENCY_CODES } from '../common/currency/currency';
import { TenantService } from './tenant.service';

export class BusinessDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  /** Empty clears it. */
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsIn(SUPPORTED_CURRENCY_CODES) currency?: string;
  @IsOptional() @IsIn(LANGUAGES) language?: string;
}

/** Errors with a code the app shows in the owner's language. */
const err = (code: string, message: string) => new BadRequestException({ code, message });


/**
 * Settings → Business (v2 review): one plain page instead of the setup wizard. Name, phone, address and city (on
 * bills), currency (fixed once money is recorded), the business's language, and how it works (sorting).
 */
@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string) {
    const [t, currencyLocked, categories, grades] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, phone: true, address: true, city: true, currency: true, defaultLanguage: true, sortingStages: true, enabledModules: true } }),
      this.tenants.isCurrencyLocked(tenantId),
      this.prisma.category.count({ where: { tenantId, isActive: true } }),
      this.prisma.grade.count({ where: { tenantId, isActive: true } }),
    ]);
    return {
      name: t.name, phone: t.phone ? localPhone(t.phone) : '', address: t.address ?? '', city: t.city ?? '',
      currency: t.currency, currencyLocked, language: t.defaultLanguage, sortingStages: t.sortingStages,
      /** What the super admin turned on (read-only here). */
      modules: t.enabledModules.filter(isModuleKey),
      categories, grades, contact: businessContact(t),
    };
  }

  async save(tenantId: string, dto: BusinessDto, userId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const data: Record<string, unknown> = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    const set = (key: string, from: unknown, to: unknown) => {
      if (to === undefined || from === to) return;
      data[key] = to;
      changed[key] = { from, to };
    };
    if (dto.name !== undefined) set('name', t.name, dto.name.trim());
    if (dto.phone !== undefined) {
      const raw = dto.phone.trim();
      const phone = raw ? toE164(raw) : null;
      if (raw && !phone) throw err('PHONE_INVALID', 'Enter a valid phone number, e.g. 0300 1234567');
      set('phone', t.phone, phone);
    }
    if (dto.address !== undefined) set('address', t.address, dto.address.trim() || null);
    if (dto.city !== undefined) set('city', t.city, dto.city.trim() || null);
    if (dto.currency !== undefined && dto.currency !== t.currency) {
      if (await this.tenants.isCurrencyLocked(tenantId)) throw err('CURRENCY_LOCKED', 'The currency cannot change after money has been recorded.');
      set('currency', t.currency, dto.currency);
    }
    if (dto.language !== undefined) set('defaultLanguage', t.defaultLanguage, dto.language);
    if (Object.keys(changed).length) {
      await this.prisma.tenant.update({ where: { id: tenantId }, data });
      await this.audit.log({ tenantId, userId, action: 'BUSINESS_UPDATED', entityType: 'Tenant', entityId: tenantId, metadataJson: changed as never });
    }
    return this.get(tenantId);
  }
}
