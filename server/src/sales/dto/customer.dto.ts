import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  billingAddress: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  shippingAddress: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contactPhone: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxId?: string;
}

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  companyName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  billingAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  shippingAddress?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contactPhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
