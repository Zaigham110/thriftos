import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Lang } from '../i18n/i18n.service';

/** The server's list contract (GET /api/lists/:name), enterprise plan E2.1. */
export interface ListFieldMeta {
  key: string;
  type: 'string' | 'number' | 'date' | 'enum' | 'boolean';
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  sum?: boolean;
  enumValues?: string[];
  hidden?: boolean;
}

export interface ListGroup {
  key: string | null;
  label: string;
  count: number;
  totals: Record<string, string>;
}

export interface ListResult<Row = Record<string, unknown> & { id: string }> {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
  totals: Record<string, string>;
  groups?: ListGroup[];
  fields: ListFieldMeta[];
}

/** A filter as the server reads it: "field:op:value" (in → a|b, between → a..b, isnull/notnull → no value). */
export interface ListFilterState {
  field: string;
  op: 'eq' | 'ne' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isnull' | 'notnull';
  value?: string;
}

/** Everything a list screen remembers (also what a saved view stores). */
export interface ListState {
  page: number;
  pageSize: number;
  sort: { field: string; dir: 'asc' | 'desc' } | null;
  filters: ListFilterState[];
  q: string;
  groupBy: string | null;
  /** Visible columns in order; empty = the screen's default. */
  columns: string[];
}

export const DEFAULT_LIST_STATE: ListState = { page: 1, pageSize: 25, sort: null, filters: [], q: '', groupBy: null, columns: [] };

export interface SavedView {
  id: string;
  resource: string;
  name: string;
  state: Partial<ListState>;
  isDefault: boolean;
}

export function filterParam(f: ListFilterState): string {
  return f.op === 'isnull' || f.op === 'notnull' ? `${f.field}:${f.op}` : `${f.field}:${f.op}:${f.value ?? ''}`;
}

/** Query parameters for a state (without paging for exports, and without group-by). */
export function listParams(state: ListState, opts: { paging?: boolean; groups?: boolean } = {}): HttpParams {
  let p = new HttpParams();
  if (opts.paging !== false) p = p.set('page', state.page).set('pageSize', state.pageSize);
  if (state.sort) p = p.set('sort', `${state.sort.field}:${state.sort.dir}`);
  if (state.q.trim()) p = p.set('q', state.q.trim());
  for (const f of state.filters) p = p.append('f', filterParam(f));
  if (opts.groups !== false && state.groupBy) p = p.set('groupBy', state.groupBy);
  return p;
}

@Injectable({ providedIn: 'root' })
export class ListClient {
  private readonly http = inject(HttpClient);

  page<Row = Record<string, unknown> & { id: string }>(name: string, state: ListState): Observable<ListResult<Row>> {
    return this.http.get<ListResult<Row>>(`/api/lists/${name}`, { params: listParams(state) });
  }

  /** Downloads the whole filtered list as CSV or Excel (the browser saves it). */
  export(name: string, state: ListState, format: 'csv' | 'xlsx', lang: Lang, columns: string[]): Observable<void> {
    let params = listParams(state, { paging: false, groups: false }).set('format', format).set('lang', lang);
    if (columns.length) params = params.set('columns', columns.join(','));
    return new Observable<void>((sub) => {
      const s = this.http.get(`/api/lists/${name}/export`, { params, observe: 'response', responseType: 'blob' }).subscribe({
        next: (res) => {
          const file = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${name}.${format}`;
          const url = URL.createObjectURL(res.body!);
          const a = document.createElement('a');
          a.href = url;
          a.download = file;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
          sub.next();
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
      return () => s.unsubscribe();
    });
  }

  views(resource: string): Observable<SavedView[]> {
    return this.http.get<SavedView[]>('/api/views', { params: { resource } });
  }
  saveView(resource: string, name: string, state: Partial<ListState>, isDefault = false): Observable<SavedView> {
    return this.http.post<SavedView>('/api/views', { resource, name, state, isDefault });
  }
  updateView(id: string, patch: { name?: string; state?: Partial<ListState>; isDefault?: boolean }): Observable<SavedView> {
    return this.http.patch<SavedView>(`/api/views/${id}`, patch);
  }
  deleteView(id: string): Observable<void> {
    return this.http.delete<void>(`/api/views/${id}`);
  }
}
