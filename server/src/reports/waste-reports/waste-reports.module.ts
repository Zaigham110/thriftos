import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
import { WasteReportsController } from './waste-reports.controller';
import { WasteReportsService } from './waste-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WasteReportsController],
  providers: [WasteReportsService, ReportsAuditService, ReportsConsistencyService],
})
export class WasteReportsModule {}


