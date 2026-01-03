import { IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AllocateRepackUnitRowDto {
  @IsString()
  gradingOutputId!: string;

  @IsNumber()
  @Min(0.01)
  amountUsed!: number;
}

export class AllocateRepackUnitDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocateRepackUnitRowDto)
  allocations!: AllocateRepackUnitRowDto[];
}
