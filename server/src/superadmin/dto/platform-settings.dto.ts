import { IsEmail, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Platform name and support contact (v2 review). Empty strings clear a field; the name cannot be cleared. */
export class PlatformSettingsDto {
  @IsString() @IsOptional() @MaxLength(80) platformName?: string;
  @IsString() @IsOptional() @MaxLength(30) supportPhone?: string;
  @ValidateIf((o) => !!o.supportEmail) @IsEmail() @IsOptional() @MaxLength(200) supportEmail?: string;
  @IsString() @IsOptional() @MaxLength(150) companyLegalName?: string;
}
