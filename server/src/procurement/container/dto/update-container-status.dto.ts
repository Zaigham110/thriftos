import { IsEnum } from 'class-validator';
import { ContainerStatus } from '@prisma/client';

export class UpdateContainerStatusDto {
  @IsEnum(ContainerStatus)
  status: ContainerStatus;
}

