import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { GradesService } from './grades.service';
import { CreateGradeDto, UpdateGradeDto } from './dto';

@Controller('sorting/grades')
@UseGuards(TenantGuard, PermissionGuard)
export class GradesController {
  constructor(private readonly service: GradesService) {}

  @Get()
  @RequirePermissions('grade.read')
  async findAll(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId);
  }

  @Get('all')
  @RequirePermissions('grade.read')
  async findAllAdmin(@CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAllAdmin(tenantId);
  }

  @Get(':id')
  @RequirePermissions('grade.read')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions('grade.create')
  async create(@Body() dto: CreateGradeDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.create(tenantId, dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('grade.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('grade.delete')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.remove(tenantId, id, user.userId);
  }
}
