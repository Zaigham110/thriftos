import { IsInt, IsNumber, Min } from 'class-validator';

export class UpdateSortCategoryBucketDto {
  @IsNumber()
  @Min(0.0001)
  outputWeightKg: number;

  @IsInt()
  @Min(0)
  outputCount: number;
}


