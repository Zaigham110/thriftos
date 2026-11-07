import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { LANGUAGES, Language } from '../../common/language/language';

export class SetupMunshiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @Matches(/^\d{4,6}$/, { message: 'PIN is 4 to 6 digits' })
  pin: string;
}

/** Journey 8: everything the wizard asks, saved in one step. */
export class TenantSetupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName: string;

  @IsIn(['PKR', 'USD', 'AED'])
  currency: string;

  @IsIn(LANGUAGES)
  language: Language;

  /** 0 = sells as bought, 1 = sorts into categories, 2 = categories then grades. */
  @IsInt()
  @Min(0)
  @Max(2)
  sortingStages: number;

  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categories: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  grades: string[];

  @ValidateNested()
  @Type(() => SetupMunshiDto)
  @IsOptional()
  munshi?: SetupMunshiDto;
}
