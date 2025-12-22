import { IsString, IsNotEmpty, IsOptional, IsEnum, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Company code must be uppercase alphanumeric with underscores or hyphens',
  })
  companyCode: string;

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

  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  adminName?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  @MaxLength(128)
  adminPassword?: string;
}

