import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

/**
 * INVENTORY CONTROLLER - READ-ONLY
 * =================================
 * All endpoints are GET only.
 * NO POST, PATCH, DELETE.
 * Inventory is created automatically when repack units are sealed.
 */

@Controller('inventory')
@UseGuards(TenantGuard, PermissionGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * GET /inventory/summary
   * Returns KPIs and aggregates
   */
  @Get('summary')
  @RequirePermissions('INVENTORY_VIEW')
  async getSummary(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.inventoryService.getSummary(tenantId);
  }

  /**
   * GET /inventory/filter-options
   * Returns available categories, grades, warehouses for filtering
   */
  @Get('filter-options')
  @RequirePermissions('INVENTORY_VIEW')
  async getFilterOptions(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.inventoryService.getFilterOptions(tenantId);
  }

  /**
   * GET /inventory
   * List all inventory items with filters
   */
  @Get()
  @RequirePermissions('INVENTORY_VIEW')
  async findAll(
    @Query('categoryId') categoryId: string,
    @Query('gradeId') gradeId: string,
    @Query('warehouseId') warehouseId: string,
    @Query('status') status: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('query') query: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.inventoryService.findAll(tenantId, {
      categoryId,
      gradeId,
      warehouseId,
      status,
      fromDate,
      toDate,
      query,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /inventory/:id/traceability
   * Get full traceability chain
   */
  @Get(':id/traceability')
  @RequirePermissions('INVENTORY_VIEW')
  async getTraceability(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.inventoryService.getTraceability(tenantId, id);
  }

  /**
   * GET /inventory/:id
   * Get single inventory item detail
   */
  @Get(':id')
  @RequirePermissions('INVENTORY_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.inventoryService.findOne(tenantId, id);
  }
}
