import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FieldType, ListFilter, ListQuery, ListSort, OPS_BY_TYPE } from './list-query';

/**
 * Turns a ListQuery into Prisma queries for one resource (enterprise plan E2.1). Every query is scoped by
 * the resource's tenant `scope`; filters, sorts and groups are allowed only on the fields the resource
 * declares; fields behind a permission are invisible (and unusable) without it.
 */
export interface ListField {
  key: string;
  type: FieldType;
  /** Prisma path: ['totalAmount'] or ['customer', 'name']. */
  path: string[];
  sortable?: boolean;
  filterable?: boolean;
  /** Only top-level scalars can be grouped. */
  groupable?: boolean;
  /** A top-level date field grouped by Pakistan month ("2026-11"); group keys open as a between filter. */
  groupByMonth?: boolean;
  /**
   * A calendar day column (@db.Date, e.g. an expense's day). Its filters compare whole days at UTC midnight: the
   * Pakistan-time bounds used for timestamps would be cut to a date by the database and lose the last day.
   */
  dateOnly?: boolean;
  searchable?: boolean;
  /** Summed for the totals row and group subtotals (top-level numeric fields). */
  sum?: boolean;
  enumValues?: readonly string[];
  /** Permission code needed to see, filter, sort, group or export this field. */
  permission?: string;
  /** Hidden from the column list (used for filters/groups only, e.g. customerId). */
  hidden?: boolean;
  /** Worked out per page by the resource's `enrich` (e.g. profit so far); shown only, never sorted/filtered. */
  computed?: boolean;
}

export interface ListDelegate {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  count(args: object): Promise<number>;
  aggregate(args: object): Promise<{ _sum?: Record<string, unknown> }>;
  groupBy(args: object): Promise<Record<string, unknown>[]>;
}

export interface ListResource {
  name: string;
  fields: ListField[];
  defaultSort: ListSort[];
  scope(tenantId: string): Record<string, unknown>;
  delegate(prisma: Prisma.TransactionClient | object): ListDelegate;
  select: Record<string, unknown>;
  toRow(record: Record<string, unknown>): Record<string, unknown> & { id: string };
  /** Adds computed fields to a page of rows (one batch of queries for the whole page). */
  enrich?: (prisma: object, tenantId: string, rows: Array<Record<string, unknown> & { id: string }>) => Promise<Array<Record<string, unknown> & { id: string }>>;
  /** Totals of worked-out fields over every matching row (not only this page), e.g. sorted kg of all lots. */
  extraTotals?: (prisma: object, tenantId: string, where: object) => Promise<Record<string, string>>;
  /** Display names for group keys (e.g. customerId → customer name). */
  groupLabels?: (prisma: object, tenantId: string, field: string, keys: string[]) => Promise<Record<string, string>>;
}

export interface ListGroup {
  key: string | null;
  label: string;
  count: number;
  totals: Record<string, string>;
}

export interface ListResult {
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
  totals: Record<string, string>;
  groups?: ListGroup[];
  fields: Array<Pick<ListField, 'key' | 'type' | 'sortable' | 'filterable' | 'groupable' | 'sum' | 'enumValues' | 'hidden' | 'computed'>>;
}

/** Pakistan is UTC+5 with no daylight saving; a date filter "2026-11-03" means that local day. */
export const BUSINESS_UTC_OFFSET_MINUTES = 300;
const DAY = 24 * 60 * 60 * 1000;

export function localDayStart(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || isNaN(Date.parse(ymd))) throw new BadRequestException(`"${ymd}" is not a date (YYYY-MM-DD)`);
  return new Date(Date.parse(ymd + 'T00:00:00Z') - BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000);
}

export function visibleFields(resource: ListResource, permissions: ReadonlySet<string>): ListField[] {
  return resource.fields.filter((f) => !f.permission || permissions.has(f.permission));
}

function field(resource: ListResource, fields: ListField[], key: string, need: 'sortable' | 'filterable' | 'groupable'): ListField {
  const f = fields.find((x) => x.key === key);
  if (!f || !(f[need] || (need === 'groupable' && f.groupByMonth)) || f.computed) throw new BadRequestException(`${resource.name}: "${key}" cannot be ${need === 'sortable' ? 'sorted' : need === 'filterable' ? 'filtered' : 'grouped'}`);
  return f;
}

