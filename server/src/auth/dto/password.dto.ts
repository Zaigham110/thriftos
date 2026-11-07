import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LANGUAGES, Language } from '../../common/language/language';

const MIN = 10;

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(MIN) @MaxLength(128) newPassword!: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(200) email!: string;
  /** Language of the email; the app sends the one in use. */
  @IsIn(LANGUAGES) @IsOptional() lang?: Language;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MinLength(MIN) @MaxLength(128) newPassword!: string;
}
