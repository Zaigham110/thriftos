import { IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString, Min } from 'class-validator';
import { MeasurementType } from '@prisma/client';

export class AddSaleLineDto {
  @IsString()
  @IsNotEmpty()
  inventoryItemId: string;

  @IsEnum(MeasurementType)
  measurementType: MeasurementType;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}
