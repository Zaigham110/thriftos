import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { ProcurementReportsService } from './procurement-reports.service';

@Controller('reports/procurement')
@UseGuards(TenantGuard, PermissionGuard)
export class ProcurementReportsController {
  constructor(
    private readonly service: ProcurementReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('containers/:id/cost-breakdown')
  @RequirePermissions('REPORTS_VIEW')
  async containerCostBreakdown(
    @Param('id') containerId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'procurement.containerCostBreakdown',
      exported: false,
      params: { containerId },
    });
    return this.service.containerCostBreakdown(tenantId, containerId);
  }

  @Get('vendors/summary')
  @RequirePermissions('REPORTS_VIEW')
  async vendorSummaryJson(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;

    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'procurement.vendorProcurementSummary',
      exported: false,
      params: { startDate: filters.startDate, endDate: filters.endDate },
    });

    const data = await this.service.vendorProcurementSummary(tenantId, filters);
    return { data };
  }

  @Get('vendors/summary/export')
  @RequirePermissions('REPORTS_EXPORT')
  async vendorSummaryExportCsv(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;

    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'procurement.vendorProcurementSummary',
      exported: true,
      params: { startDate: filters.startDate, endDate: filters.endDate },
    });

    const data = await this.service.vendorProcurementSummary(tenantId, filters);
    const csv = toCsv(data, ['vendorId', 'vendorName', 'totalWeightKg', 'totalCost', 'avgCostPerKg']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-procurement-summary.csv"');
    return res.status(200).send(csv);
  }
}


