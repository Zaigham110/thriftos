import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { WorkerReportsService } from './worker-reports.service';

import { RequireModule } from '../../common/decorators/require-module.decorator';

@RequireModule('REPORTS')
@Controller('reports/worker')
@UseGuards(TenantGuard, PermissionGuard)
export class WorkerReportsController {
  constructor(
    private readonly service: WorkerReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('productivity')
  @RequirePermissions('REPORTS_VIEW')
  async productivity(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'worker.productivity',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.productivity(tenantId, filters) };
  }

  @Get('productivity/export')
  @RequirePermissions('REPORTS_EXPORT')
  async productivityExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'worker.productivity',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.productivity(tenantId, filters);
    const flat = data.map((r) => ({
      workerId: r.workerId,
      stage1SessionsCompleted: r.stage1.sessionsCompleted,
      stage1AvgMinutesPerSession: r.stage1.avgMinutesPerSession,
      stage1YieldContributionPct: r.stage1.yieldContributionPct,
      stage1WastePct: r.stage1.wastePct,
      stage2SessionsCompleted: r.stage2.sessionsCompleted,
      stage2AvgMinutesPerSession: r.stage2.avgMinutesPerSession,
    }));
    const csv = toCsv(flat, [
      'workerId',
      'stage1SessionsCompleted',
      'stage1AvgMinutesPerSession',
      'stage1YieldContributionPct',
      'stage1WastePct',
      'stage2SessionsCompleted',
      'stage2AvgMinutesPerSession',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="worker-productivity.csv"');
    return res.status(200).send(csv);
  }
}


