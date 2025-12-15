import { IsString, IsNotEmpty, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateRagDto {
  @IsString()
  @IsNotEmpty()
  containerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ragCode: string;

  @IsNumber()
  @Min(0.01)
  weightKg: number;
}

