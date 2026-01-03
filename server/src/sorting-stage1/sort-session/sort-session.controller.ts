import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SortStatus } from '@prisma/client';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateSortSessionDto, UpdateSortSessionDto } from './dto';
import { SortSessionService } from './sort-session.service';

@Controller('sorting/stage1/sessions')
@UseGuards(TenantGuard, PermissionGuard)
export class SortSessionController {
  constructor(private readonly sortSessionService: SortSessionService) {}

  @Post()
  @RequirePermissions('SORTING_STAGE1_CREATE')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSortSessionDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.sortSessionService.create(tenantId, dto, user.userId);
  }

  @Get()
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async findAll(
    @Query('status') status: SortStatus,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.sortSessionService.findAll(tenantId, { status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.sortSessionService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('SORTING_STAGE1_EDIT')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSortSessionDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.sortSessionService.update(tenantId, id, dto, user.userId);
  }

  @Post(':id/close')
  @RequirePermissions('SORTING_STAGE1_CLOSE')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @Body() body: { wasteCategoryId?: string },
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.sortSessionService.close(tenantId, id, user.userId, { wasteCategoryId: body?.wasteCategoryId });
  }
}


