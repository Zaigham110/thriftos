import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateRepackUnitDto } from './dto';
import { RepackUnitService } from './repack-unit.service';

@Controller('repack')
@UseGuards(TenantGuard, PermissionGuard)
export class RepackUnitController {
  constructor(private readonly service: RepackUnitService) {}

  @Post('sessions/:id/units')
  @RequirePermissions('REPACK_EDIT')
  @HttpCode(HttpStatus.CREATED)
  async createForSession(
    @Param('id') sessionId: string,
    @Body() dto: CreateRepackUnitDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.createForSession(tenantId, sessionId, dto, user.userId);
  }

  @Get('units')
  @RequirePermissions('REPACK_VIEW')
  async findAll(
    @Query('sessionId') sessionId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { sessionId, page, limit });
  }

  @Get('units/:id')
  @RequirePermissions('REPACK_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }
}


