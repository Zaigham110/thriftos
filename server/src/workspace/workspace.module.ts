import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ListsModule } from '../lists/lists.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRecordsService } from './records.service';
import { StockRecordsService } from './stock-records.service';

@Module({
  imports: [CommonModule, ListsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceRecordsService, StockRecordsService],
})
export class WorkspaceModule {}
