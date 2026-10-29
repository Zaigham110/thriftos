import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** A new customer needs only a name. Phone is the WhatsApp number (any local format; stored as E.164). */
export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  city?: string;

  /** Udhaar carried from the old register (negative = advance). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  openingBalance?: number;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;

  @IsString() @MaxLength(200) @IsOptional() companyName?: string;
  @IsString() @MaxLength(500) @IsOptional() billingAddress?: string;
  @IsString() @MaxLength(500) @IsOptional() shippingAddress?: string;
  @IsEmail() @IsOptional() contactEmail?: string;
  @IsString() @MaxLength(50) @IsOptional() taxId?: string;
  @IsNumber() @Min(0) @IsOptional() creditLimit?: number;
}

export class UpdateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  name?: string;

  /** Empty string clears the number. */
  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;

  @IsString() @MaxLength(100) @IsOptional() city?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  openingBalance?: number;

  @IsString() @MaxLength(1000) @IsOptional() notes?: string;
  @IsString() @MaxLength(200) @IsOptional() companyName?: string;
  @IsString() @MaxLength(500) @IsOptional() billingAddress?: string;
  @IsString() @MaxLength(500) @IsOptional() shippingAddress?: string;
  @IsEmail() @IsOptional() contactEmail?: string;
  @IsString() @MaxLength(50) @IsOptional() taxId?: string;
  @IsNumber() @Min(0) @IsOptional() creditLimit?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

export class CustomersQueryDto {
  @IsString() @MaxLength(100) @IsOptional() search?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
