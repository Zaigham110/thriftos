import { Type } from 'class-transformer';
import { LotChargeDto } from './lot-charge.dto';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';

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

  /** Loose lot: the rate per kg; without a price the price is kg × rate. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  ratePerKg?: number;

  /** Loose lot: transport, labour and other charges, part of its cost (on a change: the whole new list). */
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => LotChargeDto)
  @IsOptional()
  charges?: LotChargeDto[];
}
