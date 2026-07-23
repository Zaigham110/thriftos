import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLimit?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  creditStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currencyCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  bankName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  swiftBic?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
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

  @IsNumber()
  @IsOptional()
  @Min(0)
  creditLimit?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  creditStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currencyCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  bankName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  swiftBic?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
