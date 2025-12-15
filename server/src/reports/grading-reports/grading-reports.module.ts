import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { GradingReportsController } from './grading-reports.controller';
import { GradingReportsService } from './grading-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [GradingReportsController],
  providers: [GradingReportsService, ReportsAuditService],
})
export class GradingReportsModule {}


