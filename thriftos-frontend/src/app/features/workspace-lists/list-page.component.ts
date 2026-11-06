import { HelpLinkComponent } from '../help/help-link.component';
import { Component, DestroyRef, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChevronDown, Download, LayoutGrid, LucideAngularModule, Plus, Rows3, SlidersHorizontal } from 'lucide-angular';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { I18nService, serverLang } from '../../core/i18n/i18n.service';
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
    HelpLinkComponent,
    FormsModule,
    RouterLink,
    RouterLinkActive,
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
      @if (c.tabs?.length) {
        <nav class="tabs" [attr.aria-label]="c.title | t">
          @for (tab of c.tabs; track tab.link) {
            <a [routerLink]="tab.link" routerLinkActive="on" ariaCurrentWhenActive="page" (click)="rememberTab(tab.link)">{{ tab.label | t }}</a>
          }
        </nav>
      }
      <ws-page-header [heading]="c.title | t" [subtitle]="result() ? (countKey() | t: { n: i18n.num(result()!.total) }) : ''">
        @if (c.create; as create) { <a actions class="ws-btn primary" [routerLink]="create.link"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ create.label | t }}</a> }
      </ws-page-header>

      <!-- One bar: search and the everyday filters in view; layout, grouping, columns and saved views behind "View". -->
      <ws-command-bar>
        <ws-filter-bar start [query]="state().q" (queryChange)="query.set($event)" [placeholder]="c.searchPlaceholder | t" [chips]="chips()" (remove)="removeFilter($event)" (clearAll)="clearFilters()">
          @for (qf of c.quickFilters; track qf.field) {
            <select add class="quick" [ngModel]="''" (ngModelChange)="addFilter(qf.field, $event)" [attr.aria-label]="qf.label | t">
              <option value="">{{ qf.label | t }}…</option>
              @for (v of qf.values; track v) { <option [value]="v">{{ qf.prefix + v | t }}</option> }
            </select>
          }
        </ws-filter-bar>
        <div end class="row">
          @if (c.dateField) { <ws-date-range [allowAll]="true" [value]="range()" (valueChange)="setRange($event)" /> }
          <div class="menu-wrap" (keydown.escape)="menu.set(null)">
            <button type="button" class="ws-btn" [class.on]="viewChanged()" (click)="menu.set(menu() === 'view' ? null : 'view')" [attr.aria-expanded]="menu() === 'view'">
              <lucide-icon [img]="icons.SlidersHorizontal" [size]="16" aria-hidden="true" />{{ 'ws.viewMenu' | t }}<lucide-icon [img]="icons.ChevronDown" [size]="14" aria-hidden="true" />
            </button>
            @if (menu() === 'view') {
              <div class="menu panel" role="group" [attr.aria-label]="'ws.viewMenu' | t">
                @if (c.board) {
                  <div class="sec">
                    <span class="sec-h">{{ 'ws.layout.label' | t }}</span>
                    <div class="switch" role="group" [attr.aria-label]="'ws.layout.label' | t">
                      <button type="button" class="ws-btn" [class.on]="layout() === 'table'" [attr.aria-pressed]="layout() === 'table'" (click)="patch({ layout: 'table' })"><lucide-icon [img]="icons.Rows3" [size]="16" aria-hidden="true" />{{ 'ws.layout.table' | t }}</button>
                      <button type="button" class="ws-btn" [class.on]="layout() === 'board'" [attr.aria-pressed]="layout() === 'board'" (click)="patch({ layout: 'board', groupBy: null })"><lucide-icon [img]="icons.LayoutGrid" [size]="16" aria-hidden="true" />{{ 'ws.layout.board' | t }}</button>
                    </div>
                  </div>
                }
                @if (layout() === 'table' && c.groupBy.length) {
                  <label class="sec">{{ 'ws.groupBy' | t }}
                    <select [ngModel]="state().groupBy ?? ''" (ngModelChange)="patch({ groupBy: $event || null, page: 1 })">
                      <option value="">{{ 'ws.group.none' | t }}</option>
                      @for (g of c.groupBy; track g.key) { <option [value]="g.key">{{ g.label | t }}</option> }
                    </select>
                  </label>
                }
                @if (layout() === 'table') {
                  <div class="sec" role="group" [attr.aria-label]="'ws.columns' | t">
                    <span class="sec-h">{{ 'ws.columns' | t }}</span>
                    @for (col of availableColumns(); track col.key) {
                      <label class="check"><input type="checkbox" [checked]="visible().includes(col.key)" (change)="toggleColumn(col.key)" />{{ col.label | t }}</label>
                    }
                  </div>
                }
                <div class="sec">
                  <span class="sec-h">{{ 'ws.views.title' | t }}</span>
                  <ws-view-menu [inline]="true" [views]="views()" [current]="view()" (choose)="applyView($event); menu.set(null)" (save)="saveView($event)" (makeDefault)="makeDefault($event)" (remove)="removeView($event)" />
                </div>
              </div>
            }
          </div>
          <div class="menu-wrap">
            <button type="button" class="ws-btn" (click)="menu.set(menu() === 'export' ? null : 'export')" [attr.aria-expanded]="menu() === 'export'" [disabled]="exporting()">
              <lucide-icon [img]="icons.Download" [size]="16" aria-hidden="true" />{{ (exporting() ? 'common.loading' : 'ws.export.label') | t }}
            </button>
            @if (menu() === 'export') {
              <div class="menu end" role="menu">
                <button type="button" role="menuitem" (click)="export('xlsx')">{{ 'ws.export.xlsx' | t }}</button>
                <button type="button" role="menuitem" (click)="export('csv')">{{ 'ws.export.csv' | t }}</button>
              </div>
            }
          </div>
        </div>
      </ws-command-bar>

      @if (failed()) {
        <ws-state kind="error" (retry)="reload()" />
      } @else if (layout() === 'board' && c.board) {
        <app-board [config]="c" [state]="state()" (open)="openId($event)" (moved)="reload()" />
      } @else if (state().groupBy) {
        <ws-data-grid [caption]="c.title | t" [columns]="groupColumns()" [rows]="groupRows()" [loading]="loading()" [clickable]="true" [serverTotals]="groupTotals()" (rowClick)="openGroup($event)" />
      } @else {
        <ws-data-grid [caption]="c.title | t" [columns]="columns()" [rows]="rows()" [loading]="loading()" [clickable]="true" [serverSort]="true"
          [sort]="gridSort()" (sortChange)="setSort($event)" [serverTotals]="totals()" (rowClick)="open($event)"
          [emptyHeading]="c.emptyHeading | t" [emptyMessage]="c.emptyMessage | t">
          @if (c.help) { <app-help-link empty [topic]="c.help" /> }
        </ws-data-grid>
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
    select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .menu-wrap { position:relative; }
    .ws-btn.on { border-color:var(--ws-brand); color:var(--ws-brand); }
    ws-filter-bar { flex:1 1 420px; min-width:0; }
    .tabs { display:flex; gap:var(--ws-1); padding:3px; width:max-content; max-width:100%; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface-2); }
    .tabs a { padding:6px var(--ws-4); border-radius:var(--ws-r-md); color:var(--ws-ink-2); font-size:var(--ws-text-sm); font-weight:500; text-decoration:none; }
    .tabs a:hover { color:var(--ws-ink); }
    .tabs a.on { background:var(--ws-surface); color:var(--ws-brand); box-shadow:var(--ws-shadow-1); font-weight:600; }
    .menu.panel { inset-inline-start:auto; inset-inline-end:0; width:min(300px, 86vw); max-height:min(70vh, 560px); overflow:auto; gap:var(--ws-3); padding:var(--ws-3); }
    .menu.end { inset-inline-start:auto; inset-inline-end:0; }
    .sec { display:grid; gap:var(--ws-1); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .sec + .sec { padding-block-start:var(--ws-3); border-block-start:1px solid var(--ws-line); }
    .sec-h { color:var(--ws-ink-3); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
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
  protected readonly icons = { ChevronDown, Download, LayoutGrid, Plus, Rows3, SlidersHorizontal };

  protected readonly state = signal<ListState & Extra>({ ...DEFAULT_LIST_STATE });
  protected readonly query = signal('');
  /** "1 lot", not "1 lots": a list can give a countOne next to its count. */
  protected readonly countKey = computed(() => {
    const key = this.list().count;
    const one = key.replace(/\.count$/, '.countOne');
    return this.result()?.total === 1 && one !== key && this.i18n.t(one) !== one ? one : key;
  });
  protected readonly result = signal<ListResult | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly menu = signal<'view' | 'export' | null>(null);
  protected readonly views = signal<SavedView[]>([]);
  protected readonly view = signal<SavedView | null>(null);
  private readonly reloads = signal(0);

  protected readonly layout = computed(() => (this.list().board ? this.state().layout ?? 'table' : 'table'));
  /** "View" is highlighted when the list is not in its plain shape (board, grouped, own columns or a saved view). */
  protected readonly viewChanged = computed(() => this.layout() === 'board' || !!this.state().groupBy || !!this.state().columns.length || !!this.view());

  @HostListener('document:click', ['$event'])
  protected outside(e: Event): void {
    if (this.menu() && !(e.target as Element | null)?.closest?.('.menu-wrap')) this.menu.set(null);
  }

  /** Purchasing opens on the tab used last (containers, or gaari / lots). */
  protected rememberTab(link: string): void {
    try { localStorage.setItem(`thriftos.tab.${this.list().tabs![0].link}`, link); } catch { /* private window */ }
  }

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
      return { key, label: this.i18n.t(c.label), sortable: !c.computed, format: c.format ?? 'text', total: c.total, width: c.width, round: c.format === 'money' && !c.exact, info: c.info ? this.i18n.t(c.info) : undefined };
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
      ...sums.map((c) => ({ key: c.key, label: this.i18n.t(c.label), format: c.format ?? 'number', total: true, round: c.format === 'money' && !c.exact })),
    ];
  });
  protected readonly groupRows = computed<WsRow[]>(() => {
    const prefix = this.groupConfig()?.enumPrefix;
    return (this.result()?.groups ?? []).map((x) => ({
      id: x.key ?? '∅',
      key: x.key,
      label: this.groupConfig()?.month && x.key ? this.monthName(x.key) : prefix && x.label ? this.i18n.t(prefix + x.label) : x.label || '—',
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
        const value = f.op === 'isnull' ? this.i18n.t('ws.filter.none') : f.op === 'notnull' ? this.i18n.t('ws.filter.any') : prefix && f.value ? this.i18n.t(prefix + f.value) : f.value ?? '—';
        return { id: String(i), label: this.i18n.t(col?.label ?? quick?.label ?? f.field), value: f.op === 'ne' ? this.i18n.t('ws.filter.not', { value }) : value };
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
        this.state.set(this.fresh());
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

    // A new page of results closes the export menu; "View" stays open while columns are ticked.
    effect(() => {
      this.state();
      untracked(() => this.menu() === 'export' && this.menu.set(null));
    });
  }

  private fresh(): ListState & Extra {
    return { ...DEFAULT_LIST_STATE, filters: [...(this.list().defaultFilters ?? [])] };
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

  private monthName(ym: string): string {
    return new Date(ym + '-15T00:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  }

  protected openGroup(row: WsRow): void {
    const g = this.state().groupBy!;
    if (this.groupConfig()?.month && row['key']) {
      // A month opens as that month's date range.
      const ym = String(row['key']);
      const [y, m] = ym.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const rest = this.state().filters.filter((f) => f.field !== g);
      this.patch({ groupBy: null, filters: [...rest, { field: g, op: 'between', value: `${ym}-01..${ym}-${String(last).padStart(2, '0')}` }], page: 1, datePreset: 'custom' });
      return;
    }
    const filter: ListFilterState = row['key'] === null ? { field: g, op: 'isnull' } : { field: g, op: 'eq', value: String(row['key']) };
    this.patch({ groupBy: null, filters: [...this.state().filters.filter((f) => f.field !== g), filter], page: 1 });
  }

  protected open(row: WsRow): void {
    void this.router.navigate(this.list().rowLink(row.id, row as Record<string, unknown>));
  }

  protected openId(id: string): void {
    void this.router.navigate(this.list().rowLink(id));
  }

  protected export(format: 'csv' | 'xlsx'): void {
    this.menu.set(null);
    this.exporting.set(true);
    this.lists.export(this.list().resource, this.state(), format, serverLang(this.i18n.lang()), this.visible()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.state.set({ ...this.fresh(), ...(v?.state ?? {}), page: 1 });
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
