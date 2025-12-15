import { IsOptional, IsString } from 'class-validator';

export class CreateRepackSessionDto {
  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}


