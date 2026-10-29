import { ArrayContains, ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OperationMode, ConnectivityPolicy, CapturePolicy, GuidancePolicy } from '@prisma/client';
import { SUPPORTED_CURRENCY_CODES } from '../../common/currency/currency';

export const OPERATIONAL_MODULES = ['WORK', 'INTAKE', 'SORTING', 'REPACK', 'STOCK', 'SALES', 'INSIGHTS', 'ADMINISTRATION'] as const;

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

  @IsEnum(OperationMode)
  @IsOptional()
  operationMode?: OperationMode;

  @IsEnum(ConnectivityPolicy) @IsOptional() connectivityPolicy?: ConnectivityPolicy;
  @IsEnum(CapturePolicy) @IsOptional() capturePolicy?: CapturePolicy;
  @IsEnum(GuidancePolicy) @IsOptional() guidancePolicy?: GuidancePolicy;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayContains(['WORK'])
  @IsIn(OPERATIONAL_MODULES, { each: true })
  @IsOptional()
  operationalModules?: string[];

  @IsBoolean()
  @IsOptional()
  flowEnabled?: boolean;
}
