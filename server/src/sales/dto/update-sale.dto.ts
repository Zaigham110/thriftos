import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SaleType } from '@prisma/client';

export class UpdateSaleDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsEnum(SaleType)
  @IsOptional()
  type?: SaleType;
}
