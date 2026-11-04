import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** v2 6.5: a business for a customer in under 2 minutes: business name, owner's name and phone. */
export class QuickCreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ownerName: string;

  /** Any local format, stored as E.164; the owner signs in with it and a PIN. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  ownerPhone: string;

  @IsEmail()
  @IsOptional()
  ownerEmail?: string;

  @IsIn(['ur', 'en'])
  @IsOptional()
  language?: 'ur' | 'en';

  /** 0 = trading only, 1 = category, 2 = category + grade. */
  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  sortingStages?: number;
}

export class SupportViewDto {
  /** Why support is opening the business (kept in the audit log). */
  @IsString()
  @IsOptional()
  @MaxLength(300)
  reason?: string;
}
