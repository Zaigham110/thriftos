import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { LANGUAGES, Language } from '../../common/language/language';
import { MODULE_KEYS, ModuleKey } from '../../common/modules/modules';
import { SUPPORTED_CURRENCY_CODES } from '../../common/currency/currency';

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

  @IsIn(LANGUAGES)
  @IsOptional()
  language?: Language;

  /** 0 = trading only, 1 = category, 2 = category + grade. */
  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  sortingStages?: number;

  /** The modules it starts with (the everyday set if not given); `sortingStages` decides Sorting. */
  @IsArray()
  @ArrayUnique()
  @IsIn(MODULE_KEYS, { each: true })
  @IsOptional()
  modules?: ModuleKey[];

  /** A business for trying ThriftOS out: it can get sample data and be deleted later (v2 review). */
  @IsBoolean()
  @IsOptional()
  isTest?: boolean;

  @IsIn(SUPPORTED_CURRENCY_CODES)
  @IsOptional()
  currency?: string;

  /** The business's own phone, address and city (on its bills); the owner can change them in Settings. */
  @IsString()
  @MaxLength(30)
  @IsOptional()
  businessPhone?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  address?: string;

  @IsString()
  @MaxLength(60)
  @IsOptional()
  city?: string;
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

/** How a business works (v2 review): its type (how it sorts) and the modules it has on. */
export class WorkingsDto {
  /** 0 = trading only, 1 = sorts into categories, 2 = categories then grades. */
  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  sortingStages?: number;

  @IsArray()
  @ArrayUnique()
  @IsIn(MODULE_KEYS, { each: true })
  @IsOptional()
  modules?: ModuleKey[];
}
