import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  location?: string;
}

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  location?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
