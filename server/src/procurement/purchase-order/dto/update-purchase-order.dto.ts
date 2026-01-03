import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budgetCap?: number;
}

