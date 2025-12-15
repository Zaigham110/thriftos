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
    const csv = toCsv(data.steps as any[], ['stage', 'totalCost', 'totalWeightKg', 'avgCostPerKg', 'totalPcs', 'lockedCost', 'totalKg']);
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
    return { data: await this.service.profitabilityReadiness(tenantId, filters) };
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
    const data = await this.service.profitabilityReadiness(tenantId, filters);
    const csv = toCsv(
      [
        ...data.perKg.map((r) => ({ metric: 'COST_PER_KG', ...r })),
        ...data.perPcs.map((r) => ({ metric: 'COST_PER_PCS', ...r })),
      ] as any[],
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="profitability-readiness.csv"');
    return res.status(200).send(csv);
  }
}


