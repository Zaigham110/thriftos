import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, Min, MaxLength } from 'class-validator';

export class CreateContainerDto {
  @IsString()
  @IsNotEmpty()
  purchaseOrderId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  containerNumber: string;

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

  @IsNumber()
  @Min(0)
  grossWeight: number;

  @IsNumber()
  @Min(0)
  netWeight: number;
}

