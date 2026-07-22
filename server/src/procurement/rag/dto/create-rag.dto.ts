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

  @IsNumber()
  @Min(0.01)
  weightKg: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

