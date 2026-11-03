import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/** "Payment received": who paid and how much. Method defaults to cash; a sale is optional (on account). */
export class CreatePaymentDto {
  @IsString()
  customerId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  /** Pay this sale first; anything over its due amount goes to the oldest debt. */
  @IsString()
  @IsOptional()
  saleId?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  reference?: string;

  @IsDateString()
  @IsOptional()
  receivedAt?: string;
}
