import { IsString, IsNumber, IsOptional, IsBoolean, Max, Min, ValidateIf } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  /** Usual kg of one bale (v2 6.6); null clears it. */
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  @Max(5000)
  baleWeightKg?: number | null;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /** Usual kg of one bale (v2 6.6); null clears it. */
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(1)
  @Max(5000)
  baleWeightKg?: number | null;
}
