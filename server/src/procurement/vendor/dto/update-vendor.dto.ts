import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  contactInfo?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
