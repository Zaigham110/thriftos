import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { AssignMultipleRolesDto } from '../../users/dto/assign-role.dto';

@Controller('admin/users')
@UseGuards(TenantGuard, PermissionGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('user.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('user.read')
  async findAll(
    @Query('includeInactive') includeInactive: string | boolean,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    const shouldIncludeInactive = String(includeInactive) === 'true';
    return this.usersService.findAll(tenantId, shouldIncludeInactive);
  }

  @Get(':id')
  @RequirePermissions('user.read')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('user.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.update(tenantId, id, dto, user.userId);
  }

  @Patch(':id/block')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async block(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.block(tenantId, id, user.userId);
  }

  @Patch(':id/unblock')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async unblock(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.unblock(tenantId, id, user.userId);
  }

  @Post(':id/reset-password')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.resetPassword(tenantId, id, user.userId);
  }

  @Post(':id/roles/bulk')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async assignMultipleRoles(
    @Param('id') id: string,
    @Body() dto: AssignMultipleRolesDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.assignMultipleRoles(tenantId, id, dto.roleIds, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('user.delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    // Users are soft-deactivated instead of hard deleted.
    return this.usersService.block(tenantId, id, user.userId);
  }
}
