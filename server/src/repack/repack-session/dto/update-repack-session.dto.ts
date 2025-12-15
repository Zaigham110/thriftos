import { IsOptional, IsString } from 'class-validator';

export class UpdateRepackSessionDto {
  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}


