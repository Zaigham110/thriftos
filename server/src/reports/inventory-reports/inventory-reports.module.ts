import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { InventoryReportsController } from './inventory-reports.controller';
import { InventoryReportsService } from './inventory-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InventoryReportsController],
  providers: [InventoryReportsService, ReportsAuditService],
})
export class InventoryReportsModule {}


