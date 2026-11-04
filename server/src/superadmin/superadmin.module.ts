import { Module } from '@nestjs/common';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { OnboardingService } from './onboarding.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, TenantBootstrapService, OnboardingService],
  exports: [SuperAdminService, TenantBootstrapService],
})
export class SuperAdminModule {}

