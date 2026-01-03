import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ReportsAuditService } from '../common/reports-audit.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
import { RepackReportsController } from './repack-reports.controller';
import { RepackReportsService } from './repack-reports.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RepackReportsController],
  providers: [RepackReportsService, ReportsAuditService, ReportsConsistencyService],
})
export class RepackReportsModule {}


