import { Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

import { GradeOutputService } from '../../sorting-stage2/grade-output/grade-output.service';

@Controller('sorting/outputs')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingOutputsFacadeController {
  constructor(private readonly gradeOutputService: GradeOutputService) {}

  @Get()
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async findAll(
    @Query('gradeSessionId') gradeSessionId: string,
    @Query('gradeId') gradeId: string,
    @Query('status') status: string,
    @Query('search') search: string,
    @Query('ragCode') ragCode: string,
    @Query('containerNumber') containerNumber: string,
    @Query('categoryId') categoryId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.gradeOutputService.findAll(tenantId, {
      gradeSessionId,
      gradeId,
      status,
      search,
      ragCode,
      containerNumber,
      categoryId,
      page,
      limit,
    });
  }

  @Get(':id')
  @RequirePermissions('SORTING_STAGE2_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.gradeOutputService.findOne(tenantId, id);
  }

  @Patch(':id/mark-ready')
  @RequirePermissions('SORTING_STAGE2_UPDATE')
  async markReadyForRepack(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.gradeOutputService.markReadyForRepack(tenantId, id);
  }
}
