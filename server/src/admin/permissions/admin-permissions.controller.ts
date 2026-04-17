import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';




























import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { PermissionsService } from '../../permissions/permissions.service';

@Controller('admin/permissions')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminPermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('role.read')
  async list(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    void ((req as any).tenantId || user.tenantId);
    return this.permissionsService.findAll();
  }

  @Get('grouped')
  @RequirePermissions('role.read')
  async grouped(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    void ((req as any).tenantId || user.tenantId);
    return this.permissionsService.findByGroup();
  }
}
