import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ViewsController, ViewsService } from './views';

@Module({
  imports: [CommonModule, AuditModule],
  controllers: [ListsController, ViewsController],
  providers: [ListsService, ViewsService],
  exports: [ListsService],
})
export class ListsModule {}
