import { IsString, IsOptional } from 'class-validator';

export class SealRepackUnitV3Dto {
  @IsString()
  @IsOptional()
  warehouseId?: string;
}
