import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ReportFiltersDto } from '../common/dto/report-filters.dto';
import { ReportsAuditService } from '../common/reports-audit.service';
import { toCsv } from '../common/report-utils';
import { InventoryReportsService } from './inventory-reports.service';

@Controller('reports/inventory')
@UseGuards(TenantGuard, PermissionGuard)
export class InventoryReportsController {
  constructor(
    private readonly service: InventoryReportsService,
    private readonly audit: ReportsAuditService,
  ) {}

  @Get('snapshot')
  @RequirePermissions('REPORTS_VIEW')
  async snapshot(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.snapshot',
      exported: false,
      params: { ...filters },
    });
    return { data: await this.service.inventorySnapshot(tenantId, filters) };
  }

  @Get('snapshot/export')
  @RequirePermissions('REPORTS_EXPORT')
  async snapshotExport(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.snapshot',
      exported: true,
      params: { ...filters },
    });
    const data = await this.service.inventorySnapshot(tenantId, filters);
    const csv = toCsv(data, ['warehouseId', 'categoryId', 'gradeId', 'status', 'items', 'weightKg', 'pcsCount', 'costLocked']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-snapshot.csv"');
    return res.status(200).send(csv);
  }

  @Get('aging')
  @RequirePermissions('REPORTS_VIEW')
  async aging(@Query() query: any, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.aging',
      exported: false,
      params: { ...query },
    });
    return { data: await this.service.inventoryAging(tenantId, query) };
  }

  @Get('aging/export')
  @RequirePermissions('REPORTS_EXPORT')
  async agingExport(@Query() query: any, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.aging',
      exported: true,
      params: { ...query },
    });
    const data = await this.service.inventoryAging(tenantId, query);
    const csv = toCsv(data, ['bucket', 'items', 'weightKg', 'pcsCount', 'costLocked']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-aging.csv"');
    return res.status(200).send(csv);
  }
}


