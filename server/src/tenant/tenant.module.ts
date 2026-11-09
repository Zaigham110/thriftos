import { BusinessService } from './business.service';
import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { SetupService } from './setup.service';
import { DataExportService } from './data-export.service';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, UsersModule, AuditModule],
  controllers: [TenantController],
  providers: [TenantService, SetupService, DataExportService, BusinessService],
  exports: [TenantService],
})
export class TenantModule {}

