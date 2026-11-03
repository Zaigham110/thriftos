import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;
}

export class UpdateGradeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
