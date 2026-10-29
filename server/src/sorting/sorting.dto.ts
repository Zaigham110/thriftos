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
  @IsOptional()
  ragId?: string;

  @IsString()
  @IsOptional()
  incomingBaleId?: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}

export class AddCategoryKgDto {
  @IsString()
  sessionId!: string;

  @IsString()
  categoryId!: string;

  @IsNumber()
  @IsPositive()
  amountKg!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  outputCount?: number;
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
