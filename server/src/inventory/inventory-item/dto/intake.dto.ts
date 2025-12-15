import { IsNotEmpty, IsString } from 'class-validator';

export class IntakeDto {
  @IsString()
  @IsNotEmpty()
  repackUnitId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;
}


