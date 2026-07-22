import { IsBoolean, IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { VendorType } from '@prisma/client';

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsEnum(VendorType)
  @IsOptional()
  vendorType?: VendorType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  contactInfo?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
