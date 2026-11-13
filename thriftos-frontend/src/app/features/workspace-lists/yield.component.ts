import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TenantService } from '../../core/tenant/tenant.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsBarChartComponent,
  WsColumn,
  WsCommandBarComponent,
  WsDataGridComponent,
  WsDateRange,
  WsDateRangeComponent,
  WsKpiCardComponent,
  WsPageHeaderComponent,
  WsReportActionsComponent,
  WsRow,
  WsStateComponent,
  rangeFor,
} from '../../shared/ui/workspace';

const GROUPS = ['supplier', 'origin', 'rawCategory', 'container', 'month'] as const;
type Group = (typeof GROUPS)[number];

/** GET /api/workspace/sorting/yield */
export interface YieldReport {
  by: Group;
  totals: { lots: number; inputKg: string; outputKg: string; wasteKg: string; yieldPercent: number | null; topGradePercent: number | null };
  rows: { key: string; lots: number; inputKg: string; outputKg: string; wasteKg: string; yieldPercent: number | null; topGradePercent: number | null }[];
  categories: { name: string; kg: string; sharePercent: number | null }[];
  grades: { name: string; kg: string; pieces: number; sharePercent: number | null }[];
  waste: { stage: string; category: string; kg: string }[];
  trend: { month: string; inputKg: string; outputKg: string; yieldPercent: number | null }[];
}

/**
 * Yield analysis (enterprise plan E3.2): of the kg bought and sorted, how much came out as sellable stock and how
 * much A grade — by supplier, origin, raw type, container or month — and what it sorted into.
 */
