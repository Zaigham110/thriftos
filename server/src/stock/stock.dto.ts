import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min, ValidateNested } from 'class-validator';

export class AvailableStockQueryDto {
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() gradeId?: string;
}

export class BaleAllocationDto {
  @IsString()
  gradingOutputId!: string;

  @IsNumber()
  @IsPositive()
  amountKg!: number;
}

export class MakeBaleDto {
  @IsString()
  categoryId!: string;

  @IsString()
  gradeId!: string;

  @IsNumber()
  @IsPositive()
  weightKg!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pieces?: number;

  /** Advanced: pick the graded stock by hand instead of FIFO. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BaleAllocationDto)
  @IsOptional()
  allocations?: BaleAllocationDto[];

  @IsString()
  @IsOptional()
  warehouseId?: string;
}

export class StockItemsQueryDto {
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() gradeId?: string;
  @IsString() @IsOptional() warehouseId?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() fromDate?: string;
  @IsString() @IsOptional() toDate?: string;
  @IsString() @IsOptional() query?: string;

  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(200) @IsOptional() limit?: number;
}
