import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { TenantService } from '../../tenant/tenant.service';
import { CreateCategoryDto, UpdateCategoryDto } from '../../tenant/dto/category.dto';

@Controller('admin/categories')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminCategoriesController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @RequirePermissions('category.read')
  async listAll(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getAllCategories(tenantId);
  }

  @Get(':id')
  @RequirePermissions('category.read')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.getCategory(tenantId, id);
  }

  @Post()
  @RequirePermissions('category.create')
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.createCategory(tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('category.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.updateCategory(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('category.delete')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.tenantService.deleteCategory(tenantId, id);
  }
}
