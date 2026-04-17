import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RolesService } from '../../roles/roles.service';
import { CreateRoleDto } from '../../roles/dto/create-role.dto';
import { UpdateRoleDto } from '../../roles/dto/update-role.dto';
import { AssignMultiplePermissionsDto } from '../../roles/dto/assign-permission.dto';

@Controller('admin/roles')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminRolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions('role.create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRoleDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('role.read')
  async findAll(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions('role.read')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('role.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('role.delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.remove(tenantId, id, user.userId);
  }

  @Post(':id/permissions/bulk')
  @RequirePermissions('role.update')
  @HttpCode(HttpStatus.OK)
  async assignMultiplePermissions(
    @Param('id') id: string,
    @Body() dto: AssignMultiplePermissionsDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.assignMultiplePermissions(tenantId, id, dto.permissionIds, user.userId);
  }
}
