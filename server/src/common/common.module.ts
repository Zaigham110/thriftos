import { Module } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard';
import { TenantGuard } from './guards/tenant.guard';
import { AuditModule } from '../audit/audit.module';

/**
 * CommonModule - Provides common guards for RBAC enforcement.
 * 
 * Guards:
 * - TenantGuard: Enforces tenant isolation, Super Admin impersonation
 * - PermissionGuard: Enforces permission-based access control (deny-by-default)
 * 
 * Both guards have security audit logging for denied access attempts.
 */
@Module({
  imports: [AuditModule],
  providers: [PermissionGuard, TenantGuard],
  exports: [PermissionGuard, TenantGuard],
})
export class CommonModule {}

