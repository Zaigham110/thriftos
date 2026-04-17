import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions, SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { WasteService } from './waste.service';
import { CreateWasteCategoryDto, UpdateWasteCategoryDto } from './dto/waste-category.dto';

/**
 * Waste categories are tenant-configured.
 * This controller exposes tenant-scoped CRUD.
 */
@Controller('tenant/waste-categories')
@UseGuards(TenantGuard, PermissionGuard)
export class WasteController {
  constructor(private readonly waste: WasteService) {}

  @Get()
  @SkipPermissionCheck()
  async listActive(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.listCategories(tenantId);
  }

  @Get('all')
  @RequirePermissions('category.read')
  async listAll(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.listAllCategories(tenantId);
  }

  @Get(':id')
  @RequirePermissions('category.read')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.getCategory(tenantId, id);
  }

  @Post()
  @RequirePermissions('category.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWasteCategoryDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.createCategory(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('category.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWasteCategoryDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.updateCategory(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('category.delete')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.deleteCategory(tenantId, id);
  }
}
