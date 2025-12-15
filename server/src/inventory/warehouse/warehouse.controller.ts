import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { InventoryWarehouseService } from './warehouse.service';

@Controller('inventory/warehouses')
@UseGuards(TenantGuard, PermissionGuard)
export class InventoryWarehouseController {
  constructor(private readonly service: InventoryWarehouseService) {}

  @Get()
  @RequirePermissions('INVENTORY_VIEW')
  async list(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.list(tenantId);
  }
}


