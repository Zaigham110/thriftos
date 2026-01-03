import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class Stage2StartDto {
  @IsString()
  categoryOutputId!: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  supervisorId?: string;
}

export class Stage2AllocateDto {
  @IsString()
  sessionId!: string;

  @IsString()
  gradeId!: string;

  @IsNumber()
  @Min(0)
  amountKg!: number;
}

export class Stage2AddWasteDto {
  @IsString()
  sessionId!: string;

  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class Stage2UpdateWasteDto {
  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class Stage2SealDto {
  @IsString()
  @IsOptional()
  wasteCategoryId?: string;
}
