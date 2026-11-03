import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChevronDown, Download, LucideAngularModule, Plus } from 'lucide-angular';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { DEFAULT_LIST_STATE, ListClient, ListFilterState, ListResult, ListState, SavedView } from '../../core/list/list-client';
import { ToastService } from '../../shared/floor/toast.service';
import {
  WsColumn,
  WsCommandBarComponent,
  WsDataGridComponent,
  WsDateRange,
  WsDateRangeComponent,
  WsFilterBarComponent,
  WsFilterChip,
  WsPageHeaderComponent,
  WsPagerComponent,
  WsRow,
  WsSort,
  WsStateComponent,
  WsViewMenuComponent,
  rangeFor,
} from '../../shared/ui/workspace';

const RESOURCE = 'sales';
const STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const;
const MODES = ['CASH', 'CREDIT', 'PARTIAL'] as const;
const ALL_COLUMNS = ['number', 'date', 'customer', 'city', 'status', 'paymentMode', 'total', 'cost', 'profit', 'createdBy'] as const;
const DEFAULT_COLUMNS = ['number', 'date', 'customer', 'city', 'status', 'paymentMode', 'total', 'profit'];

/**
 * Sales list in the workspace (enterprise plan E2): server paging, sort, filters, search, group-by with
 * subtotals, totals for all matching sales, saved views, column chooser, CSV/Excel export. Click a sale
 * to open its record page.
 */
