import { Module } from '@nestjs/common';
import { ContainerController } from './container.controller';
import { ContainerService } from './container.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';

@Module({
  controllers: [ContainerController],
  providers: [ContainerService, CostAllocationService],
  exports: [ContainerService],
})
export class ContainerModule {}

