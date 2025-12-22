import { IsString, IsOptional } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsString()
  @IsOptional()
  vendorId?: string;
}

