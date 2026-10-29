import { IsOptional, IsString, IsNotEmpty, IsEnum, IsNumber, Min, MaxLength } from 'class-validator';
import { ChargeType } from '@prisma/client';

export class CreateContainerChargeDto {
  @IsEnum(ChargeType)
  chargeType: ChargeType;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

