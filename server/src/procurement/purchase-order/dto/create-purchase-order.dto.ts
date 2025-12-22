import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PurchaseOrderType } from '@prisma/client';

export class CreatePurchaseOrderDto {
  @IsEnum(PurchaseOrderType)
  poType: PurchaseOrderType;

  @IsString()
  @IsOptional()
  vendorId?: string;
}

