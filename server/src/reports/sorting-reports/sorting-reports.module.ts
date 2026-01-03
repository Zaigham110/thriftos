import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
import { SortingReportsController } from './sorting-reports.controller';
import { SortingReportsService } from './sorting-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SortingReportsController],
  providers: [SortingReportsService, ReportsAuditService, ReportsConsistencyService],
})
export class SortingReportsModule {}


