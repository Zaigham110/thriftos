import { MODULE_KEYS } from '../../common/modules/modules';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SUPPORTED_CURRENCY_CODES } from '../../common/currency/currency';
import { LANGUAGES, Language } from '../../common/language/language';

/** Modules a tenant can turn on. The first five are on by default; the rest are advanced. */
export const TENANT_MODULES = ['RECEIVE', 'STOCK', 'SELL', ...MODULE_KEYS, 'PAYROLL', 'BILLING'] as const;
/** Not part of v1: refused (403) unless the business turned them on. BILLING is read from the SYSTEM business. */
export const ADVANCED_MODULES = ['REPORTS', 'EXPORT', 'WAREHOUSES', 'PURCHASE_ORDERS', 'PAYROLL', 'BILLING'] as const;
export type TenantModule = (typeof TENANT_MODULES)[number];

/** The owner's own settings. Modules and how the business sorts are set by the super admin (v2 modules). */
export class UpdateTenantSettingsDto {
  @IsString()
  @IsOptional()
  @MaxLength(3)
  @IsIn(SUPPORTED_CURRENCY_CODES)
  currencyCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;

  @IsIn(LANGUAGES)
  @IsOptional()
  defaultLanguage?: Language;
}
