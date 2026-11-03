import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { WasteReportsService } from './waste-reports.service';

import { RequireModule } from '../../common/decorators/require-module.decorator';

@RequireModule('REPORTS')
@Controller('reports/waste')
@UseGuards(TenantGuard, PermissionGuard)
export class WasteReportsController {
  constructor(
    private readonly service: WasteReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('by-stage')
  @RequirePermissions('REPORTS_VIEW')
  async byStage(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'waste.byStage',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.wasteByStage(tenantId, filters) };
  }

  @Get('by-stage/export')
  @RequirePermissions('REPORTS_EXPORT')
  async byStageExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'waste.byStage',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.wasteByStage(tenantId, filters);
    const csv = toCsv(
      [
        { stage: 'PROCUREMENT', wasteKg: data.procurementWasteKg },
        { stage: 'SORTING_STAGE_1', wasteKg: data.sortingStage1WasteKg },
        { stage: 'GRADING_STAGE_2', wasteKg: data.gradingStage2WasteKg },
      ],
      ['stage', 'wasteKg'],
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="waste-by-stage.csv"');
    return res.status(200).send(csv);
  }

  @Get('cost-impact')
  @RequirePermissions('REPORTS_VIEW')
  async costImpact(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'waste.costImpact',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.wasteCostImpact(tenantId, filters) };
  }

  @Get('cost-impact/export')
  @RequirePermissions('REPORTS_EXPORT')
  async costImpactExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'waste.costImpact',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.wasteCostImpact(tenantId, filters);
    const rows = [
      { stage: 'PROCUREMENT', wasteKg: data.procurement.wasteKg, wasteCost: data.procurement.wasteCost },
      { stage: 'SORTING_STAGE_1', wasteKg: data.sortingStage1.wasteKg, wasteCost: data.sortingStage1.wasteCost },
      { stage: 'GRADING_STAGE_2', wasteKg: data.gradingStage2.wasteKg, wasteCost: data.gradingStage2.wasteCost },
    ];
    const csv = toCsv(rows, ['stage', 'wasteKg', 'wasteCost']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="waste-cost-impact.csv"');
    return res.status(200).send(csv);
  }
}


