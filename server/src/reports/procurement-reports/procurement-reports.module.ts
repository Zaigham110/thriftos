import { Module } from '@nestjs/common';
import { ProcurementReportsController } from './procurement-reports.controller';
import { ProcurementReportsService } from './procurement-reports.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ProcurementReportsController],
  providers: [ProcurementReportsService, ReportsAuditService],
})
export class ProcurementReportsModule {}


