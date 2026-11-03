import { Module } from '@nestjs/common';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { VendorModule } from './vendor/vendor.module';
import { ContainerModule } from './container/container.module';
import { RagModule } from './rag/rag.module';
import { ProcurementDashboardModule } from './dashboard/procurement-dashboard.module';

@Module({
  imports: [
    PurchaseOrderModule,
    VendorModule,
    ContainerModule,
    RagModule,
    ProcurementDashboardModule,
  ],
})
export class ProcurementModule {}

