import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { GradeOutputService } from './grade-output.service';

@Controller('sorting/stage2/grade-outputs')
@UseGuards(TenantGuard, PermissionGuard)
export class GradeOutputController {
  constructor(private readonly service: GradeOutputService) {}

  @Get()
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async findAll(
    @Query('gradeSessionId') gradeSessionId: string,
    @Query('gradeId') gradeId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { gradeSessionId, gradeId, page, limit });
  }

  @Get(':id')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }
}


