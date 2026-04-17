import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SUPPORTED_CURRENCY_CODES } from '../../common/currency/currency';

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
}
