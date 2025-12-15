import { IsOptional, IsString } from 'class-validator';

export class CreateGradeSessionDto {
  @IsString()
  categoryOutputId: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}


