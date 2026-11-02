import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateMunshiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** Any local format; stored as E.164. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @Matches(/^\d{4,6}$/, { message: 'PIN is 4 to 6 digits' })
  pin: string;
}

export class SetPinDto {
  @Matches(/^\d{4,6}$/, { message: 'PIN is 4 to 6 digits' })
  pin: string;
}
