import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsString, IsOptional, IsNumber, IsDateString, Min, MaxLength, Length, IsPositive, ValidateNested } from 'class-validator';
import { ChargeType } from '@prisma/client';

/** A charge saved with the container (Journey 1: duty, clearing, freight... in PKR). */
export class ContainerChargeLineDto {
  @IsEnum(ChargeType)
  chargeType: ChargeType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class CreateContainerDto {
  /** A container comes from a supplier (vendorId) or, for advanced users, a purchase order. */
  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  purchaseOrderId?: string;

  /** Your own container number; generated (CONT-001) when left empty. */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  containerNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  originCountry?: string;

  /** Purchase price in purchaseCurrency. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchaseCost?: number;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  purchaseCurrency?: string;

  /** PKR per 1 unit of purchaseCurrency (ignored for PKR). */
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @IsOptional()
  fxRate?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  containerType?: string; // 20ft, 40ft, 40HC, etc.

  @IsDateString()
  @IsOptional()
  eta?: string;

  @IsDateString()
  @IsOptional()
  etd?: string;

  @IsDateString()
  @IsOptional()
  arrivedAt?: string;

  @IsDateString()
  @IsOptional()
  clearedAt?: string;

  @IsDateString()
  @IsOptional()
  releasedAt?: string;

  /** Defaults to the invoice (net) weight. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  grossWeightKg?: number;

  /** Invoice weight. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  netWeightKg: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tareWeightKg?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  billOfLadingNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  shipmentReference?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  shippingLine?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  vesselName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  portOfLoading?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  portOfDischarge?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  forwarder?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  /** Kanta (weighbridge) weight in kg, if weighed. Kept next to the invoice weight; the difference is shown. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  weighbridgeKg?: number;

  /** Charges saved in the same step. More can be added later. */
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContainerChargeLineDto)
  @IsOptional()
  charges?: ContainerChargeLineDto[];

  /** Also record the whole container as one lot, ready to sort (the phone's "Maal aya → Container"). */
  @IsBoolean()
  @IsOptional()
  withLot?: boolean;

  /** Arrived (the usual case when receiving) or still on the way. Without it a container starts on the way. */
  @IsIn(['IN_TRANSIT', 'ARRIVED'])
  @IsOptional()
  status?: 'IN_TRANSIT' | 'ARRIVED';

  /** The container's date (arrived, or bought if still on the way): lists and reports use it. Default: now. */
  @IsDateString()
  @IsOptional()
  receivedAt?: string;

  /** What is inside (raw type) for the lot made with `withLot`. Default: the business's default raw type. */
  @IsString()
  @IsOptional()
  rawCategoryId?: string;
}
