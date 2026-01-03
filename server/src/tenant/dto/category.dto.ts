import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
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
}
