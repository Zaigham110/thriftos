import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength, MaxLength, IsArray } from 'class-validator';

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
}

