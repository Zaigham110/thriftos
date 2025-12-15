import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateSortCategoryBucketDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @Min(0.0001)
  outputWeightKg: number;

  @IsInt()
  @Min(0)
  outputCount: number;
}


