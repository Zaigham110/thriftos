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

  /** The owner signs in with this email and a first password made for them (v2). */
  @IsEmail()
  @MaxLength(200)
  ownerEmail: string;

  /** The owner's own phone (to reach them on WhatsApp); optional, not their login. */
  @IsString()
  @MaxLength(30)
  @IsOptional()
  ownerPhone?: string;

  @IsIn(LANGUAGES)
  @IsOptional()
  language?: Language;

  /** 0 = trading only, 1 = category, 2 = category + grade. */
  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  sortingStages?: number;

  /**
   * Phase 7: 'TRIAL' (default) starts the 14-day Workshop trial, the plan deciding the modules; 'NONE' sets the
   * business up by hand with `modules`, without a plan (no trial, never expires).
   */
  @IsIn(['TRIAL', 'NONE'])
  @IsOptional()
  plan?: 'TRIAL' | 'NONE';

  /** The modules it starts with when set up by hand (plan NONE; the everyday set if not given); `sortingStages` decides Sorting. */
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