@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    TPipe,
    WsCommandBarComponent,
    WsDataGridComponent,
    WsDateRangeComponent,
    WsFilterBarComponent,
    WsPageHeaderComponent,
    WsPagerComponent,
    WsStateComponent,
    WsViewMenuComponent,
  ],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.sales.title' | t" [subtitle]="result() ? ('ws.sales.count' | t: { n: i18n.num(result()!.total) }) : ''">
        <a actions class="ws-btn primary" routerLink="/sell/new"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.new.sale' | t }}</a>
      </ws-page-header>

      <ws-command-bar>
        <div start class="row">
          <ws-view-menu [views]="views()" [current]="view()" (choose)="applyView($event)" (save)="saveView($event)" (makeDefault)="makeDefault($event)" (remove)="removeView($event)" />
          <label class="select">{{ 'ws.groupBy' | t }}
            <select [ngModel]="state().groupBy ?? ''" (ngModelChange)="patch({ groupBy: $event || null, page: 1 })">
              <option value="">{{ 'ws.group.none' | t }}</option>
              <option value="status">{{ 'ws.col.status' | t }}</option>
              <option value="paymentMode">{{ 'ws.col.paymentMode' | t }}</option>
              <option value="customerId">{{ 'ws.col.customer' | t }}</option>
            </select>
          </label>
          <div class="menu-wrap">
            <button type="button" class="ws-btn" (click)="menu.set(menu() === 'columns' ? null : 'columns')" [attr.aria-expanded]="menu() === 'columns'">{{ 'ws.columns' | t }}<lucide-icon [img]="icons.ChevronDown" [size]="14" aria-hidden="true" /></button>
            @if (menu() === 'columns') {
              <div class="menu" role="group" [attr.aria-label]="'ws.columns' | t">
                @for (c of availableColumns(); track c) {
                  <label class="check"><input type="checkbox" [checked]="visible().includes(c)" (change)="toggleColumn(c)" />{{ 'ws.col.' + c | t }}</label>
                }
              </div>
            }
          </div>
          <div class="menu-wrap">
            <button type="button" class="ws-btn" (click)="menu.set(menu() === 'export' ? null : 'export')" [attr.aria-expanded]="menu() === 'export'" [disabled]="exporting()">
              <lucide-icon [img]="icons.Download" [size]="16" aria-hidden="true" />{{ (exporting() ? 'common.loading' : 'ws.export.label') | t }}
            </button>
            @if (menu() === 'export') {
              <div class="menu" role="menu">
                <button type="button" role="menuitem" (click)="export('xlsx')">{{ 'ws.export.xlsx' | t }}</button>
                <button type="button" role="menuitem" (click)="export('csv')">{{ 'ws.export.csv' | t }}</button>
              </div>
            }
          </div>
        </div>
        <ws-date-range end [allowAll]="true" [value]="range()" (valueChange)="setRange($event)" />
      </ws-command-bar>

      <ws-filter-bar [query]="state().q" (queryChange)="query.set($event)" [placeholder]="'ws.sales.search' | t" [chips]="chips()" (remove)="removeFilter($event)" (clearAll)="clearFilters()">
        <select add class="quick" [ngModel]="''" (ngModelChange)="addFilter('status', $event)" [attr.aria-label]="'ws.col.status' | t">
          <option value="">{{ 'ws.col.status' | t }}…</option>
          @for (s of statuses; track s) { <option [value]="s">{{ 'ws.status.' + s | t }}</option> }
        </select>
        <select add class="quick" [ngModel]="''" (ngModelChange)="addFilter('paymentMode', $event)" [attr.aria-label]="'ws.col.paymentMode' | t">
          <option value="">{{ 'ws.col.paymentMode' | t }}…</option>
          @for (m of modes; track m) { <option [value]="m">{{ 'ws.mode.' + m | t }}</option> }
        </select>
      </ws-filter-bar>

      @if (failed()) {
        <ws-state kind="error" (retry)="reload()" />
      } @else if (state().groupBy) {
        <ws-data-grid [caption]="'ws.sales.title' | t" [columns]="groupColumns()" [rows]="groupRows()" [loading]="loading()" [clickable]="true" [serverTotals]="groupTotals()" (rowClick)="openGroup($event)" />
      } @else {
        <ws-data-grid [caption]="'ws.sales.title' | t" [columns]="columns()" [rows]="rows()" [loading]="loading()" [clickable]="true" [serverSort]="true"
          [sort]="gridSort()" (sortChange)="setSort($event)" [serverTotals]="totals()" (rowClick)="open($event)"
          [emptyHeading]="'ws.sales.emptyHeading' | t" [emptyMessage]="'ws.sales.emptyMessage' | t" />
        <ws-pager [page]="state().page" (pageChange)="patch({ page: $event })" [pageSize]="state().pageSize" (pageSizeChange)="patch({ pageSize: $event, page: 1 })" [total]="result()?.total ?? 0" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .row { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .ws-btn { height:var(--ws-control-h); display:inline-flex; align-items:center; gap:6px; padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-weight:500; text-decoration:none; cursor:pointer; }
    .ws-btn:hover { background:var(--ws-surface-hover); }
    .ws-btn.primary { border-color:var(--ws-brand); background:var(--ws-brand); color:var(--ws-brand-ink); }
    .select { display:inline-flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .menu-wrap { position:relative; }
    .menu { position:absolute; inset-block-start:calc(100% + 6px); inset-inline-start:0; z-index:30; min-width:200px; display:grid; padding:var(--ws-1); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); }
    .menu button, .check { display:flex; align-items:center; gap:var(--ws-2); min-height:34px; padding-inline:var(--ws-2); border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink); font:inherit; text-align:start; cursor:pointer; }
    .menu button:hover, .check:hover { background:var(--ws-surface-hover); }
    .check input { accent-color:var(--ws-brand); }
  `],
})
export class SalesListComponent {
  protected readonly i18n = inject(I18nService);
  private readonly lists = inject(ListClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { ChevronDown, Download, Plus };
  protected readonly statuses = STATUSES;
  protected readonly modes = MODES;

  protected readonly state = signal<ListState>({ ...DEFAULT_LIST_STATE, columns: DEFAULT_COLUMNS });
  protected readonly query = signal('');
  protected readonly result = signal<ListResult | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly menu = signal<'columns' | 'export' | null>(null);
  protected readonly views = signal<SavedView[]>([]);
  protected readonly view = signal<SavedView | null>(null);
  private readonly reloads = signal(0);

  /** Columns the server lets this person see (cost and profit need cost.view). */
  protected readonly availableColumns = computed(() => {
    const keys = new Set((this.result()?.fields ?? []).filter((f) => !f.hidden).map((f) => f.key));
    return this.result() ? ALL_COLUMNS.filter((c) => keys.has(c)) : [...ALL_COLUMNS];
  });
  protected readonly visible = computed(() => {
    const allowed = this.availableColumns();
    const chosen = this.state().columns.length ? this.state().columns : DEFAULT_COLUMNS;
    return chosen.filter((c) => (allowed as readonly string[]).includes(c));
  });
  protected readonly columns = computed<WsColumn[]>(() =>
    this.visible().map((key) => ({
      key,
      label: this.i18n.t(`ws.col.${key}`),
      sortable: key !== 'createdBy',
      format: key === 'date' ? 'date' : ['total', 'cost', 'profit'].includes(key) ? 'money' : 'text',
      total: ['total', 'cost', 'profit'].includes(key),
      width: key === 'number' ? '130px' : undefined,
    })),
  );
  protected readonly rows = computed<WsRow[]>(() =>
    (this.result()?.rows ?? []).map((r) => ({
      ...r,
      status: this.i18n.t(`ws.status.${r['status']}`),
      paymentMode: this.i18n.t(`ws.mode.${r['paymentMode']}`),
    })) as WsRow[],
  );
  protected readonly totals = computed(() => this.result()?.totals ?? null);
  protected readonly gridSort = computed<WsSort | null>(() => {
    const s = this.state().sort;
    return s ? { key: s.field, dir: s.dir } : null;
  });

  protected readonly groupColumns = computed<WsColumn[]>(() => {
    const sums = ['total', 'profit'].filter((k) => (this.availableColumns() as readonly string[]).includes(k));
    return [
      { key: 'label', label: this.i18n.t(`ws.col.${this.state().groupBy === 'customerId' ? 'customer' : this.state().groupBy}`) },
      { key: 'count', label: this.i18n.t('ws.col.count'), format: 'number', total: true },
      ...sums.map((k) => ({ key: k, label: this.i18n.t(`ws.col.${k}`), format: 'money' as const, total: true })),
    ];
  });
  protected readonly groupRows = computed<WsRow[]>(() => {
    const g = this.state().groupBy;
    return (this.result()?.groups ?? []).map((x) => ({
      id: x.key ?? '∅',
      key: x.key,
      label: g === 'status' ? this.i18n.t(`ws.status.${x.label}`) : g === 'paymentMode' ? this.i18n.t(`ws.mode.${x.label}`) : x.label || '—',
      count: x.count,
      ...x.totals,
    }));
  });
  protected readonly groupTotals = computed(() => {
    const r = this.result();
    return r ? { ...r.totals, count: String(r.total) } : null;
  });

  protected readonly range = computed<WsDateRange>(() => {
    const f = this.state().filters.find((x) => x.field === 'date' && x.op === 'between');
    if (!f?.value) return rangeFor('all');
    const [from, to] = f.value.split('..');
    return { preset: (this.state() as ListState & { datePreset?: WsDateRange['preset'] }).datePreset ?? 'custom', from, to };
  });

  protected readonly chips = computed<WsFilterChip[]>(() =>
    this.state().filters
      .filter((f) => f.field !== 'date')
      .map((f, i) => ({
        id: String(i),
        label: this.i18n.t(`ws.col.${f.field}`),
        value: f.field === 'status' ? this.i18n.t(`ws.status.${f.value}`) : f.field === 'paymentMode' ? this.i18n.t(`ws.mode.${f.value}`) : f.value ?? '',
      })),
  );

  constructor() {
    toObservable(this.query)
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.patch({ q, page: 1 }));

    const request = computed(() => ({ state: this.state(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ state }) => {
          this.loading.set(true);
          this.failed.set(false);
          return this.lists.page(RESOURCE, state).pipe(
            map((r) => ({ ok: true as const, r })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.loading.set(false);
        if (x.ok) this.result.set(x.r);
        else this.failed.set(true);
      });

    this.lists.views(RESOURCE).pipe(takeUntilDestroyed()).subscribe({
      next: (views) => {
        this.views.set(views);
        const dflt = views.find((v) => v.isDefault);
        if (dflt) this.applyView(dflt);
      },
      error: () => undefined,
    });

    effect(() => {
      // Closing menus when the list changes keeps them from floating over new rows.
      this.state();
      this.menu.set(null);
    });
  }

  protected patch(p: Partial<ListState> & { datePreset?: WsDateRange['preset'] }): void {
    this.state.set({ ...this.state(), ...p });
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  protected setSort(s: WsSort | null): void {
    this.patch({ sort: s ? { field: s.key, dir: s.dir } : null, page: 1 });
  }

  protected setRange(r: WsDateRange): void {
    const rest = this.state().filters.filter((f) => f.field !== 'date');
    this.patch({ filters: r.from && r.to ? [...rest, { field: 'date', op: 'between', value: `${r.from}..${r.to}` }] : rest, page: 1, datePreset: r.preset });
  }

  protected addFilter(field: 'status' | 'paymentMode', value: string): void {
    if (!value) return;
    const rest = this.state().filters.filter((f) => f.field !== field);
    this.patch({ filters: [...rest, { field, op: 'eq', value }], page: 1 });
  }

  protected removeFilter(chipId: string): void {
    const shown = this.state().filters.filter((f) => f.field !== 'date');
    const gone = shown[Number(chipId)];
    this.patch({ filters: this.state().filters.filter((f) => f !== gone), page: 1 });
  }

  protected clearFilters(): void {
    this.patch({ filters: this.state().filters.filter((f) => f.field === 'date'), page: 1 });
  }

  protected toggleColumn(c: string): void {
    const now = this.visible();
    const next = now.includes(c) ? now.filter((x) => x !== c) : ALL_COLUMNS.filter((x) => now.includes(x) || x === c);
    if (next.length) this.patch({ columns: [...next] });
  }

  protected openGroup(row: WsRow): void {
    const g = this.state().groupBy!;
    const filter: ListFilterState = row['key'] === null ? { field: g, op: 'isnull' } : { field: g, op: 'eq', value: String(row['key']) };
    if (g === 'customerId') {
      this.patch({ groupBy: null, filters: [...this.state().filters.filter((f) => f.field !== 'customerId' && f.field !== 'customer'), { field: 'customer', op: 'eq', value: String(row['label']) }], page: 1 });
      return;
    }
    this.patch({ groupBy: null, filters: [...this.state().filters.filter((f) => f.field !== g), filter], page: 1 });
  }

  protected open(row: WsRow): void {
    void this.router.navigate(['/sell/records', row.id]);
  }

  protected export(format: 'csv' | 'xlsx'): void {
    this.menu.set(null);
    this.exporting.set(true);
    this.lists.export(RESOURCE, this.state(), format, this.i18n.lang(), this.visible()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: () => { this.exporting.set(false); this.toast.show(this.i18n.t('common.couldNotLoad')); },
    });
  }

  // ---- saved views ----
  private viewState(): Partial<ListState> {
    const { page: _page, ...rest } = this.state();
    return rest;
  }

  protected applyView(v: SavedView | null): void {
    this.view.set(v);
    this.state.set({ ...DEFAULT_LIST_STATE, columns: DEFAULT_COLUMNS, ...(v?.state ?? {}), page: 1 });
  }

  protected saveView(name: string): void {
    this.lists.saveView(RESOURCE, name, this.viewState()).subscribe({
      next: (v) => { this.views.set([...this.views(), v]); this.view.set(v); this.toast.show(this.i18n.t('ws.views.saved', { name })); },
      error: (e: { status?: number }) => this.toast.show(this.i18n.t(e.status === 409 ? 'ws.views.taken' : 'common.couldNotSave')),
    });
  }

  protected makeDefault(v: SavedView): void {
    this.lists.updateView(v.id, { isDefault: !v.isDefault }).subscribe({
      next: (u) => this.views.set(this.views().map((x) => (x.id === u.id ? u : { ...x, isDefault: u.isDefault ? false : x.isDefault }))),
      error: () => this.toast.show(this.i18n.t('common.couldNotSave')),
    });
  }

  protected removeView(v: SavedView): void {
    this.lists.deleteView(v.id).subscribe({
      next: () => { this.views.set(this.views().filter((x) => x.id !== v.id)); if (this.view()?.id === v.id) this.applyView(null); },
      error: () => this.toast.show(this.i18n.t('common.couldNotSave')),
    });
  }
}
