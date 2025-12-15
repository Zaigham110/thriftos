import { Module } from '@nestjs/common';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, TenantBootstrapService],
  exports: [SuperAdminService, TenantBootstrapService],
})
export class SuperAdminModule {}

