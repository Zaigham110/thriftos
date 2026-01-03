import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { VendorModule } from './vendor/vendor.module';
import { ContainerModule } from './container/container.module';
import { RagModule } from './rag/rag.module';
import { IncomingBaleModule } from './incoming-bale/incoming-bale.module';
import { CostAllocationService } from './cost-allocation/cost-allocation.service';
import { ProcurementDashboardModule } from './dashboard/procurement-dashboard.module';

@Module({
  imports: [
    PurchaseOrderModule,
    VendorModule,
    ContainerModule,
    RagModule,
    IncomingBaleModule,
    ProcurementDashboardModule,
  ],
  providers: [CostAllocationService],
  exports: [CostAllocationService],
})
export class ProcurementModule {}

