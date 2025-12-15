import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InventoryStatus } from '@prisma/client';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { InventoryItemService } from './inventory-item.service';
import { AdjustInventoryDto, IntakeDto } from './dto';

@Controller('inventory')
@UseGuards(TenantGuard, PermissionGuard)
export class InventoryItemController {
  constructor(private readonly service: InventoryItemService) {}

  @Post('intake')
  @RequirePermissions('INVENTORY_INTAKE')
  @HttpCode(HttpStatus.CREATED)
  async intake(@Body() dto: IntakeDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.intake(tenantId, dto, user.userId);
  }

  @Get('items')
  @RequirePermissions('INVENTORY_VIEW')
  async findAll(
    @Query('categoryId') categoryId: string,
    @Query('gradeId') gradeId: string,
    @Query('warehouseId') warehouseId: string,
    @Query('status') status: InventoryStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { categoryId, gradeId, warehouseId, status, page, limit });
  }

  @Get('items/:id')
  @RequirePermissions('INVENTORY_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }

  @Post('items/:id/adjust')
  @RequirePermissions('INVENTORY_ADJUST')
  @HttpCode(HttpStatus.OK)
  async adjust(
    @Param('id') id: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.adjust(tenantId, id, dto, user.userId);
  }

  @Post('items/:id/reserve')
  @RequirePermissions('INVENTORY_RESERVE')
  @HttpCode(HttpStatus.OK)
  async reserve(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.reserve(tenantId, id, user.userId);
  }

  @Post('items/:id/release')
  @RequirePermissions('INVENTORY_RESERVE')
  @HttpCode(HttpStatus.OK)
  async release(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.release(tenantId, id, user.userId);
  }
}


