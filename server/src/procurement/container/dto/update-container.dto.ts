import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';
import { ContainerStatus } from '@prisma/client';

export class UpdateContainerDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  containerType?: string;

  @IsEnum(ContainerStatus)
  @IsOptional()
  status?: ContainerStatus;

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

  // Weighbridge Audit Scale Fields
  @IsNumber()
  @IsOptional()
  @Min(0)
  weighbridgeGrossWeight?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  weighbridgeTareWeight?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  fxRate?: number;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  originCountry?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  purchaseCost?: number;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  purchaseCurrency?: string;

  /** Invoice (net) kg. Changes only while none of its lots has started sorting. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @IsOptional()
  netWeightKg?: number;

  /** The container's date (arrived, or bought if still on the way). */
  @IsDateString()
  @IsOptional()
  receivedAt?: string;

  /** What is inside: changes the raw type of its lots that have not started sorting. */
  @IsString()
  @IsOptional()
  rawCategoryId?: string;
}
