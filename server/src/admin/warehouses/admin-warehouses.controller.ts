import { RequireModule } from '../../common/decorators/require-module.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { TenantService } from '../../tenant/tenant.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from '../../tenant/dto/warehouse.dto';


// Godowns are part of every business (stock transfers, enterprise E3.3), not an optional module.
@Controller('admin/warehouses')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminWarehousesController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @RequirePermissions('warehouse.read')
  async listAll(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getAllWarehouses(tenantId);
  }

  @Get(':id')
  @RequirePermissions('warehouse.read')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getWarehouse(tenantId, id);
  }

  @Post()
  @RequireModule('WAREHOUSES')
  @RequirePermissions('warehouse.create')
  async create(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.createWarehouse(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('warehouse.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateWarehouse(tenantId, id, dto);
  }

  @Patch(':id/default')
  @RequirePermissions('warehouse.update')
  async setDefault(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.setDefaultWarehouse(tenantId, id);
  }

  @Delete(':id')
  @RequirePermissions('warehouse.delete')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.deleteWarehouse(tenantId, id);
  }
}
