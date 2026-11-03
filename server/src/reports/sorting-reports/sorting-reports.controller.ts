import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { SortingReportsService } from './sorting-reports.service';

import { RequireModule } from '../../common/decorators/require-module.decorator';

@RequireModule('REPORTS')
@Controller('reports/sorting')
@UseGuards(TenantGuard, PermissionGuard)
export class SortingReportsController {
  constructor(
    private readonly service: SortingReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('category-yield')
  @RequirePermissions('REPORTS_VIEW')
  async categoryYield(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.categoryYield',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.categoryYieldReport(tenantId, filters) };
  }

  @Get('category-yield/export')
  @RequirePermissions('REPORTS_EXPORT')
  async categoryYieldExport(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.categoryYield',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.categoryYieldReport(tenantId, filters);
    const csv = toCsv(data, ['categoryId', 'inputWeightKg', 'outputWeightKg', 'wasteWeightKg', 'yieldPct']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="category-yield.csv"');
    return res.status(200).send(csv);
  }

  @Get('outputs')
  @RequirePermissions('REPORTS_VIEW')
  async outputs(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.outputs',
      exported: false,
      params: { ...filters },
    });
    return await this.service.sortingOutputs(tenantId, filters);
  }

  @Get('outputs/export')
  @RequirePermissions('REPORTS_EXPORT')
  async outputsExport(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.outputs',
      exported: true,
      params: { ...filters },
    });
    const result = await this.service.sortingOutputs(tenantId, filters);
    const csv = toCsv((result.stage1?.data ?? []) as any[], [
      'createdAt',
      'poNumber',
      'containerNumber',
      'ragCode',
      'categoryName',
      'weightKg',
      'allocatedCost',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sorting-stage1-outputs.csv"');
    return res.status(200).send(csv);
  }

  @Get('waste')
  @RequirePermissions('REPORTS_VIEW')
  async waste(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.waste',
      exported: false,
      params: { ...filters },
    });
    return await this.service.sortingWaste(tenantId, filters);
  }

  @Get('waste/export')
  @RequirePermissions('REPORTS_EXPORT')
  async wasteExport(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.waste',
      exported: true,
      params: { ...filters },
    });
    const result = await this.service.sortingWaste(tenantId, filters);
    const csv = toCsv(result.categorized.data as any[], ['createdAt', 'stage', 'wasteCategoryName', 'poNumber', 'containerNumber', 'ragCode', 'amount', 'unitType']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sorting-waste.csv"');
    return res.status(200).send(csv);
  }

  @Get('efficiency')
  @RequirePermissions('REPORTS_VIEW')
  async efficiency(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.efficiency',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.sortingEfficiency(tenantId, filters) };
  }

  @Get('volume-trend')
  @RequirePermissions('REPORTS_VIEW')
  async volumeTrend(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.volumeTrend',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.sortingVolumeTrend(tenantId, filters) };
  }

  @Get('yield-waste-trend')
  @RequirePermissions('REPORTS_VIEW')
  async yieldWasteTrend(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.yieldWasteTrend',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.sortingYieldWasteTrend(tenantId, filters) };
  }

  @Get('efficiency/export')
  @RequirePermissions('REPORTS_EXPORT')
  async efficiencyExport(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'sorting.efficiency',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.sortingEfficiency(tenantId, filters);
    const csv = toCsv(data, [
      'workerId',
      'sessionsHandled',
      'inputWeightKg',
      'outputWeightKg',
      'wasteWeightKg',
      'avgYieldPct',
      'avgWastePct',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sorting-efficiency.csv"');
    return res.status(200).send(csv);
  }
}


