import { StockSource, StockUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AvailableStockQueryDto {
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() gradeId?: string;
}

/** One hand-picked source: a grade output (2-stage sorting) or a category output (1-stage). */
export class BaleAllocationDto {
  @IsString()
  @IsOptional()
  gradingOutputId?: string;

  @IsString()
  @IsOptional()
  categoryOutputId?: string;

  @IsNumber()
  @IsPositive()
  amountKg!: number;
}

export class MakeBaleDto {
  @IsString()
  categoryId!: string;

  /** Leave out for tenants that sort in one stage: the bale then comes from category outputs. */
  @IsString()
  @IsOptional()
  gradeId?: string;

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
  @IsEnum(StockSource) @IsOptional() source?: StockSource;
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

/** Journey 5: stock bought ready to sell. Needs a name or a category, a unit, how many and what it cost. */
export class ReceiveReadyStockDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() gradeId?: string;
  @IsString() @IsOptional() vendorId?: string;
  @IsString() @IsOptional() warehouseId?: string;

  @IsEnum(StockUnit)
  unit!: StockUnit;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  quantity!: number;

  /** What the whole quantity cost, in PKR. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalCost!: number;

  /** Total weight of bales or pieces, when known (KG stock weighs its quantity). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  weightKg?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  salePrice?: number;
}

export class PriceTierDto {
  /** Sale price of one piece in this tier. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsInt()
  @Min(1)
  pieces!: number;

  /** Defaults to the price, e.g. "300". */
  @IsString()
  @MaxLength(40)
  @IsOptional()
  label?: string;
}

export class OpenBaleDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  bales?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PriceTierDto)
  tiers!: PriceTierDto[];
}
