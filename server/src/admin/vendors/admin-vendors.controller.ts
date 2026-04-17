import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { VendorService } from '../../procurement/vendor/vendor.service';
import { CreateVendorDto, UpdateVendorDto } from '../../procurement/vendor/dto';

@Controller('admin/vendors')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminVendorsController {
  constructor(private readonly service: VendorService) {}

  @Get()
  @RequirePermissions('vendor.read')
  async list(
    @Query('includeInactive') includeInactive: boolean,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, includeInactive);
  }

  @Get(':id')
  @RequirePermissions('vendor.read')
  async getOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('vendor.create')
  async create(@Body() dto: CreateVendorDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.create(tenantId, dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('vendor.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('vendor.delete')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.remove(tenantId, id, user.userId);
  }
}
