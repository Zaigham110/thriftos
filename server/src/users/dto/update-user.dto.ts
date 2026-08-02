import { IsString, IsOptional, MinLength, MaxLength, IsBoolean, IsEmail, IsEnum } from 'class-validator';
import { OperationMode } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(OperationMode)
  @IsOptional()
  preferredOperationMode?: OperationMode;
}
