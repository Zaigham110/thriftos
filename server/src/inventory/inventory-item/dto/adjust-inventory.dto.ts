import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustInventoryDto {
  @IsNumber()
  @IsOptional()
  quantityKgDelta?: number;

  @IsInt()
  @IsOptional()
  quantityPcsDelta?: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}


