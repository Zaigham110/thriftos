import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateGradeBucketDto {
  @IsString()
  @IsNotEmpty()
  gradeId: string;

  @IsNumber()
  @Min(0.0001)
  outputWeightKg: number;

  @IsInt()
  @Min(0)
  outputCount: number;
}


