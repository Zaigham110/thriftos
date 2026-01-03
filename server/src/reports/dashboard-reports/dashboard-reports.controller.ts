import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { DashboardReportsService } from './dashboard-reports.service';

@Controller('reports/dashboard')
@UseGuards(TenantGuard, PermissionGuard)
export class DashboardReportsController {
  constructor(
    private readonly service: DashboardReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('summary')
  @RequirePermissions('REPORTS_VIEW')
  async summary(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;

    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'dashboard.summary',
      exported: false,
      params: { ...filters },
    });

    return { data: await this.service.summary(tenantId, filters) };
  }
}
