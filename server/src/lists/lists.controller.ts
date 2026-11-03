import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Workbook } from 'exceljs';
import { strToU8 } from 'fflate';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { SkipPermissionCheck } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { parseListQuery } from '../common/list/list-query';
import { toCsv } from '../tenant/data-export';
import { ListsService } from './lists.service';

/**
 * Workspace lists (enterprise plan E2.1 / E2.3): GET /lists/:name pages, sorts, filters, searches and groups;
 * GET /lists/:name/export gives the same rows as CSV or Excel. Each list decides its own permission and
 * hides fields the user may not see.
 */
@Controller('lists')
@UseGuards(TenantGuard, PermissionGuard)
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get(':name')
  @SkipPermissionCheck()
  page(@Param('name') name: string, @TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query() raw: Record<string, unknown>) {
    return this.lists.page(name, tenantId, user, parseListQuery(raw));
  }

  @Get(':name/export')
  @SkipPermissionCheck()
  async export(@Param('name') name: string, @TenantId() tenantId: string, @CurrentUser() user: CurrentUserData, @Query() raw: Record<string, unknown>, @Res() res: Response) {
    const format = String(raw['format'] ?? 'csv');
    if (format !== 'csv' && format !== 'xlsx') throw new BadRequestException('format is csv or xlsx');
    const lang = raw['lang'] === 'ur' ? 'ur' : 'en';
    const columns = String(raw['columns'] ?? '').split(',').map((c) => c.trim()).filter(Boolean);
    const { header, rows, fields, truncated } = await this.lists.exportRows(name, tenantId, user, parseListQuery(raw), lang, columns);
    const day = new Date().toISOString().slice(0, 10);
    const file = `thriftos-${name}-${day}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('Cache-Control', 'no-store');
    if (truncated) res.setHeader('X-Export-Truncated', 'true');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const keys = fields.map((f) => f.key);
      const objs = rows.map((r) => Object.fromEntries(r.map((v, i) => [keys[i], v])));
      res.send(Buffer.from(strToU8(toCsv(keys, objs, header))));
      return;
    }

    const wb = new Workbook();
    wb.creator = 'ThriftOS';
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: lang === 'ur' }] });
    ws.columns = fields.map((f, i) => ({ header: header[i], key: f.key, width: Math.max(12, header[i].length + 2), style: f.type === 'number' ? { numFmt: '#,##0.00' } : {} }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(r);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }
}
