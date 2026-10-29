import { IsString, IsOptional, IsNumber, IsDateString, Min, MaxLength, Length, IsPositive } from 'class-validator';

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
}

