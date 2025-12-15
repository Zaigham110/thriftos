import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RepackSessionStatus } from '@prisma/client';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackSessionDto, UpdateRepackSessionDto } from './dto';
import { RepackSessionService } from './repack-session.service';

@Controller('repack/sessions')
@UseGuards(TenantGuard, PermissionGuard)
export class RepackSessionController {
  constructor(private readonly service: RepackSessionService) {}

  @Post()
  @RequirePermissions('REPACK_CREATE')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRepackSessionDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('REPACK_VIEW')
  async findAll(
    @Query('status') status: RepackSessionStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('REPACK_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('REPACK_EDIT')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRepackSessionDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.update(tenantId, id, dto, user.userId);
  }

  @Post(':id/close')
  @RequirePermissions('REPACK_CLOSE')
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.close(tenantId, id, user.userId);
  }
}


