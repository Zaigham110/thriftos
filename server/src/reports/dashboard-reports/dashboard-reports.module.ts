import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { DashboardReportsController } from './dashboard-reports.controller';
import { DashboardReportsService } from './dashboard-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DashboardReportsController],
  providers: [DashboardReportsService, ReportsAuditService],
})
export class DashboardReportsModule {}
