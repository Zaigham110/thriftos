import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { GradingReportsService } from './grading-reports.service';

import { RequireModule } from '../../common/decorators/require-module.decorator';

@RequireModule('REPORTS')
@Controller('reports/grading')
@UseGuards(TenantGuard, PermissionGuard)
export class GradingReportsController {
  constructor(
    private readonly service: GradingReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('distribution')
  @RequirePermissions('REPORTS_VIEW')
  async distribution(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'grading.distribution',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.gradeDistribution(tenantId, filters) };
  }

  @Get('distribution/export')
  @RequirePermissions('REPORTS_EXPORT')
  async distributionExport(
    @Query() filters: ReportFiltersDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'grading.distribution',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.gradeDistribution(tenantId, filters);
    const csv = toCsv(data, ['categoryId', 'gradeId', 'gradeWeightKg', 'gradePct', 'gradeCost', 'costPerKg']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="grade-distribution.csv"');
    return res.status(200).send(csv);
  }

  @Get('loss')
  @RequirePermissions('REPORTS_VIEW')
  async loss(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'grading.loss',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.gradingLoss(tenantId, filters) };
  }

  @Get('loss/export')
  @RequirePermissions('REPORTS_EXPORT')
  async lossExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'grading.loss',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.gradingLoss(tenantId, filters);
    const csv = toCsv(data, ['categoryId', 'inputWeightKg', 'wasteWeightKg', 'wastePct', 'wasteCost']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="grading-loss.csv"');
    return res.status(200).send(csv);
  }
}


