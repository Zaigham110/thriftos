import { IsString, IsNotEmpty, IsNumber, Min, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { RagBaleType } from '@prisma/client';

export class CreateRagDto {
  @IsString()
  @IsOptional()
  containerId?: string;

  @IsEnum(RagBaleType)
  @IsNotEmpty()
  ragBaleType: RagBaleType;

  @IsString()
  @IsNotEmpty()
  rawCategoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  weightKg: number;

  /** Price paid for a loose lot (no container). Container lots take a share of the landed cost. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchaseCost?: number;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

