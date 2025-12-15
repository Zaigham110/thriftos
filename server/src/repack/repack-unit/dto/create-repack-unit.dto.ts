import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UnitType } from '@prisma/client';

export class CreateRepackUnitDto {
  @IsEnum(UnitType)
  unitType: UnitType;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  gradeId?: string;

  @IsNumber()
  @Min(0.0001)
  weightKg: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pcsCount?: number;
}


