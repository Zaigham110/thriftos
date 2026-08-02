import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength, MaxLength, IsArray, IsEnum } from 'class-validator';
import { OperationMode } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  roleIds?: string[];

  @IsEnum(OperationMode)
  @IsOptional()
  preferredOperationMode?: OperationMode;
}
