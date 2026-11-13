import { Type } from 'class-transformer';
import { LotChargeDto } from './lot-charge.dto';
import { IsString, IsNotEmpty, IsNumber, Min, MaxLength, IsOptional, IsEnum, IsDateString, IsArray, ArrayMaxSize, ValidateNested, IsInt } from 'class-validator';
import { PaymentMethod, RagBaleType } from '@prisma/client';

export class CreateRagDto {
  @IsString()
  @IsOptional()
  containerId?: string;

  @IsEnum(RagBaleType)
  @IsNotEmpty()
  ragBaleType: RagBaleType;

  /** Optional: defaults to the tenant's first raw category ("Mixed", created if missing). */
  @IsString()
  @IsOptional()
  rawCategoryId?: string;

  /** Kg of the lot. Optional only for a loose lot bought by the piece (`pieces`): it is then counted in pieces. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  weightKg?: number;

  /** Price paid for a loose lot (no container). Container lots take a share of the landed cost. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchaseCost?: number;

  @IsString()
  @IsOptional()
  vendorId?: string;

  /** Supplier khata: money handed to the supplier on the spot (the rest of the price stays owed). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  paidNow?: number;

  /** How it was paid (cash when left out). */
  @IsEnum(PaymentMethod)
  @IsOptional()
  paidMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  /** The day a loose lot was bought (lists and reports use it). Default: now. Not used for container lots. */
  @IsDateString()
  @IsOptional()
  receivedAt?: string;

  /** Loose lot: the rate per kg; without a price the price is kg × rate. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  ratePerKg?: number;

  /** Loose lot bought by the piece: how many pieces (also kept when the total was typed). */
  @IsInt()
  @Min(1)
  @IsOptional()
  pieces?: number;

  /** Loose lot bought by the piece: the rate per piece; without a price the price is pieces × rate. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  ratePerPiece?: number;

  /** Loose lot: transport, labour and other charges, part of its cost (on a change: the whole new list). */
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => LotChargeDto)
  @IsOptional()
  charges?: LotChargeDto[];
}
