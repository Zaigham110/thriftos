import { PaymentMethod, PaymentMode, SaleType, StockUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsBoolean, IsIn, ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
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

/** An export sale's shipment: where it goes and on what (for the packing list and commercial invoice). */
export class ShipmentDto {
  @IsString() @MaxLength(80) @IsOptional() destinationCountry?: string;
  @IsString() @MaxLength(80) @IsOptional() portOfLoading?: string;
  @IsString() @MaxLength(80) @IsOptional() portOfDischarge?: string;
  @IsString() @MaxLength(80) @IsOptional() vesselName?: string;
  @IsString() @MaxLength(60) @IsOptional() billOfLadingNumber?: string;
  @IsString() @MaxLength(60) @IsOptional() containerSealNumber?: string;
  @IsString() @MaxLength(120) @IsOptional() freightForwarder?: string;
}

/** Changing a sale's shipment later; `makeExport` turns a local sale into an export sale (Export sales on). */
export class SetShipmentDto extends ShipmentDto {
  @IsBoolean() @IsOptional() makeExport?: boolean;
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

  /** Phase 9.2: the shipment of an export sale (kept only when `type` is EXPORT). */
  @ValidateNested()
  @Type(() => ShipmentDto)
  @IsOptional()
  shipment?: ShipmentDto;
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
