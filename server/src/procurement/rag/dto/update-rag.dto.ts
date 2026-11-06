import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Corrections to a lot. Weight and raw category only before sorting; price, supplier and date only for loose lots. */
export class UpdateRagDto {
  @IsString()
  @IsOptional()
  rawCategoryId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  weightKg?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchaseCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsDateString()
  @IsOptional()
  receivedAt?: string;
}