function nest(path: string[], leaf: unknown): Record<string, unknown> {
  return path.reduceRight<Record<string, unknown>>((acc, key, i) => ({ [key]: i === path.length - 1 ? leaf : acc }), {});
}

function scalar(f: ListField, v: string): unknown {
  switch (f.type) {
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(v)) throw new BadRequestException(`${f.key}: "${v}" is not a number`);
      return new Prisma.Decimal(v);
    }
    case 'enum':
      if (!f.enumValues?.includes(v)) throw new BadRequestException(`${f.key}: "${v}" is not one of ${f.enumValues?.join(', ')}`);
      return v;
    case 'boolean':
      if (v !== 'true' && v !== 'false') throw new BadRequestException(`${f.key}: use true or false`);
      return v === 'true';
    default:
      return v;
  }
}

/** The Prisma condition for one filter (before nesting on the field's path). */
export function condition(f: ListField, filter: ListFilter): unknown {
  if (!OPS_BY_TYPE[f.type].includes(filter.op)) throw new BadRequestException(`${f.key}: "${filter.op}" is not allowed for ${f.type}`);
  const [a, b] = filter.values;
  if (filter.op === 'isnull') return null;
  if (filter.op === 'notnull') return { not: null };
  if (f.type === 'date') {
    const start = (d: string) => (f.dateOnly ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : localDayStart(d));
    const end = (d: string) => new Date(start(d).getTime() + DAY);
    switch (filter.op) {
      case 'eq': return { gte: start(a), lt: end(a) };
      case 'gt': return { gte: end(a) };
      case 'gte': return { gte: start(a) };
      case 'lt': return { lt: start(a) };
      case 'lte': return { lt: end(a) };
      case 'between': return { gte: start(a), lt: end(b) };
    }
  }
  switch (filter.op) {
    case 'eq': return f.type === 'string' ? { equals: a, mode: 'insensitive' } : scalar(f, a);
    case 'ne': return { not: scalar(f, a) };
    case 'in': return { in: filter.values.map((v) => scalar(f, v)) };
    case 'contains': return { contains: a, mode: 'insensitive' };
    case 'gt': return { gt: scalar(f, a) };
    case 'gte': return { gte: scalar(f, a) };
    case 'lt': return { lt: scalar(f, a) };
    case 'lte': return { lte: scalar(f, a) };
    case 'between': return { gte: scalar(f, a), lte: scalar(f, b) };
  }
  throw new BadRequestException(`${f.key}: unknown filter "${filter.op}"`);
}

export function buildWhere(resource: ListResource, fields: ListField[], tenantId: string, query: ListQuery): Record<string, unknown> {
  const and: unknown[] = [resource.scope(tenantId)];
  for (const filter of query.filters) {
    const f = field(resource, fields, filter.field, 'filterable');
    and.push(nest(f.path, condition(f, filter)));
  }
  if (query.q) {
    const searchable = fields.filter((f) => f.searchable && f.type === 'string');
    if (searchable.length) and.push({ OR: searchable.map((f) => nest(f.path, { contains: query.q, mode: 'insensitive' })) });
  }
  return { AND: and };
}

export function buildOrderBy(resource: ListResource, fields: ListField[], sort: ListSort[]): unknown[] {
  const s = sort.length ? sort : resource.defaultSort;
  return [...s.map((x) => nest(field(resource, fields, x.field, 'sortable').path, x.dir)), { id: 'asc' }];
}

const str = (v: unknown) => (v === null || v === undefined ? '0' : String(v));

