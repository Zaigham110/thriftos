import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { BillingPeriod, SubscriptionPaymentStatus } from '@prisma/client';
import { MODULE_KEYS } from '../common/modules/modules';
import { PAY_METHODS } from './billing.service';

export class SubmitPaymentDto {
  @IsString() planId!: string;
  @IsEnum(BillingPeriod) period!: BillingPeriod;
  @IsIn(PAY_METHODS) method!: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) monthlyPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) yearlyPrice?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsIn(MODULE_KEYS, { each: true }) modules?: string[];
  /** null = no limit. */
  @IsOptional() @ValidateIf((o: UpdatePlanDto) => o.maxUsers !== null) @IsInt() @Min(1) maxUsers?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetTenantPlanDto {
  /** null = no plan (set up by hand). */
  @IsOptional() @ValidateIf((o: SetTenantPlanDto) => o.planId !== null) @IsString() planId?: string | null;
  @IsOptional() @ValidateIf((o: SetTenantPlanDto) => o.trialEndsAt !== null) @IsDateString() trialEndsAt?: string | null;
  @IsOptional() @ValidateIf((o: SetTenantPlanDto) => o.paidUntil !== null) @IsDateString() paidUntil?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsIn(MODULE_KEYS, { each: true }) extraModules?: string[];
}

export class RejectPaymentDto {
  @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}

export class PaymentsQueryDto {
  @IsOptional() @Transform(({ value }) => (value === '' ? undefined : value)) @IsEnum(SubscriptionPaymentStatus) status?: SubscriptionPaymentStatus;
}

export class PayToDto {
  @IsOptional() @IsString() @MaxLength(100) accountTitle?: string;
  @IsOptional() @IsString() @MaxLength(100) jazzcash?: string;
  @IsOptional() @IsString() @MaxLength(100) easypaisa?: string;
  @IsOptional() @IsString() @MaxLength(300) bank?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
