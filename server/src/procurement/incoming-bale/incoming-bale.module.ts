import { Module } from '@nestjs/common';
import { IncomingBaleController } from './incoming-bale.controller';
import { IncomingBaleService } from './incoming-bale.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';

@Module({
  controllers: [IncomingBaleController],
  providers: [IncomingBaleService, CostAllocationService],
  exports: [IncomingBaleService],
})
export class IncomingBaleModule {}

