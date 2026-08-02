import { IsEnum, IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MeasurementType } from '@prisma/client';

export class ManualAllocationDto {
  @IsString()
  gradingOutputId: string;

  @IsNumber()
  @Min(0.01)
  amountUsed: number;
}

export class CreateRepackUnitV2Dto {
  /** Optional explicit OPEN session when an operator resumes work. */
  @IsOptional()
  @IsString()
  repackSessionId?: string;

  @IsString()
  categoryId: string;

  @IsString()
  gradeId: string;

  @IsEnum(MeasurementType)
  measurementType: MeasurementType;

  @IsNumber()
  @Min(0.01)
  targetAmount: number;

  // allocationMode removed - always MANUAL now (FIFO deleted)

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationDto)
  manualAllocations?: ManualAllocationDto[];
}
