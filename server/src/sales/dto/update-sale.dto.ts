import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SaleType } from '@prisma/client';

export class UpdateSaleDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(SaleType)
  @IsOptional()
  type?: SaleType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  billOfLadingNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  containerSealNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  vesselName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  portOfLoading?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  portOfDischarge?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  freightForwarder?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  destinationCountry?: string;
}
