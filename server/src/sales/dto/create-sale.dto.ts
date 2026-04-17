import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { SaleType } from '@prisma/client';

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsEnum(SaleType)
  type: SaleType;
}
