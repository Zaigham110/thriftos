import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { PurchaseOrderType } from '@prisma/client';

export class CreatePurchaseOrderDto {
  @IsEnum(PurchaseOrderType)
  poType: PurchaseOrderType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budgetCap?: number;

  @IsString()
  @IsOptional()
  vendorId?: string;
}

