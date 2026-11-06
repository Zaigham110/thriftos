import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsIn } from 'class-validator';
import { TenantStatus } from '@prisma/client';
import { SUPPORTED_CURRENCY_CODES } from '../../common/currency/currency';

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  @IsIn(SUPPORTED_CURRENCY_CODES)
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  @IsIn(SUPPORTED_CURRENCY_CODES)
  currencyCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;

  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  /** The language the business opens in (Urdu or English). */
  @IsIn(['ur', 'en'])
  @IsOptional()
  defaultLanguage?: 'ur' | 'en';
}