/** Runs one page (and, when asked, the groups) of a resource for a tenant. */
export async function runList(prisma: object, resource: ListResource, tenantId: string, query: ListQuery, permissions: ReadonlySet<string>): Promise<ListResult> {
  const fields = visibleFields(resource, permissions);
  const where = buildWhere(resource, fields, tenantId, query);
  const orderBy = buildOrderBy(resource, fields, query.sort);
  const sums = fields.filter((f) => f.sum && !f.computed && f.path.length === 1);
  const sumArg = sums.length ? { _sum: Object.fromEntries(sums.map((f) => [f.path[0], true])) } : {};
  const d = resource.delegate(prisma);

  const [records, total, agg] = await Promise.all([
    d.findMany({ where, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: resource.select }),
    d.count({ where }),
    sums.length ? d.aggregate({ where, ...sumArg }) : Promise.resolve({ _sum: {} }),
  ]);
  const totals: Record<string, string> = {
    ...Object.fromEntries(sums.map((f) => [f.key, str(agg._sum?.[f.path[0]])])),
    // Only fields this person may see (a value total stays hidden without cost.view).
    ...Object.fromEntries(
      Object.entries(resource.extraTotals ? await resource.extraTotals(prisma, tenantId, where) : {}).filter(([k]) => fields.some((f) => f.key === k)),
    ),
  };
  const allowed = new Set(fields.map((f) => f.key).concat('id'));
  let full = records.map((r) => resource.toRow(r));
  if (resource.enrich) full = await resource.enrich(prisma, tenantId, full);
  const rows = full.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => allowed.has(k))));

  let groups: ListGroup[] | undefined;
  if (query.groupBy) {
    const g = field(resource, fields, query.groupBy, 'groupable');
    if (g.path.length !== 1) throw new BadRequestException(`${resource.name}: "${g.key}" cannot be grouped`);
    const col = g.path[0];
    if (g.groupByMonth) {
      groups = await monthGroups(d, where, col, sums);
    } else {
    const raw = await d.groupBy({ by: [col], where, _count: { _all: true }, ...sumArg, orderBy: { _count: { [col]: 'desc' } }, take: 100 });
    const keys = raw.map((r) => (r[col] === null ? null : String(r[col])));
    const labels = resource.groupLabels ? await resource.groupLabels(prisma, tenantId, g.key, keys.filter((k): k is string => k !== null)) : {};
    groups = raw.map((r, i) => ({
      key: keys[i],
      label: keys[i] === null ? '' : labels[keys[i]!] ?? keys[i]!,
      count: Number((r['_count'] as { _all: number })._all),
      totals: Object.fromEntries(sums.map((f) => [f.key, str((r['_sum'] as Record<string, unknown> | undefined)?.[f.path[0]])])),
    }));
    }
  }

  return {
    rows,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totals,
    groups,
    fields: fields.map(({ key, type, sortable, filterable, groupable, groupByMonth, sum, enumValues, hidden, computed }) => ({ key, type, sortable: sortable && !computed, filterable: filterable && !computed, groupable: (groupable || groupByMonth) && !computed, sum, enumValues, hidden, computed })),
  };
}

const MONTH_GROUP_LIMIT = 100_000;

/** Groups by Pakistan month in memory (Prisma cannot group by a date part); newest month first. */
async function monthGroups(d: ListDelegate, where: Record<string, unknown>, col: string, sums: ListField[]): Promise<ListGroup[]> {
  const rows = await d.findMany({ where, select: { [col]: true, ...Object.fromEntries(sums.map((f) => [f.path[0], true])) }, take: MONTH_GROUP_LIMIT });
  const by = new Map<string, { count: number; totals: Record<string, Prisma.Decimal> }>();
  for (const r of rows) {
    const at = r[col] as Date | null;
    const key = at ? new Date(at.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 7) : '';
    const g = by.get(key) ?? { count: 0, totals: Object.fromEntries(sums.map((f) => [f.key, new Prisma.Decimal(0)])) };
    g.count += 1;
    for (const f of sums) g.totals[f.key] = g.totals[f.key].add(new Prisma.Decimal((r[f.path[0]] as Prisma.Decimal.Value | null) ?? 0));
    by.set(key, g);
  }
  return [...by.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, g]) => ({ key: key || null, label: key, count: g.count, totals: Object.fromEntries(Object.entries(g.totals).map(([k, v]) => [k, v.toString()])) }));
}
