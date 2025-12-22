import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';
import { TenantSequenceModule } from '../shared/tenant-sequence.module';

@Module({
  imports: [TenantSequenceModule],
  controllers: [RagController],
  providers: [RagService, CostAllocationService],
  exports: [RagService],
})
export class RagModule {}

