import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { CostReportsController } from './cost-reports.controller';
import { CostReportsService } from './cost-reports.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CostReportsController],
  providers: [CostReportsService, ReportsAuditService, ReportsConsistencyService],
})
export class CostReportsModule {}


