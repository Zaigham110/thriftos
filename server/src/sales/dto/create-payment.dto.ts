import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  method: string;
}
