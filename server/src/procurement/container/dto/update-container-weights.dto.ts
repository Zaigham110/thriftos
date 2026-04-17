import { IsNumber, Min } from 'class-validator';

export class UpdateContainerWeightsDto {
  @IsNumber()
  @Min(0)
  grossWeightKg: number;

  @IsNumber()
  @Min(0)
  tareWeightKg: number;
}
