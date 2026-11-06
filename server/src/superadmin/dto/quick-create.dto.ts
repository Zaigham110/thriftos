import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  /** A business for trying ThriftOS out: it can get sample data and be deleted later (v2 review). */
  @IsBoolean()
  @IsOptional()
  isTest?: boolean;
}

/** Change a person's name or phone from the console (e.g. a typo in the owner's number). */
export class UpdatePersonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @IsOptional()
  phone?: string;
}

export class MarkTestDto {
  @IsBoolean()
  isTest: boolean;
}

/** Deleting a test business: its name typed again, as a check. */
export class DeleteBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  confirmName: string;
}

export class SupportViewDto {
  /** Why support is opening the business (kept in the audit log). */
  @IsString()
  @IsOptional()
  @MaxLength(300)
  reason?: string;
}
