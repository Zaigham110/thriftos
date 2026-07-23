import { IsString, IsOptional, IsDateString, IsNumber, MaxLength, Min, IsEnum } from 'class-validator';
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
}
