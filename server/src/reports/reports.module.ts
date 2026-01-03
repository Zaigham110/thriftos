import { Module } from '@nestjs/common';
import { ProcurementReportsModule } from './procurement-reports/procurement-reports.module';
import { SortingReportsModule } from './sorting-reports/sorting-reports.module';
import { GradingReportsModule } from './grading-reports/grading-reports.module';
import { RepackReportsModule } from './repack-reports/repack-reports.module';
import { InventoryReportsModule } from './inventory-reports/inventory-reports.module';
import { WasteReportsModule } from './waste-reports/waste-reports.module';
import { WorkerReportsModule } from './worker-reports/worker-reports.module';
import { CostReportsModule } from './cost-reports/cost-reports.module';
import { DashboardReportsModule } from './dashboard-reports/dashboard-reports.module';

@Module({
  imports: [
    DashboardReportsModule,
    ProcurementReportsModule,
    SortingReportsModule,
    GradingReportsModule,
    RepackReportsModule,
    InventoryReportsModule,
    WasteReportsModule,
    WorkerReportsModule,
    CostReportsModule,
  ],
})
export class ReportsModule {}


