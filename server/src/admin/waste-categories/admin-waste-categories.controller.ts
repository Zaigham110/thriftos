import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { WasteService } from '../../waste/waste.service';
import { CreateWasteCategoryDto, UpdateWasteCategoryDto } from '../../waste/dto/waste-category.dto';

@Controller('admin/waste-categories')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminWasteCategoriesController {
  constructor(private readonly waste: WasteService) {}

  @Get()
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
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.waste.deleteCategory(tenantId, id);
  }
}
