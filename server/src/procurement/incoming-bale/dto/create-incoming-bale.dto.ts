import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateIncomingBaleDto {
  @IsString()
  @IsOptional()
  containerId?: string;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  baleCode: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  categoryGuess?: string;

  @IsNumber()
  @Min(0.01)
  weightKg: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number; // Only required for standalone bales (not linked to container)
}

