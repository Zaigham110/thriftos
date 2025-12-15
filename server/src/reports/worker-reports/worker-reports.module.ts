import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { WorkerReportsController } from './worker-reports.controller';
import { WorkerReportsService } from './worker-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WorkerReportsController],
  providers: [WorkerReportsService, ReportsAuditService],
})
export class WorkerReportsModule {}


