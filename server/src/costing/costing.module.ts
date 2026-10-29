import { Global, Module } from '@nestjs/common';
import { CostingService } from './costing.service';

/** Costing rules applied to stored data (recalculation down the cost chain). */
@Global()
@Module({
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
