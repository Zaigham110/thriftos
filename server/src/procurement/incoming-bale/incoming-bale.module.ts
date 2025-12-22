import { Module } from '@nestjs/common';
import { IncomingBaleController } from './incoming-bale.controller';
import { IncomingBaleService } from './incoming-bale.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { TenantSequenceModule } from '../shared/tenant-sequence.module';

@Module({
  imports: [TenantSequenceModule],
  controllers: [IncomingBaleController],
  providers: [IncomingBaleService, CostAllocationService],
  exports: [IncomingBaleService],
})
export class IncomingBaleModule {}

