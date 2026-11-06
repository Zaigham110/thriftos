import { Component, computed, inject, input, model, output } from '@angular/core';
import { ArrowDown, ArrowUp, ArrowUpDown, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { WsInfoComponent } from './info-tip.component';
import { WsStateComponent } from './state.component';

export type WsCellFormat = 'text' | 'number' | 'money' | 'kg' | 'date' | 'percent';

export interface WsColumn {
  key: string;
  label: string;
  format?: WsCellFormat;
  sortable?: boolean;
  /** CSS width, e.g. '120px' or '20%'. */
  width?: string;
  /** Summed in the totals row (number, money, kg). */
  total?: boolean;
  /** Money in whole rupees (lists); without it paisa show when there are any. */
  round?: boolean;
  /** What the column means, behind an "i" next to its name. */
  info?: string;
  /** 'sign': a value below zero shows red (a loss). */
  tone?: 'sign';
  /** Show nothing instead of "Rs 0" in the rows (ageing tables), so the real amounts stand out. */
  blankZero?: boolean;
}

/** A small button at the end of every row (e.g. "Receive", "Remind"); a row may list the ones it offers in `_actions`. */
export interface WsRowAction {
  id: string;
  label: string;
}

export interface WsSort {
  key: string;
  dir: 'asc' | 'desc';
}

export type WsRow = Record<string, unknown> & { id: string };

/**
 * The workspace table: sticky header, sorting, row selection, a totals row, numbers right-aligned in
 * tabular figures, density from the theme. Sorting is done here unless `serverSort` is set, in which case
 * only `sort` changes and the page fetches (the server list contract arrives in E2.1).
 */
@Component({
  selector: 'ws-data-grid',
  standalone: true,
  imports: [LucideAngularModule, TPipe, WsInfoComponent, WsStateComponent],
  template: `
    <div class="wrap" [attr.aria-busy]="loading()">
      @if (selectable() && selected().length) {
        <div class="bulk" role="status"><strong>{{ 'ws.grid.selected' | t: { n: selected().length } }}</strong><ng-content select="[bulk]" /><button type="button" class="link" (click)="selected.set([])">{{ 'ws.grid.clear' | t }}</button></div>
      }
      <table>
        <caption class="ws-visually-hidden">{{ caption() }}</caption>
        <colgroup>
          @if (selectable()) { <col style="width:44px" /> }
          @for (c of columns(); track c.key) { <col [style.width]="c.width ?? null" /> }
        </colgroup>
        <thead>
          <tr>
            @if (selectable()) {
              <th scope="col" class="check"><input type="checkbox" [checked]="allSelected()" [indeterminate]="someSelected()" (change)="toggleAll()" [attr.aria-label]="'ws.grid.selectAll' | t" /></th>
            }
            @for (c of columns(); track c.key) {
              <th scope="col" [class.end]="isNumeric(c)" [attr.aria-sort]="ariaSort(c)">
                <span class="th">
                  @if (c.sortable) {
                    <button type="button" (click)="toggleSort(c)">{{ c.label }}<lucide-icon [img]="sortIcon(c)" [size]="14" aria-hidden="true" /></button>
                  } @else { {{ c.label }} }
                  @if (c.info) { <ws-info [title]="c.label" [text]="c.info" /> }
                </span>
              </th>
            }
            @if (rowActions().length) { <th scope="col"><span class="sr-only">{{ 'ws.rc.actions' | t }}</span></th> }
          </tr>
        </thead>
        <tbody>
          @if (!loading()) {
            @for (r of sorted(); track r.id) {
              <tr [class.selected]="isSelected(r)" [class.clickable]="clickable()" (click)="clickable() && rowClick.emit(r)">
                @if (selectable()) {
                  <td class="check" (click)="$event.stopPropagation()"><input type="checkbox" [checked]="isSelected(r)" (change)="toggle(r)" [attr.aria-label]="'ws.grid.selectRow' | t" /></td>
                }
                @for (c of columns(); track c.key) { <td [class.end]="isNumeric(c)" [class.ws-num]="isNumeric(c)" [class.neg]="c.tone === 'sign' && isNeg(r[c.key])">{{ c.blankZero && isZero(r[c.key]) ? '' : cell(r[c.key], c.format, c.round) }}</td> }
                @if (rowActions().length) {
                  <td class="acts" (click)="$event.stopPropagation()">
                    @for (a of rowActions(); track a.id) {
                      @if (offers(r, a.id)) { <button type="button" class="act" (click)="rowAction.emit({ action: a.id, row: r })">{{ a.label }}</button> }
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
        @if (hasTotals() && !loading() && rows().length) {
          <tfoot>
            <tr>
              @if (selectable()) { <td></td> }
              @for (c of columns(); track c.key; let first = $first) {
                <td [class.end]="isNumeric(c)" [class.ws-num]="isNumeric(c)">{{ c.total ? cell(totals()[c.key], c.format, c.round) : first ? ('ws.grid.total' | t) : '' }}</td>
              }
              @if (rowActions().length) { <td></td> }
            </tr>
          </tfoot>
        }
      </table>
      @if (loading()) { <ws-state kind="loading" /> }
      @else if (!rows().length) { <ws-state [heading]="emptyHeading()" [message]="emptyMessage()"><ng-content select="[empty]" /></ws-state> }
    </div>
  `,
  styles: [`
    td.neg { color:var(--ws-bad); font-weight:600; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    td.acts { white-space:nowrap; text-align:end; }
    .act { height:28px; margin-inline-start:4px; padding-inline:10px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-size:var(--ws-text-sm); cursor:pointer; }
    .act:hover { border-color:var(--ws-brand); color:var(--ws-brand); }
    .wrap { overflow:auto; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    table { width:100%; border-collapse:separate; border-spacing:0; font-size:var(--ws-text-sm); }
    th, td { height:var(--ws-row-h); padding-inline:var(--ws-cell-px); border-block-end:1px solid var(--ws-line); text-align:start; white-space:nowrap; }
    thead th { position:sticky; top:0; z-index:1; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
    .th { display:inline-flex; align-items:center; gap:6px; }
    th button { display:inline-flex; align-items:center; gap:var(--ws-1); padding:0; border:0; background:transparent; color:inherit; font:inherit; text-transform:inherit; letter-spacing:inherit; cursor:pointer; }
    th button lucide-icon { color:var(--ws-ink-3); }
    .end { text-align:end; }
    .end button { flex-direction:row-reverse; }
    tbody tr:hover { background:var(--ws-surface-hover); }
    tr.clickable { cursor:pointer; }
    tr.selected { background:var(--ws-brand-soft); }
    tbody td { color:var(--ws-ink); }
    tfoot td { position:sticky; bottom:0; background:var(--ws-surface-2); font-weight:600; border-block-end:0; border-block-start:1px solid var(--ws-line-strong); }
    .check { width:44px; text-align:center; }
    input[type='checkbox'] { width:16px; height:16px; accent-color:var(--ws-brand); }
    .bulk { display:flex; align-items:center; gap:var(--ws-3); padding:var(--ws-2) var(--ws-3); border-block-end:1px solid var(--ws-line); background:var(--ws-brand-soft); color:var(--ws-brand); }
    .link { margin-inline-start:auto; border:0; background:transparent; color:var(--ws-brand); font:inherit; font-weight:600; cursor:pointer; }
  `],
})
export class WsDataGridComponent {
  private readonly i18n = inject(I18nService);
  readonly columns = input.required<WsColumn[]>();
  readonly rows = input.required<WsRow[]>();
  readonly caption = input('');
  readonly loading = input(false);
  readonly selectable = input(false);
  readonly clickable = input(false);
  readonly serverSort = input(false);
  readonly emptyHeading = input('');
  readonly emptyMessage = input('');
  /** Totals from the server (all matching rows, not just this page); otherwise summed here. */
  readonly serverTotals = input<Record<string, string> | null>(null);
  readonly sort = model<WsSort | null>(null);
  readonly selected = model<string[]>([]);
  readonly rowClick = output<WsRow>();
  readonly rowActions = input<WsRowAction[]>([]);
  readonly rowAction = output<{ action: string; row: WsRow }>();

  protected readonly sorted = computed(() => {
    const s = this.sort();
    const rows = this.rows();
    if (!s || this.serverSort()) return rows;
    const dir = s.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compare(a[s.key], b[s.key]) * dir);
  });
  protected readonly hasTotals = computed(() => this.columns().some((c) => c.total));
  protected readonly totals = computed<Record<string, string | number>>(() => {
    const server = this.serverTotals();
    if (server) return server;
    const out: Record<string, number> = {};
    for (const c of this.columns().filter((c) => c.total)) out[c.key] = this.rows().reduce((sum, r) => sum + (Number(r[c.key]) || 0), 0);
    return out;
  });
  protected readonly allSelected = computed(() => !!this.rows().length && this.rows().every((r) => this.selected().includes(r.id)));
  protected readonly someSelected = computed(() => !!this.selected().length && !this.allSelected());

  protected isNumeric(c: WsColumn): boolean {
    return c.format === 'number' || c.format === 'money' || c.format === 'kg' || c.format === 'percent';
  }

  protected isZero(v: unknown): boolean {
    return v === null || v === undefined || v === '' || Number(v) === 0;
  }

  protected offers(r: WsRow, id: string): boolean {
    const list = r['_actions'] as string[] | undefined;
    return !list || list.includes(id);
  }

  protected isNeg(v: unknown): boolean {
    return v !== null && v !== undefined && v !== '' && Number(v) < 0;
  }

  protected cell(v: unknown, format: WsCellFormat = 'text', round = false): string {
    if (v === null || v === undefined || v === '') return '—';
    switch (format) {
      case 'money': return this.i18n.money(round ? Math.round(Number(v)) : (v as number | string));
      case 'kg': return this.i18n.kg(v as number | string);
      case 'number': return this.i18n.num(v as number | string);
      case 'percent': return `${this.i18n.num(v as number | string, 0)}%`;
      case 'date': {
        const d = new Date(v as string);
        return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
      }
      default: return String(v);
    }
  }

  protected toggleSort(c: WsColumn): void {
    const s = this.sort();
    this.sort.set(s?.key !== c.key ? { key: c.key, dir: 'asc' } : s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null);
  }
  protected sortIcon(c: WsColumn) {
    const s = this.sort();
    return s?.key !== c.key ? ArrowUpDown : s.dir === 'asc' ? ArrowUp : ArrowDown;
  }
  protected ariaSort(c: WsColumn): string | null {
    if (!c.sortable) return null;
    const s = this.sort();
    return s?.key === c.key ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  protected isSelected(r: WsRow): boolean {
    return this.selected().includes(r.id);
  }
  protected toggle(r: WsRow): void {
    this.selected.set(this.isSelected(r) ? this.selected().filter((id) => id !== r.id) : [...this.selected(), r.id]);
  }
  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? [] : this.rows().map((r) => r.id));
  }
}

/** Numbers by value, dates by time, text by the reader's language; empty values last. */
export function compare(a: unknown, b: unknown): number {
  const empty = (v: unknown) => v === null || v === undefined || v === '';
  if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1;
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  const da = Date.parse(String(a)), db = Date.parse(String(b));
  if (!isNaN(da) && !isNaN(db) && /\d{4}-\d{2}-\d{2}/.test(String(a))) return da - db;
  return String(a).localeCompare(String(b));
}
