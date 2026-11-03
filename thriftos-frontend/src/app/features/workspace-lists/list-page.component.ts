import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChevronDown, Columns3, Download, LayoutGrid, LucideAngularModule, Plus, Rows3 } from 'lucide-angular';
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
import { BoardComponent } from './board.component';
import type { ListConfig } from './list-config';

type Extra = { datePreset?: WsDateRange['preset']; layout?: 'table' | 'board' };

/**
 * One workspace list screen, configured per record type (route data `list`): server paging, sort, filters,
 * search, group-by with subtotals, totals for all matching rows, saved views, column chooser, CSV/Excel
 * export, and — where configured — a board by status. Clicking a row opens its record page.
 */
@Component({
  selector: 'app-list-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    TPipe,
    BoardComponent,
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
    @let c = list();
    <div class="page">
      <ws-page-header [heading]="c.title | t" [subtitle]="result() ? (c.count | t: { n: i18n.num(result()!.total) }) : ''">
        @if (c.create; as create) { <a actions class="ws-btn primary" [routerLink]="create.link"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ create.label | t }}</a> }
      </ws-page-header>

      <ws-command-bar>
        <div start class="row">
          <ws-view-menu [views]="views()" [current]="view()" (choose)="applyView($event)" (save)="saveView($event)" (makeDefault)="makeDefault($event)" (remove)="removeView($event)" />
          @if (c.board) {
            <div class="switch" role="group" [attr.aria-label]="'ws.layout.label' | t">
              <button type="button" class="ws-btn" [class.on]="layout() === 'table'" [attr.aria-pressed]="layout() === 'table'" (click)="patch({ layout: 'table' })"><lucide-icon [img]="icons.Rows3" [size]="16" aria-hidden="true" />{{ 'ws.layout.table' | t }}</button>
              <button type="button" class="ws-btn" [class.on]="layout() === 'board'" [attr.aria-pressed]="layout() === 'board'" (click)="patch({ layout: 'board', groupBy: null })"><lucide-icon [img]="icons.LayoutGrid" [size]="16" aria-hidden="true" />{{ 'ws.layout.board' | t }}</button>
            </div>
          }
          @if (layout() === 'table' && c.groupBy.length) {
            <label class="select">{{ 'ws.groupBy' | t }}
              <select [ngModel]="state().groupBy ?? ''" (ngModelChange)="patch({ groupBy: $event || null, page: 1 })">
                <option value="">{{ 'ws.group.none' | t }}</option>
                @for (g of c.groupBy; track g.key) { <option [value]="g.key">{{ g.label | t }}</option> }
              </select>
            </label>
          }
          @if (layout() === 'table') {
            <div class="menu-wrap">
              <button type="button" class="ws-btn" (click)="menu.set(menu() === 'columns' ? null : 'columns')" [attr.aria-expanded]="menu() === 'columns'"><lucide-icon [img]="icons.Columns3" [size]="16" aria-hidden="true" />{{ 'ws.columns' | t }}<lucide-icon [img]="icons.ChevronDown" [size]="14" aria-hidden="true" /></button>
              @if (menu() === 'columns') {
                <div class="menu" role="group" [attr.aria-label]="'ws.columns' | t">
                  @for (col of availableColumns(); track col.key) {
                    <label class="check"><input type="checkbox" [checked]="visible().includes(col.key)" (change)="toggleColumn(col.key)" />{{ col.label | t }}</label>
                  }
                </div>
              }
            </div>
          }
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
        @if (c.dateField) { <ws-date-range end [allowAll]="true" [value]="range()" (valueChange)="setRange($event)" /> }
      </ws-command-bar>

      <ws-filter-bar [query]="state().q" (queryChange)="query.set($event)" [placeholder]="c.searchPlaceholder | t" [chips]="chips()" (remove)="removeFilter($event)" (clearAll)="clearFilters()">
        @for (qf of c.quickFilters; track qf.field) {
          <select add class="quick" [ngModel]="''" (ngModelChange)="addFilter(qf.field, $event)" [attr.aria-label]="qf.label | t">
            <option value="">{{ qf.label | t }}…</option>
            @for (v of qf.values; track v) { <option [value]="v">{{ qf.prefix + v | t }}</option> }
          </select>
        }
      </ws-filter-bar>

      @if (failed()) {
        <ws-state kind="error" (retry)="reload()" />
      } @else if (layout() === 'board' && c.board) {
        <app-board [config]="c" [state]="state()" (open)="openId($event)" (moved)="reload()" />
      } @else if (state().groupBy) {
        <ws-data-grid [caption]="c.title | t" [columns]="groupColumns()" [rows]="groupRows()" [loading]="loading()" [clickable]="true" [serverTotals]="groupTotals()" (rowClick)="openGroup($event)" />
      } @else {
        <ws-data-grid [caption]="c.title | t" [columns]="columns()" [rows]="rows()" [loading]="loading()" [clickable]="true" [serverSort]="true"
          [sort]="gridSort()" (sortChange)="setSort($event)" [serverTotals]="totals()" (rowClick)="open($event)"
          [emptyHeading]="c.emptyHeading | t" [emptyMessage]="c.emptyMessage | t" />
        <ws-pager [page]="state().page" (pageChange)="patch({ page: $event })" [pageSize]="state().pageSize" (pageSizeChange)="patch({ pageSize: $event, page: 1 })" [total]="result()?.total ?? 0" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .row { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .switch { display:inline-flex; }
    .switch .ws-btn:first-child { border-start-end-radius:0; border-end-end-radius:0; }
    .switch .ws-btn:last-child { border-start-start-radius:0; border-end-start-radius:0; margin-inline-start:-1px; }
    .switch .ws-btn.on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); z-index:1; }
    .select { display:inline-flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .menu-wrap { position:relative; }
    .menu { position:absolute; inset-block-start:calc(100% + 6px); inset-inline-start:0; z-index:30; min-width:200px; display:grid; padding:var(--ws-1); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); }
    .menu button, .check { display:flex; align-items:center; gap:var(--ws-2); min-height:34px; padding-inline:var(--ws-2); border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink); font:inherit; text-align:start; cursor:pointer; }
    .menu button:hover, .check:hover { background:var(--ws-surface-hover); }
    .check input { accent-color:var(--ws-brand); }
  `],
})
export class ListPageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly lists = inject(ListClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  /** From route data. */
  readonly list = input.required<ListConfig>();
  protected readonly icons = { ChevronDown, Columns3, Download, LayoutGrid, Plus, Rows3 };

  protected readonly state = signal<ListState & Extra>({ ...DEFAULT_LIST_STATE });
  protected readonly query = signal('');
  protected readonly result = signal<ListResult | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly menu = signal<'columns' | 'export' | null>(null);
  protected readonly views = signal<SavedView[]>([]);
  protected readonly view = signal<SavedView | null>(null);
  private readonly reloads = signal(0);

  protected readonly layout = computed(() => (this.list().board ? this.state().layout ?? 'table' : 'table'));

  /** Columns the server lets this person see (fields behind a permission are not sent). */
  protected readonly availableColumns = computed(() => {
    const fields = this.result()?.fields;
    if (!fields) return this.list().columns;
    const keys = new Set(fields.filter((f) => !f.hidden).map((f) => f.key));
    return this.list().columns.filter((c) => keys.has(c.key));
  });
  protected readonly visible = computed(() => {
    const allowed = new Set(this.availableColumns().map((c) => c.key));
    const chosen = this.state().columns.length ? this.state().columns : this.list().defaultColumns;
    return chosen.filter((c) => allowed.has(c));
  });
  protected readonly columns = computed<WsColumn[]>(() =>
    this.visible().map((key) => {
      const c = this.list().columns.find((x) => x.key === key)!;
      return { key, label: this.i18n.t(c.label), sortable: !c.computed, format: c.format ?? 'text', total: c.total, width: c.width };
    }),
  );
  protected readonly rows = computed<WsRow[]>(() => {
    const enums = this.list().columns.filter((c) => c.enumPrefix);
    return (this.result()?.rows ?? []).map((r) => {
      const row: Record<string, unknown> = { ...r };
      for (const c of enums) if (row[c.key] !== null && row[c.key] !== undefined) row[c.key] = this.i18n.t(`${c.enumPrefix}${row[c.key]}`);
      return row as WsRow;
    });
  });
  protected readonly totals = computed(() => this.result()?.totals ?? null);
  protected readonly gridSort = computed<WsSort | null>(() => {
    const s = this.state().sort;
    return s ? { key: s.field, dir: s.dir } : null;
  });

  private readonly groupConfig = computed(() => this.list().groupBy.find((g) => g.key === this.state().groupBy));
  protected readonly groupColumns = computed<WsColumn[]>(() => {
    const sums = this.list().columns.filter((c) => c.total && !c.computed && this.availableColumns().some((a) => a.key === c.key));
    return [
      { key: 'label', label: this.i18n.t(this.groupConfig()?.label ?? '') },
      { key: 'count', label: this.i18n.t('ws.col.records'), format: 'number', total: true },
      ...sums.map((c) => ({ key: c.key, label: this.i18n.t(c.label), format: c.format ?? 'number', total: true })),
    ];
  });
  protected readonly groupRows = computed<WsRow[]>(() => {
    const prefix = this.groupConfig()?.enumPrefix;
    return (this.result()?.groups ?? []).map((x) => ({
      id: x.key ?? '∅',
      key: x.key,
      label: prefix && x.label ? this.i18n.t(prefix + x.label) : x.label || '—',
      count: x.count,
      ...x.totals,
    }));
  });
  protected readonly groupTotals = computed(() => {
    const r = this.result();
    return r ? { ...r.totals, count: String(r.total) } : null;
  });

  protected readonly range = computed<WsDateRange>(() => {
    const f = this.state().filters.find((x) => x.field === this.list().dateField && x.op === 'between');
    if (!f?.value) return rangeFor('all');
    const [from, to] = f.value.split('..');
    return { preset: this.state().datePreset ?? 'custom', from, to };
  });

  protected readonly chips = computed<WsFilterChip[]>(() =>
    this.state().filters
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.field !== this.list().dateField)
      .map(({ f, i }) => {
        const col = this.list().columns.find((c) => c.key === f.field);
        const quick = this.list().quickFilters.find((q) => q.field === f.field);
        const prefix = quick?.prefix ?? col?.enumPrefix;
        return { id: String(i), label: this.i18n.t(col?.label ?? quick?.label ?? f.field), value: prefix && f.value ? this.i18n.t(prefix + f.value) : f.value ?? '—' };
      }),
  );

  constructor() {
    toObservable(this.query)
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.patch({ q, page: 1 }));

    const request = computed(() => ({ state: this.state(), n: this.reloads(), resource: this.list().resource, board: this.layout() === 'board' }));
    toObservable(request)
      .pipe(
        switchMap(({ state, resource, board }) => {
          this.loading.set(true);
          this.failed.set(false);
          // The board loads its own columns; the table needs one page (and its count for the header).
          return this.lists.page(resource, board ? { ...state, pageSize: 1, groupBy: null } : state).pipe(
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

    // A new list (another route) starts from its own default view.
    effect(() => {
      const resource = this.list().resource;
      untracked(() => {
        this.state.set({ ...DEFAULT_LIST_STATE });
        this.view.set(null);
        this.lists.views(resource).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (views) => {
            this.views.set(views);
            const dflt = views.find((v) => v.isDefault);
            if (dflt) this.applyView(dflt);
          },
          error: () => undefined,
        });
      });
    });

    effect(() => {
      this.state();
      untracked(() => this.menu.set(null));
    });
  }

  protected patch(p: Partial<ListState & Extra>): void {
    this.state.set({ ...this.state(), ...p });
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  protected setSort(s: WsSort | null): void {
    this.patch({ sort: s ? { field: s.key, dir: s.dir } : null, page: 1 });
  }

  protected setRange(r: WsDateRange): void {
    const field = this.list().dateField!;
    const rest = this.state().filters.filter((f) => f.field !== field);
    this.patch({ filters: r.from && r.to ? [...rest, { field, op: 'between', value: `${r.from}..${r.to}` }] : rest, page: 1, datePreset: r.preset });
  }

  protected addFilter(field: string, value: string): void {
    if (!value) return;
    const rest = this.state().filters.filter((f) => f.field !== field);
    this.patch({ filters: [...rest, { field, op: 'eq', value }], page: 1 });
  }

  protected removeFilter(chipId: string): void {
    const i = Number(chipId);
    this.patch({ filters: this.state().filters.filter((_, j) => j !== i), page: 1 });
  }

  protected clearFilters(): void {
    this.patch({ filters: this.state().filters.filter((f) => f.field === this.list().dateField), page: 1 });
  }

  protected toggleColumn(key: string): void {
    const now = this.visible();
    const order = this.list().columns.map((c) => c.key);
    const next = now.includes(key) ? now.filter((x) => x !== key) : order.filter((x) => now.includes(x) || x === key);
    if (next.length) this.patch({ columns: next });
  }

  protected openGroup(row: WsRow): void {
    const g = this.state().groupBy!;
    const filter: ListFilterState = row['key'] === null ? { field: g, op: 'isnull' } : { field: g, op: 'eq', value: String(row['key']) };
    this.patch({ groupBy: null, filters: [...this.state().filters.filter((f) => f.field !== g), filter], page: 1 });
  }

  protected open(row: WsRow): void {
    this.openId(row.id);
  }

  protected openId(id: string): void {
    void this.router.navigate(this.list().rowLink(id));
  }

  protected export(format: 'csv' | 'xlsx'): void {
    this.menu.set(null);
    this.exporting.set(true);
    this.lists.export(this.list().resource, this.state(), format, this.i18n.lang(), this.visible()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.exporting.set(false),
      error: () => { this.exporting.set(false); this.toast.show(this.i18n.t('common.couldNotLoad')); },
    });
  }

  // ---- saved views ----
  private viewState(): Partial<ListState & Extra> {
    const { page: _page, ...rest } = this.state();
    return rest;
  }

  protected applyView(v: SavedView | null): void {
    this.view.set(v);
    this.state.set({ ...DEFAULT_LIST_STATE, ...(v?.state ?? {}), page: 1 });
  }

  protected saveView(name: string): void {
    this.lists.saveView(this.list().resource, name, this.viewState()).subscribe({
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
