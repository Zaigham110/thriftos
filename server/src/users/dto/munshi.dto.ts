import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

/** Team: fix a name or phone (v2 review: Settings). */
export class TeamDetailsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export class TeamRoleDto {
  @IsString() @IsNotEmpty() roleId!: string;
}

/** Team: someone who signs in with email (a first password is made for them). */
export class TeamPersonDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(200) email!: string;
  @IsString() @IsNotEmpty() roleId!: string;
}