@Component({
  selector: 'app-yield',
  standalone: true,
  imports: [FormsModule, TPipe, WsBarChartComponent, WsCommandBarComponent, WsDataGridComponent, WsDateRangeComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.yield.title' | t" [subtitle]="'ws.yield.subtitle' | t">
        <ws-report-actions actions [columns]="columns()" [rows]="rows()" [filename]="'thriftos-yield-by-' + by()" />
      </ws-page-header>
      <ws-command-bar>
        <label start class="select">{{ 'ws.yield.by' | t }}
          <select [ngModel]="by()" (ngModelChange)="by.set($event)">
            @for (g of groups(); track g) { <option [value]="g">{{ 'ws.yield.group.' + g | t }}</option> }
          </select>
        </label>
        <ws-date-range end [allowAll]="true" [value]="range()" (valueChange)="range.set($event)" />
      </ws-command-bar>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as d) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.yield.lots' | t" [value]="i18n.num(d.totals.lots)" />
          <ws-kpi-card [label]="'ws.sortRecord.input' | t" [value]="i18n.kg(d.totals.inputKg)" />
          <ws-kpi-card [label]="'ws.containers.col.yield' | t" [value]="pct(d.totals.yieldPercent)" [hint]="'ws.yield.wasteHint' | t: { kg: i18n.kg(d.totals.wasteKg) }" />
          <ws-kpi-card [label]="'ws.containers.col.topGrade' | t" [value]="pct(d.totals.topGradePercent)" />
        </section>
        @if (d.rows.length) {
          <ws-bar-chart [heading]="'ws.yield.chart' | t: { by: ('ws.yield.group.' + d.by | t) }" [categories]="labels()" [series]="series()" format="number" />
        }
        <ws-data-grid [caption]="'ws.yield.title' | t" [columns]="columns()" [rows]="rows()" [serverTotals]="totals()" [emptyHeading]="'ws.yield.empty' | t" />
        @if (d.trend.length > 1) {
          <ws-bar-chart [heading]="'ws.yield.trend' | t" [categories]="trendLabels()" [series]="trendSeries()" format="number" />
        }
        <!-- Every table says what it is (v2 review). -->
        <section class="block"><h2>{{ 'ws.yield.waste' | t }}</h2><ws-data-grid [caption]="'ws.yield.waste' | t" [columns]="wasteColumns()" [rows]="wasteRows()" [emptyHeading]="'ws.sortRecord.noWaste' | t" /></section>
        <div class="two">
          <section class="block"><h2>{{ 'ws.container.categories' | t }}</h2><ws-data-grid [caption]="'ws.container.categories' | t" [columns]="categoryColumns()" [rows]="categoryRows()" /></section>
          <section class="block"><h2>{{ 'ws.container.grades' | t }}</h2><ws-data-grid [caption]="'ws.container.grades' | t" [columns]="gradeColumns()" [rows]="gradeRows()" /></section>
        </div>
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .block { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-2); }
    .block h2 { margin:0; font-size:var(--ws-text-md, 15px); font-weight:600; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:var(--ws-4); align-items:start; }
    .select { display:inline-flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
  `],
})
export class YieldComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tenants = inject(TenantService);
  /** Grouping by container is offered only to a business that uses containers. */
  protected readonly groups = computed(() => GROUPS.filter((g) => g !== 'container' || this.tenants.isModuleEnabled('CONTAINERS', this.tenants.tenant())));
  protected readonly by = signal<Group>('supplier');
  protected readonly range = signal<WsDateRange>(rangeFor('all'));
  protected readonly data = signal<YieldReport | null>(null);
  protected readonly failed = signal(false);

  private name(key: string, isMonth = false): string {
    if (!key) return this.i18n.t('ws.stockValue.none');
    if (isMonth || this.data()?.by === 'month') return new Date(key + '-15T00:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short', year: 'numeric', numberingSystem: 'latn' });
    return key;
  }
  protected readonly labels = computed(() => (this.data()?.rows ?? []).map((r) => this.name(r.key)));
  protected readonly series = computed(() => {
    const rows = this.data()?.rows ?? [];
    return [
      { label: this.i18n.t('ws.containers.col.yield'), values: rows.map((r) => r.yieldPercent ?? 0) },
      { label: this.i18n.t('ws.containers.col.topGrade'), values: rows.map((r) => r.topGradePercent ?? 0) },
    ];
  });
  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t(`ws.yield.group.${this.data()?.by ?? 'supplier'}`) },
    { key: 'lots', label: this.i18n.t('ws.yield.lots'), format: 'number', total: true },
    { key: 'inputKg', label: this.i18n.t('ws.sortRecord.input'), format: 'kg', total: true },
    { key: 'outputKg', label: this.i18n.t('ws.lots.col.sorted'), format: 'kg', total: true },
    { key: 'wasteKg', label: this.i18n.t('ws.lots.col.waste'), format: 'kg', total: true },
    { key: 'yieldPercent', label: this.i18n.t('ws.containers.col.yield'), format: 'percent', total: true },
    { key: 'topGradePercent', label: this.i18n.t('ws.containers.col.topGrade'), format: 'percent', total: true },
  ]);
  /** The Total row carries the overall Sorted % and top grade % too (they are not sums of the rows). */
  protected readonly totals = computed<Record<string, string> | null>(() => {
    const t = this.data()?.totals;
    return t ? ({ lots: String(t.lots), inputKg: t.inputKg, outputKg: t.outputKg, wasteKg: t.wasteKg, yieldPercent: t.yieldPercent, topGradePercent: t.topGradePercent } as unknown as Record<string, string>) : null;
  });
  protected readonly rows = computed<WsRow[]>(() => (this.data()?.rows ?? []).map((r) => ({ id: r.key || '∅', name: this.name(r.key), ...r })));
  protected readonly trendLabels = computed(() => (this.data()?.trend ?? []).map((t) => this.name(t.month, true)));
  protected readonly trendSeries = computed(() => [{ label: this.i18n.t('ws.containers.col.yield'), values: (this.data()?.trend ?? []).map((t) => t.yieldPercent ?? 0) }]);
  protected readonly wasteColumns = computed<WsColumn[]>(() => [
    { key: 'stage', label: this.i18n.t('ws.sortRecord.stage') },
    { key: 'category', label: this.i18n.t('ws.container.category') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
  ]);
  protected readonly wasteRows = computed<WsRow[]>(() =>
    (this.data()?.waste ?? []).map((w, i) => ({ id: String(i), ...w, stage: this.i18n.t(w.stage === 'STAGE_1' ? 'ws.sortRecord.stage1' : 'ws.sortRecord.stage2') })),
  );
  protected readonly categoryColumns = computed(() => this.mixColumns('ws.container.category'));
  protected readonly gradeColumns = computed(() => this.mixColumns('ws.container.grade'));
  protected readonly categoryRows = computed<WsRow[]>(() => (this.data()?.categories ?? []).map((c) => ({ id: c.name, ...c })));
  protected readonly gradeRows = computed<WsRow[]>(() => (this.data()?.grades ?? []).map((g) => ({ id: g.name, ...g })));

  constructor() {
    effect(() => {
      this.by();
      this.range();
      untracked(() => this.load());
    });
  }

  protected mixColumns(label: string): WsColumn[] {
    return [
      { key: 'name', label: this.i18n.t(label) },
      { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
      { key: 'sharePercent', label: this.i18n.t('ws.sortRecord.share'), format: 'percent' },
    ];
  }

  protected pct(v: number | null): string {
    return v === null ? '—' : `${this.i18n.num(v, 0)}%`;
  }

  protected load(): void {
    const r = this.range();
    let params = new HttpParams().set('by', this.by());
    if (r.from) params = params.set('from', r.from);
    if (r.to) params = params.set('to', r.to);
    this.failed.set(false);
    this.http.get<YieldReport>('/api/workspace/sorting/yield', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.failed.set(true),
    });
  }
}
