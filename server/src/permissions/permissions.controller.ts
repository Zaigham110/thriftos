import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

/**
 * PermissionsController - Lists all permissions in the system.
 * 
 * Security: TenantGuard + PermissionGuard applied.
 * Requires 'role.read' permission since viewing permissions is only
 * needed by users who manage roles/permissions (typically admins).
 */
@Controller('permissions')
@UseGuards(TenantGuard, PermissionGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('role.read')
  async findAll() {
    return this.permissionsService.findAll();
  }

  @Get('grouped')
  @RequirePermissions('role.read')
  async findByGroup() {
    return this.permissionsService.findByGroup();
  }
}

