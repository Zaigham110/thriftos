import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { RepackReportsService } from './repack-reports.service';

import { RequireModule } from '../../common/decorators/require-module.decorator';

@RequireModule('REPORTS')
@Controller('reports/repack')
@UseGuards(TenantGuard, PermissionGuard)
export class RepackReportsController {
  constructor(
    private readonly service: RepackReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('efficiency')
  @RequirePermissions('REPORTS_VIEW')
  async efficiency(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'repack.efficiency',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.repackEfficiency(tenantId, filters) };
  }

  @Get('summary')
  @RequirePermissions('REPORTS_VIEW')
  async summary(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'repack.summary',
      exported: false,
      params: { ...filters },
    });
    return await this.service.repackSummary(tenantId, filters);
  }

  @Get('summary/export')
  @RequirePermissions('REPORTS_EXPORT')
  async summaryExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'repack.summary',
      exported: true,
      params: { ...filters },
    });
    const result = await this.service.repackSummary(tenantId, filters);
    const csv = toCsv(result.data as any[], ['status', 'units', 'totalWeightKg', 'totalPcs', 'totalCost']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="repack-summary.csv"');
    return res.status(200).send(csv);
  }

  @Get('efficiency/export')
  @RequirePermissions('REPORTS_EXPORT')
  async efficiencyExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'repack.efficiency',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.repackEfficiency(tenantId, filters);
    const csv = toCsv(data, ['day', 'gradeInputWeightKg', 'repackOutputWeightKg', 'unitsProduced', 'avgUnitWeightKg']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="repack-efficiency.csv"');
    return res.status(200).send(csv);
  }

  @Get('sku-summary')
  @RequirePermissions('REPORTS_VIEW')
  async skuSummary(@Query() query: any, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'repack.skuSummary',
      exported: false,
      params: { ...query },
    });
    return this.service.skuProductionSummary(tenantId, query);
  }

  @Get('sku-summary/export')
  @RequirePermissions('REPORTS_EXPORT')
  async skuSummaryExport(@Query() query: any, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'repack.skuSummary',
      exported: true,
      params: { ...query },
    });
    const result = await this.service.skuProductionSummary(tenantId, { ...query, page: 1, limit: 2000 });
    const csv = toCsv(result.data, [
      'unitCode',
      'unitType',
      'categoryId',
      'categoryName',
      'gradeId',
      'gradeName',
      'weightKg',
      'pcsCount',
      'totalCost',
      'createdAt',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sku-production-summary.csv"');
    return res.status(200).send(csv);
  }
}


