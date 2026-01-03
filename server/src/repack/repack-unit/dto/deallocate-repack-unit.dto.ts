import { IsString } from 'class-validator';

export class DeallocateRepackUnitDto {
  @IsString()
  allocationId!: string;
}
