import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { CostAllocationService } from '../cost-allocation/cost-allocation.service';

@Module({
  controllers: [RagController],
  providers: [RagService, CostAllocationService],
  exports: [RagService],
})
export class RagModule {}

