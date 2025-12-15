import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CreateRepackItemDto {
  /**
   * GradeOutput id (sourceType is always GRADE_OUTPUT in this phase).
   */
  @IsString()
  gradeOutputId: string;

  @IsNumber()
  @Min(0.0001)
  weightKg: number;

  @IsInt()
  @Min(0)
  pcsCount: number;
}


