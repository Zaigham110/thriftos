import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ProcurementDashboardController } from './procurement-dashboard.controller';
import { ProcurementDashboardService } from './procurement-dashboard.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ProcurementDashboardController],
  providers: [ProcurementDashboardService],
})
export class ProcurementDashboardModule {}
