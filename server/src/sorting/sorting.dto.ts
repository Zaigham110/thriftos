import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class PageQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class LotQueueQueryDto extends PageQueryDto {
  @IsIn(['NOT_STARTED', 'IN_SORTING', 'SORTED'])
  @IsOptional()
  status?: 'NOT_STARTED' | 'IN_SORTING' | 'SORTED';
}

export class StartSortDto {
  @IsString()
  ragId!: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}

/**
 * One sorting entry (v2 6.6): a category, its grade when the business grades, and either loose kg (`amountKg`) or
 * `bales` of `baleWeightKg` each — bales go straight into stock with a QR sticker.
 */
export class AddCategoryKgDto {
  @IsString()
  sessionId!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  @IsOptional()
  gradeId?: string;

  /** Loose kg. Leave out when entering bales. */
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amountKg?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  bales?: number;

  @IsNumber()
  @IsPositive()
  @Max(5000)
  @IsOptional()
  baleWeightKg?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  outputCount?: number;

  /**
   * Pieces (owner, 2026-11-11). A lot bought by the piece is sorted in pieces: the entry's kg is worked out from the
   * lot's kg per piece, so its cost is its share of the pieces. In a lot bought by kg it is the count of the kg entered.
   */
  @IsInt()
  @Min(1)
  @Max(1000000)
  @IsOptional()
  pieces?: number;

  /** Phase 8: the worker who sorted it (sorter pay, kg per worker per day). */
  @IsString()
  @IsOptional()
  workerId?: string;
}

export class StartGradingDto {
  @IsString()
  categoryOutputId!: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}

export class AddGradeKgDto {
  @IsString()
  sessionId!: string;

  @IsString()
  gradeId!: string;

  @IsNumber()
  @IsPositive()
  amountKg!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  outputCount?: number;
}

export class AddWasteDto {
  @IsString()
  sessionId!: string;

  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class UpdateWasteDto {
  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class CloseSessionDto {
  @IsString()
  @IsOptional()
  wasteCategoryId?: string;
}

export class OutputsQueryDto extends PageQueryDto {
  @IsString() @IsOptional() gradeSessionId?: string;
  @IsString() @IsOptional() gradeId?: string;
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() search?: string;
  @IsString() @IsOptional() ragCode?: string;
  @IsString() @IsOptional() containerNumber?: string;
}
