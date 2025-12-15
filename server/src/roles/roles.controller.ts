import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionDto, AssignMultiplePermissionsDto } from './dto/assign-permission.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('roles')
@UseGuards(TenantGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions('role.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
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
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
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
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.remove(tenantId, id, user.userId);
  }

  @Post(':id/permissions')
  @RequirePermissions('role.update')
  @HttpCode(HttpStatus.CREATED)
  async assignPermission(
    @Param('id') id: string,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.assignPermission(tenantId, id, dto.permissionId, user.userId);
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

  @Delete(':id/permissions/:permId')
  @RequirePermissions('role.update')
  @HttpCode(HttpStatus.OK)
  async removePermission(
    @Param('id') id: string,
    @Param('permId') permId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.rolesService.removePermission(tenantId, id, permId, user.userId);
  }
}

