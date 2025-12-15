import { IsString, IsOptional, IsNumber, IsDateString, Min, MaxLength } from 'class-validator';

export class UpdateContainerDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  containerType?: string;

  @IsDateString()
  @IsOptional()
  eta?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  grossWeight?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  netWeight?: number;
}

