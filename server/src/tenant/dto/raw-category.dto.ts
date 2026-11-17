import { IsBoolean, IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
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

  /** Whether it comes in bales, loose or both (v2 review: a change was refused). */
  @IsEnum(RagBaleType)
  @IsOptional()
  rawType?: RagBaleType;

  /** Turned off: kept on the lots that used it, offered nowhere. */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
