import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CategoryOutputService } from './category-output.service';

@Controller('sorting/stage1/category-outputs')
@UseGuards(TenantGuard, PermissionGuard)
export class CategoryOutputController {
  constructor(private readonly service: CategoryOutputService) {}

  @Get()
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async findAll(
    @Query('sortSessionId') sortSessionId: string,
    @Query('categoryId') categoryId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAll(tenantId, { sortSessionId, categoryId, page, limit });
  }

  /**
   * Get category outputs available for grading (no GradeSession exists yet)
   * Used by Stage 2 dashboard to show items ready to grade
   */
  @Get('available-for-grading')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async findAvailableForGrading(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findAvailableForGrading(tenantId, { page, limit });
  }

  @Get(':id')
  @RequirePermissions('SORTING_STAGE1_VIEW')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return this.service.findOne(tenantId, id);
  }
}


