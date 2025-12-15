import { Module } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  providers: [PermissionGuard, TenantGuard],
  exports: [PermissionGuard, TenantGuard],
})
export class CommonModule {}

