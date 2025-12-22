import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { RagBaleType } from '@prisma/client';

export class CreateRawCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(RagBaleType)
  @IsNotEmpty()
  rawType: RagBaleType;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRawCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
