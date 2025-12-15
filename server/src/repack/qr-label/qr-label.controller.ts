import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { QrLabelService } from './qr-label.service';

@Controller('repack')
@UseGuards(TenantGuard, PermissionGuard)
export class QrLabelController {
  constructor(private readonly service: QrLabelService) {}

  @Get('units/:id/qr')
  @RequirePermissions('REPACK_VIEW')
  async getUnitQr(@Param('id') unitId: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.getUnitQr(tenantId, unitId);
  }
}


