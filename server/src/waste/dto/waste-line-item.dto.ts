import { WasteStage, WasteUnitType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddWasteLineItemDto {
  @IsEnum(WasteStage)
  stage!: WasteStage;

  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  sortSessionId?: string;

  @IsOptional()
  @IsString()
  gradeSessionId?: string;
}

export class UpdateWasteLineItemDto {
  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export type WasteLineItemResponse = {
  id: string;
  stage: WasteStage;
  amount: string;
  unitType: WasteUnitType;
  estimatedValue: string;
  wasteCategory: { id: string; name: string; unitType: WasteUnitType; defaultResalePrice: string };
  createdAt: string;
  updatedAt: string;
};
