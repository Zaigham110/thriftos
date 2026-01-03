/**
 * DTOs for Mixed-Source Repack v2
 * 
 * These DTOs enforce the business rules for FIFO and Manual allocation modes.
 */

import { IsEnum, IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { AllocationMode, MeasurementType } from '@prisma/client';

/**
 * Manual allocation input (used in MANUAL mode)
 */
export class ManualAllocationInputDto {
  @IsUUID()
  gradingOutputId: string;

  @IsNumber()
  @Min(0.01)
  amountUsed: number;
}

/**
 * Create Repack Unit DTO
 */
export class CreateRepackUnitDto {
  @IsString()
  repackSessionId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;

  @IsEnum(MeasurementType)
  measurementType: MeasurementType;

  @IsNumber()
  @Min(0.01)
  targetAmount: number;

  @IsEnum(AllocationMode)
  allocationMode: AllocationMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationInputDto)
  manualAllocations?: ManualAllocationInputDto[];
}

/**
 * Update Repack Unit DTO (only allowed in DRAFT status)
 */
export class UpdateRepackUnitDto {
  @IsOptional()
  @IsEnum(MeasurementType)
  measurementType?: MeasurementType;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  targetAmount?: number;

  @IsOptional()
  @IsEnum(AllocationMode)
  allocationMode?: AllocationMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationInputDto)
  manualAllocations?: ManualAllocationInputDto[];
}

/**
 * Seal Repack Unit DTO (moves from DRAFT to SEALED)
 */
export class SealRepackUnitDto {
  // No fields needed - sealing is a state transition
}

/**
 * Query DTOs for available stock
 */
export class GetAvailableStockQueryDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  gradeId: string;

  @IsEnum(MeasurementType)
  measurementType: MeasurementType;
}
