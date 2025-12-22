import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, Min, MaxLength } from 'class-validator';

export class CreateContainerDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderId: string;

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

  @IsNumber()
  @Min(0)
  grossWeight: number;

  @IsNumber()
  @Min(0)
  netWeight: number;

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

