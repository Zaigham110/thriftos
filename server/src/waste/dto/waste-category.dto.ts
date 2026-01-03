import { WasteUnitType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateWasteCategoryDto {
  @IsString()
  name!: string;

  @IsEnum(WasteUnitType)
  unitType!: WasteUnitType;

  @IsNumber()
  @Min(0)
  defaultResalePrice!: number;
}

export class UpdateWasteCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(WasteUnitType)
  unitType?: WasteUnitType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultResalePrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
