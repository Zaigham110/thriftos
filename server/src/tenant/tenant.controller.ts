import { Controller, Get, Post, Put, Delete, UseGuards, Req, Query, Body, Param } from '@nestjs/common';
import { Request } from 'express';
import { TenantService } from './tenant.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { RagBaleType } from '@prisma/client';
import { CreateRawCategoryDto, UpdateRawCategoryDto } from './dto/raw-category.dto';

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

  @Get('categories')
  @SkipPermissionCheck()
  async getCategories(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getCategories(tenantId);
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

  @Get('stats')
  @SkipPermissionCheck()
  async getStats(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getStats(tenantId);
  }
}

