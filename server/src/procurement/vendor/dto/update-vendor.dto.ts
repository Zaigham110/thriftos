import { IsString, IsOptional, MaxLength, IsEnum, IsBoolean } from 'class-validator';
import { VendorType } from '@prisma/client';

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  companyName?: string;

  @IsEnum(VendorType)
  @IsOptional()
  vendorType?: VendorType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  /** Default origin for this supplier's containers (e.g. USA, UK, Korea). */
  @IsString()
  @IsOptional()
  @MaxLength(60)
  originCountry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  contactPerson?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  contactEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contactPhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  contactInfo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultCurrency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  remittanceAccount?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  physicalAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
