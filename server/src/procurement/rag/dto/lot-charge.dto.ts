import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const LOT_CHARGE_KINDS = ['TRANSPORT', 'LABOUR', 'LOADING', 'OTHER'] as const;
export type LotChargeKind = (typeof LOT_CHARGE_KINDS)[number];

/** A cost of bringing a loose lot in on top of its price (transport, labour…); part of the lot's cost. */
export class LotChargeDto {
  @IsIn(LOT_CHARGE_KINDS)
  kind!: LotChargeKind;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  note?: string;
}
