import { BadRequestException } from '@nestjs/common';

/**
 * One list contract for every workspace list (enterprise plan E2.1). Query string:
 *   page=1  pageSize=25 (max 200)
 *   sort=date:desc,customer:asc
 *   f=customer:contains:rafiq   f=status:in:PAID|PARTIALLY_PAID   f=total:between:10000..50000   f=dueDate:isnull
 *   q=free text (searchable fields)   groupBy=status
 * Each resource lists its fields, what can be filtered, sorted, grouped and summed; anything else is a 400.
 */
export type FieldType = 'string' | 'number' | 'date' | 'enum' | 'boolean';
export type FilterOp = 'eq' | 'ne' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isnull' | 'notnull';

export const OPS_BY_TYPE: Record<FieldType, FilterOp[]> = {
  string: ['eq', 'ne', 'in', 'contains', 'isnull', 'notnull'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isnull', 'notnull'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'isnull', 'notnull'],
  enum: ['eq', 'ne', 'in', 'isnull', 'notnull'],
  boolean: ['eq'],
};

export interface ListFilter {
  field: string;
  op: FilterOp;
  /** Already split for in (|) and between (..); absent for isnull/notnull. */
  values: string[];
}

export interface ListSort {
  field: string;
  dir: 'asc' | 'desc';
}

export interface ListQuery {
  page: number;
  pageSize: number;
  sort: ListSort[];
  filters: ListFilter[];
  q: string;
  groupBy: string | null;
}

export const MAX_PAGE_SIZE = 200;

/** Reads the raw query object (Express) into a ListQuery; format errors only (fields are checked by the resource). */
export function parseListQuery(raw: Record<string, unknown>): ListQuery {
  const one = (k: string) => (Array.isArray(raw[k]) ? String((raw[k] as unknown[])[0]) : raw[k] === undefined ? undefined : String(raw[k]));
  const int = (k: string, dflt: number, min: number, max: number) => {
    const v = one(k);
    if (v === undefined || v === '') return dflt;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${k} must be a whole number from ${min} to ${max}`);
    return n;
  };

  const sort: ListSort[] = (one('sort') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [field, dir = 'asc'] = s.split(':');
      if (!field || (dir !== 'asc' && dir !== 'desc')) throw new BadRequestException(`sort "${s}" must be field:asc or field:desc`);
      return { field, dir };
    });

  const rawFilters = raw['f'] === undefined ? [] : Array.isArray(raw['f']) ? (raw['f'] as unknown[]).map(String) : [String(raw['f'])];
  if (rawFilters.length > 20) throw new BadRequestException('At most 20 filters');
  const filters: ListFilter[] = rawFilters.map((f) => {
    const i = f.indexOf(':');
    const j = i < 0 ? -1 : f.indexOf(':', i + 1);
    const field = i < 0 ? f : f.slice(0, i);
    const op = (j < 0 ? f.slice(i + 1) : f.slice(i + 1, j)) as FilterOp;
    const value = j < 0 ? undefined : f.slice(j + 1);
    if (!field || !op) throw new BadRequestException(`filter "${f}" must be field:op:value`);
    if (op === 'isnull' || op === 'notnull') return { field, op, values: [] };
    if (value === undefined || value === '') throw new BadRequestException(`filter "${f}" needs a value`);
    const values = op === 'in' ? value.split('|') : op === 'between' ? value.split('..') : [value];
    if (op === 'between' && values.length !== 2) throw new BadRequestException(`filter "${f}": between needs a..b`);
    if (op === 'in' && values.length > 50) throw new BadRequestException(`filter "${f}": at most 50 values`);
    return { field, op, values };
  });

  const q = (one('q') ?? '').trim();
  if (q.length > 100) throw new BadRequestException('q is at most 100 characters');
  return {
    page: int('page', 1, 1, 100000),
    pageSize: int('pageSize', 25, 1, MAX_PAGE_SIZE),
    sort,
    filters,
    q,
    groupBy: one('groupBy')?.trim() || null,
  };
}
