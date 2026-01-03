import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { CostReportsService } from './cost-reports.service';

@Controller('reports/cost')
@UseGuards(TenantGuard, PermissionGuard)
export class CostReportsController {
  constructor(
    private readonly service: CostReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('cascade')
  @RequirePermissions('REPORTS_VIEW')
  async cascade(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'cost.cascade',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.costCascade(tenantId, filters) };
  }

  @Get('cascade/export')
  @RequirePermissions('REPORTS_EXPORT')
  async cascadeExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'cost.cascade',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.costCascade(tenantId, filters);
    const rows = [
      { stage: 'PROCUREMENT', totalCost: data.procurement.totalCost, totalWeightKg: data.procurement.weightKg, costPerKg: data.procurement.costPerKg },
      { stage: 'SORTING', totalCost: data.sorting.totalCost, totalWeightKg: data.sorting.weightKg, costPerKg: data.sorting.costPerKg },
      { stage: 'GRADING', totalCost: data.grading.totalCost, totalWeightKg: data.grading.weightKg, costPerKg: data.grading.costPerKg },
      { stage: 'REPACK', totalCost: data.repack.totalCost, totalWeightKg: data.repack.weightKg, costPerKg: data.repack.costPerKg },
      { stage: 'FINAL', totalCost: data.final.totalCost, totalWeightKg: data.final.weightKg, costPerKg: data.final.costPerKg },
    ];
    const csv = toCsv(rows as any[], ['stage', 'totalCost', 'totalWeightKg', 'costPerKg']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cost-cascade.csv"');
    return res.status(200).send(csv);
  }

  @Get('readiness')
  @RequirePermissions('REPORTS_VIEW')
  async readiness(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'cost.readiness',
      exported: false,
      params: { ...filters },
    });
    return await this.service.profitabilityReadiness(tenantId, filters);
  }

  @Get('readiness/export')
  @RequirePermissions('REPORTS_EXPORT')
  async readinessExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'cost.readiness',
      exported: true,
      params: { ...filters },
    });
    const result = await this.service.profitabilityReadiness(tenantId, filters);
    const csv = toCsv(result.data as any[], ['categoryName', 'gradeName', 'unitsReady', 'totalWeightKg', 'totalCost', 'avgCostPerKg']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="profitability-readiness.csv"');
    return res.status(200).send(csv);
  }

  @Get('final-products')
  @RequirePermissions('REPORTS_VIEW')
  async finalProducts(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'cost.finalProducts',
      exported: false,
      params: { ...filters },
    });
    return await this.service.finalProductCostReport(tenantId, filters);
  }

  @Get('final-products/export')
  @RequirePermissions('REPORTS_EXPORT')
  async finalProductsExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'cost.finalProducts',
      exported: true,
      params: { ...filters },
    });
    const result = await this.service.finalProductCostReport(tenantId, filters);
    const csv = toCsv(result.data as any[], [
      'dateSealed',
      'productCode',
      'unitType',
      'category',
      'grade',
      'totalWeightKg',
      'totalQty',
      'totalCost',
      'costPerKg',
      'costPerUnit',
      'sourceContainers',
      'sourceBales',
      'allocationsCount',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="final-product-cost.csv"');
    return res.status(200).send(csv);
  }
}


