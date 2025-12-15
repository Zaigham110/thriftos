import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, MaxLength } from 'class-validator';
import { PurchaseOrderType } from '@prisma/client';

export class CreatePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  poNumber: string;

  @IsEnum(PurchaseOrderType)
  poType: PurchaseOrderType;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalCost?: number;
}

