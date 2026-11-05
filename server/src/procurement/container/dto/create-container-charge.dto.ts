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


/** Fix a charge typed wrong (v2 review): any of type, amount and note. */
export class UpdateContainerChargeDto {
  @IsEnum(ChargeType)
  @IsOptional()
  chargeType?: ChargeType;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amount?: number;
}
