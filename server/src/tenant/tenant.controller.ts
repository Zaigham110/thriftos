import { Controller, Get, Post, Put, Patch, Delete, UseGuards, Req, Query, Body, Param } from '@nestjs/common';
import { Request } from 'express';
import { TenantService } from './tenant.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { RequirePermissions, SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';

/**
 * TenantController - Returns current tenant information and lookup data.
 * 
 * Security: TenantGuard + PermissionGuard applied.
 * Uses SkipPermissionCheck since these are basic lookups needed by all 
 * authenticated users for dropdowns, filters, and tenant context.
 * This is not sensitive data - just categories, grades, warehouses, and stats.
 */
@Controller('tenant')
@UseGuards(TenantGuard, PermissionGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @SkipPermissionCheck()
  async getCurrentTenant(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.findOne(tenantId);
  }

  @Get('work-queue')
  @SkipPermissionCheck()
  async getWorkQueue(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getWorkQueue(tenantId, user.userId);
  }

  @Patch('settings')
  @RequirePermissions('tenant.update')
  async updateTenantSettings(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateSettings(tenantId, dto, user.userId);
  }

  @Get('categories')
  @SkipPermissionCheck()
  async getCategories(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getCategories(tenantId);
  }

  @Get('categories/all')
  @RequirePermissions('category.read')
  async getAllCategories(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getAllCategories(tenantId);
  }

  @Post('categories')
  @RequirePermissions('category.create')
  async createCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() dto: CreateCategoryDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.createCategory(tenantId, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions('category.update')
  async updateCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions('category.delete')
  async deleteCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.deleteCategory(tenantId, id);
  }

  @Get('raw-categories')
  @SkipPermissionCheck()
  async getRawCategories(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Query('type') type?: RagBaleType,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getRawCategories(tenantId, type);
  }

  @Post('raw-categories')
  @SkipPermissionCheck()
  async createRawCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() dto: CreateRawCategoryDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.createRawCategory(tenantId, dto);
  }

  @Put('raw-categories/:id')
  @SkipPermissionCheck()
  async updateRawCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRawCategoryDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateRawCategory(tenantId, id, dto);
  }

  @Delete('raw-categories/:id')
  @SkipPermissionCheck()
  async deleteRawCategory(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.deleteRawCategory(tenantId, id);
  }

  @Get('grades')
  @SkipPermissionCheck()
  async getGrades(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getGrades(tenantId);
  }

  @Get('warehouses')
  @SkipPermissionCheck()
  async getWarehouses(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getWarehouses(tenantId);
  }

  @Get('warehouses/all')
  @RequirePermissions('warehouse.read')
  async getAllWarehouses(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getAllWarehouses(tenantId);
  }

  @Post('warehouses')
  @RequirePermissions('warehouse.create')
  async createWarehouse(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Body() dto: CreateWarehouseDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.createWarehouse(tenantId, dto);
  }

  @Patch('warehouses/:id')
  @RequirePermissions('warehouse.update')
  async updateWarehouse(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateWarehouse(tenantId, id, dto);
  }

  @Delete('warehouses/:id')
  @RequirePermissions('warehouse.delete')
  async deleteWarehouse(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.deleteWarehouse(tenantId, id);
  }

  @Get('stats')
  @SkipPermissionCheck()
  async getStats(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getStats(tenantId);
  }
}
