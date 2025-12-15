import { IsString, IsNotEmpty, IsEnum, IsNumber, Min, MaxLength } from 'class-validator';
import { ChargeType } from '@prisma/client';

export class CreateContainerChargeDto {
  @IsEnum(ChargeType)
  chargeType: ChargeType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

