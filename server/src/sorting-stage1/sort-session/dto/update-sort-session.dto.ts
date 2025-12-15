import { IsOptional, IsString } from 'class-validator';

export class UpdateSortSessionDto {
  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}


