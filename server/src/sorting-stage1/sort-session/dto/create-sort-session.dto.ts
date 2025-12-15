import { IsOptional, IsString } from 'class-validator';

export class CreateSortSessionDto {
  @IsString()
  @IsOptional()
  ragId?: string;

  @IsString()
  @IsOptional()
  incomingBaleId?: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}


