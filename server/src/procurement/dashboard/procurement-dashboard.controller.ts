import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../../reports/common/dto/report-filters.dto';
import { ProcurementDashboardService } from './procurement-dashboard.service';

@Controller('procurement/dashboard')
@UseGuards(TenantGuard, PermissionGuard)
export class ProcurementDashboardController {
  constructor(private readonly service: ProcurementDashboardService) {}

  @Get('summary')
  @RequirePermissions('po.read')
  async summary(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    return { data: await this.service.summary(tenantId, filters) };
  }
}
