import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateGradeBucketDto {
  @IsString()
  @IsNotEmpty()
  gradeId: string;

  @IsNumber()
  @Min(0.0001)
  outputWeightKg: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  outputCount?: number;
}


