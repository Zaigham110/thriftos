import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ListField, ListResult, buildOrderBy, buildWhere, runList, visibleFields } from '../common/list/list-engine';
import { ListQuery } from '../common/list/list-query';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { LISTS, RegisteredList } from './list-registry';

export const EXPORT_MAX_ROWS = 50_000;
const BATCH = 1000;

/** Export cell values: dates as Pakistan local time, money/amounts as plain decimals. */
export function exportValue(f: ListField, v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (f.type === 'date') {
    const d = new Date(v as string);
    const local = new Date(d.getTime() + 5 * 60 * 60 * 1000);
    return local.toISOString().slice(0, 16).replace('T', ' ');
  }
  if (f.type === 'number') return Number(Prisma.Decimal.isDecimal(v) ? (v as Prisma.Decimal).toString() : v);
  return String(v);
}

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async permissionsOf(user: CurrentUserData): Promise<Set<string>> {
    if (user.isSuperAdmin) return new Set((await this.prisma.permission.findMany({ select: { code: true } })).map((p) => p.code));
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId: user.userId } } } },
      select: { permission: { select: { code: true } } },
    });
    return new Set(rows.map((r) => r.permission.code));
  }

  private async resolve(name: string, user: CurrentUserData): Promise<{ list: RegisteredList; permissions: Set<string> }> {
    const list = LISTS[name];
    if (!list) throw new NotFoundException(`No list "${name}"`);
    const permissions = await this.permissionsOf(user);
    if (list.permission && !permissions.has(list.permission)) throw new ForbiddenException(`Missing permission ${list.permission}`);
    return { list, permissions };
  }

  async page(name: string, tenantId: string, user: CurrentUserData, query: ListQuery): Promise<ListResult> {
    const { list, permissions } = await this.resolve(name, user);
    return runList(this.prisma, list.resource, tenantId, query, permissions);
  }

  /** All matching rows (up to EXPORT_MAX_ROWS) in the list's order, as header + rows, for CSV/Excel. */
  async exportRows(name: string, tenantId: string, user: CurrentUserData, query: ListQuery, lang: 'en' | 'ur', columns: string[]) {
    const { list, permissions } = await this.resolve(name, user);
    const fields = visibleFields(list.resource, permissions).filter((f) => !f.hidden);
    const chosen = columns.length ? columns.map((c) => fields.find((f) => f.key === c)).filter((f): f is ListField => !!f) : fields;
    const where = buildWhere(list.resource, visibleFields(list.resource, permissions), tenantId, query);
    const orderBy = buildOrderBy(list.resource, visibleFields(list.resource, permissions), query.sort);
    const d = list.resource.delegate(this.prisma);
    const rows: (string | number | null)[][] = [];
    for (let skip = 0; skip < EXPORT_MAX_ROWS; skip += BATCH) {
      const batch = await d.findMany({ where, orderBy, skip, take: Math.min(BATCH, EXPORT_MAX_ROWS - skip), select: list.resource.select });
      for (const r of batch) {
        const row = list.resource.toRow(r);
        rows.push(chosen.map((f) => exportValue(f, row[f.key])));
      }
      if (batch.length < BATCH) break;
    }
    await this.audit.log({ tenantId, userId: user.userId, action: 'LIST_EXPORTED', entityType: 'List', entityId: name, metadataJson: { rows: rows.length, filters: query.filters.length } as never });
    return {
      fields: chosen,
      header: chosen.map((f) => list.labels[f.key]?.[lang] ?? f.key),
      rows,
      truncated: rows.length >= EXPORT_MAX_ROWS,
    };
  }
}
