import { ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SUPPORTED_CURRENCY_CODES } from '../../common/currency/currency';

/** Modules a tenant can turn on. The first five are on by default; the rest are advanced. */
export const TENANT_MODULES = ['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA', 'REPORTS', 'EXPORT', 'WAREHOUSES', 'PURCHASE_ORDERS', 'PAYROLL', 'BILLING'] as const;
/** Not part of v1: refused (403) unless the business turned them on. BILLING is read from the SYSTEM business. */
export const ADVANCED_MODULES = ['REPORTS', 'EXPORT', 'WAREHOUSES', 'PURCHASE_ORDERS', 'PAYROLL', 'BILLING'] as const;
export type TenantModule = (typeof TENANT_MODULES)[number];

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

  @IsArray()
  @ArrayUnique()
  @IsIn(TENANT_MODULES, { each: true })
  @IsOptional()
  enabledModules?: TenantModule[];

  /** 0 = trading only, 1 = category only, 2 = category + grade. */
  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  sortingStages?: number;

  @IsIn(['ur', 'en', 'roman'])
  @IsOptional()
  defaultLanguage?: string;
}
