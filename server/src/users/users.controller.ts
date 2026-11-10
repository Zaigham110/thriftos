import { RequireModule } from '../common/decorators/require-module.decorator';
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
import { CreateMunshiDto, SetPinDto, TeamDetailsDto, TeamPersonDto, TeamRoleDto } from './dto/munshi.dto';
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
    return this.usersService.team((req as any).tenantId || user.tenantId, user.userId);
  }

  /** Team: the roles to choose from, with how many people have each. */
  @Get('team/roles')
  @RequirePermissions('user.read')
  teamRoles(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.teamRoles((req as any).tenantId || user.tenantId);
  }

  /** Team: someone who signs in with email; the answer carries a first password to pass on. */
  @Post('team/person')
  @RequirePermissions('user.create')
  addPerson(@Body() dto: TeamPersonDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.addPerson((req as any).tenantId || user.tenantId, dto, user.userId);
  }

  /** Team: stop access (they cannot sign in; sessions end now) and give it back. */
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user.update')
  stopAccess(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.stopAccess((req as any).tenantId || user.tenantId, id, user.userId);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('user.update')
  startAccess(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.startAccess((req as any).tenantId || user.tenantId, id, user.userId);
  }

  /** Team: fix a name or phone. */
  @Patch(':id/details')
  @RequirePermissions('user.update')
  updateDetails(@Param('id') id: string, @Body() dto: TeamDetailsDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.updateDetails((req as any).tenantId || user.tenantId, id, dto, user.userId);
  }

  /** Team: one role per person. */
  @Put(':id/role')
  @RequirePermissions('user.update')
  setRole(@Param('id') id: string, @Body() dto: TeamRoleDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    return this.usersService.setRole((req as any).tenantId || user.tenantId, id, dto.roleId, user.userId);
  }

  /** Add a munshi: name, phone and PIN. */
  @RequireModule('MUNSHI')
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

