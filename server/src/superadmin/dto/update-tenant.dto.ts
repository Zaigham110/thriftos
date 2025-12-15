import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;

  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;
}

