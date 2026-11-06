import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { CommonModule } from '../common/common.module';
import { ListsModule } from '../lists/lists.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRecordsService } from './records.service';
import { StockRecordsService } from './stock-records.service';
import { ReceivablesService } from './receivables.service';
import { SortingRecordsService } from './sorting-records.service';
import { FinanceService } from './finance.service';
import { PriceListsService } from './price-lists.service';
import { AnalyticsService } from './analytics.service';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [CommonModule, ListsModule, SalesModule, StockModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceRecordsService, StockRecordsService, ReceivablesService, SortingRecordsService, FinanceService, PriceListsService, AnalyticsService],
})
export class WorkspaceModule {}
