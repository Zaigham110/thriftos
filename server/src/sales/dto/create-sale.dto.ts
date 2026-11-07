import { PaymentMethod, PaymentMode, SaleType, StockUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsIn, ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { LANGUAGES, Language } from '../../common/language/language';

export class SaleLineDto {
  @IsString()
  inventoryItemId!: string;

  /** What the price is per. Defaults to the item's unit; a bale can also be sold by kg. */
  @IsEnum(StockUnit)
  @IsOptional()
  unit?: StockUnit;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

/** Journey 4: customer, items, how they paid. Saved complete in one request. */
export class CreateSaleDto {
  @IsString()
  customerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];

  /** CASH = paid in full now, CREDIT = udhaar, PARTIAL = `paidAmount` now and the rest on udhaar. */
  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  paidAmount?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  paymentReference?: string;

  @IsEnum(SaleType)
  @IsOptional()
  type?: SaleType;
}

export class LastPriceQueryDto {
  @IsString()
  customerId!: string;

  @IsString()
  inventoryItemId!: string;

  @IsEnum(StockUnit)
  @IsOptional()
  unit?: StockUnit;
}

export class FulfillSaleDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  fulfillmentReference?: string;
}

export class LanguageQueryDto {
  @IsIn(LANGUAGES)
  @IsOptional()
  lang?: Language;
}
