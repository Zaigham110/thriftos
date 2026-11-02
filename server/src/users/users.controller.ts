import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateMunshiDto, SetPinDto } from './dto/munshi.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto, AssignMultipleRolesDto } from './dto/assign-role.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(TenantGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Settings → Team: everyone in the business, how they sign in, locked PINs. */
  @Get('team')
  @RequirePermissions('user.read')
  team(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.team((req as any).tenantId || user.tenantId);
  }

  /** Add a munshi: name, phone and PIN. */
  @Post('munshi')
  @RequirePermissions('user.create')
  @HttpCode(HttpStatus.CREATED)
  createMunshi(@Body() dto: CreateMunshiDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.createMunshi((req as any).tenantId || user.tenantId, dto, user.userId);
  }

  @Post(':id/pin')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  setPin(@Param('id') id: string, @Body() dto: SetPinDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.setPin((req as any).tenantId || user.tenantId, id, dto.pin, user.userId);
  }

  @Post(':id/unlock')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  unlockPin(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.unlockPin((req as any).tenantId || user.tenantId, id, user.userId);
  }

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
    @Query('includeInactive') includeInactive: boolean,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.findAll(tenantId, includeInactive);
  }

  @Get(':id')
  @RequirePermissions('user.read')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
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
  async block(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.block(tenantId, id, user.userId);
  }

  @Patch(':id/unblock')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async unblock(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.unblock(tenantId, id, user.userId);
  }

  @Post(':id/reset-password')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.resetPassword(tenantId, id, user.userId);
  }

  @Post(':id/roles')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.assignRole(tenantId, id, dto.roleId, user.userId);
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

  @Delete(':id/roles/:roleId')
  @RequirePermissions('user.update')
  @HttpCode(HttpStatus.OK)
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.usersService.removeRole(tenantId, id, roleId, user.userId);
  }
}

