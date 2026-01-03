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
    return await this.service.inventorySnapshot(tenantId, filters);
  }

  // Required alias endpoint: /reports/inventory/stock
  @Get('stock')
  @RequirePermissions('REPORTS_VIEW')
  async stock(@Query() filters: ReportFiltersDto, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.stock',
      exported: false,
      params: { ...filters },
    });
    return await this.service.inventorySnapshot(tenantId, filters);
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
    const snapshot = await this.service.inventorySnapshot(tenantId, filters);
    const csv = toCsv(snapshot.data as any[], [
      'categoryName',
      'gradeName',
      'warehouseName',
      'status',
      'totalUnits',
      'totalWeightKg',
      'totalPcs',
      'avgCost',
    ]);
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
    return await this.service.inventoryAging(tenantId, query);
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
    const aging = await this.service.inventoryAging(tenantId, query);
    const csv = toCsv(aging.data as any[], ['ageRangeDays', 'unitsCount', 'totalWeightKg', 'totalValue']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-aging.csv"');
    return res.status(200).send(csv);
  }

  @Get('movements')
  @RequirePermissions('REPORTS_VIEW')
  async movements(@Query() query: any, @CurrentUser() user: CurrentUserData, @Req() req: Request) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.movements',
      exported: false,
      params: { ...query },
    });
    return await this.service.inventoryMovements(tenantId, query);
  }

  @Get('movements/export')
  @RequirePermissions('REPORTS_EXPORT')
  async movementsExport(@Query() query: any, @CurrentUser() user: CurrentUserData, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).tenantId || user.tenantId;
    await this.audit.logAccess({
      tenantId,
      userId: user.userId,
      report: 'inventory.movements',
      exported: true,
      params: { ...query },
    });
    const result = await this.service.inventoryMovements(tenantId, query);
    const csv = toCsv(result.data as any[], [
      'createdAt',
      'movementType',
      'quantityKg',
      'quantityPcs',
      'unitCode',
      'unitType',
      'warehouseName',
      'categoryName',
      'gradeName',
      'inventoryStatus',
      'avgCost',
      'referenceId',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory-movements.csv"');
    return res.status(200).send(csv);
  }
}


