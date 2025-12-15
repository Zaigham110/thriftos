import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class UpdatePurchaseOrderDto {
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

