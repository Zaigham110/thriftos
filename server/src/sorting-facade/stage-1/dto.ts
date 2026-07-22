import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class Stage1StartDto {
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

export class Stage1AllocateDto {
  @IsString()
  sessionId!: string;

  @IsString()
  categoryId!: string;

  @IsNumber()
  @Min(0)
  amountKg!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  outputCount?: number;
}

export class Stage1AddWasteDto {
  @IsString()
  sessionId!: string;

  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class Stage1UpdateWasteDto {
  @IsString()
  wasteCategoryId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class Stage1SealDto {
  @IsString()
  @IsOptional()
  wasteCategoryId?: string;
}
