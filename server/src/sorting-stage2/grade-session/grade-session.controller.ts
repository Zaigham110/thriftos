import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GradeStatus } from '@prisma/client';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateGradeSessionDto, UpdateGradeSessionDto } from './dto';
import { GradeSessionService } from './grade-session.service';

@Controller('sorting/stage2/sessions')
@UseGuards(TenantGuard, PermissionGuard)
export class GradeSessionController {
  constructor(private readonly service: GradeSessionService) {}

  @Post()
  @RequirePermissions('SORTING_STAGE2_CREATE')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateGradeSessionDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async findAll(
    @Query('status') status: GradeStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('SORTING_STAGE2_EDIT')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGradeSessionDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.update(tenantId, id, dto, user.userId);
  }

  @Post(':id/close')
  @RequirePermissions('SORTING_STAGE2_CLOSE')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @Body() body: { wasteCategoryId?: string },
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.close(tenantId, id, user.userId, { wasteCategoryId: body?.wasteCategoryId });
  }
}


