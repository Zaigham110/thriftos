import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { MovementType } from '@prisma/client';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { StockMovementService } from './stock-movement.service';

@Controller('inventory')
@UseGuards(TenantGuard, PermissionGuard)
export class StockMovementController {
  constructor(private readonly service: StockMovementService) {}

  @Get('movements')
  @RequirePermissions('INVENTORY_VIEW')
  async findAll(
    @Query('inventoryItemId') inventoryItemId: string,
    @Query('movementType') movementType: MovementType,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { inventoryItemId, movementType, page, limit });
  }

  @Get('movements/:id')
  @RequirePermissions('INVENTORY_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }
}


