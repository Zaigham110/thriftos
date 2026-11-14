import { HttpClient, HttpParams } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

const GROUPS = ['customer', 'category', 'grade', 'city', 'month'] as const;
type Group = (typeof GROUPS)[number];
type Money = string | null;
interface Row { key: string; id: string | null; sales: number; revenue: string; sharePercent: number | null; kg: string; profit: Money; marginPercent: number | null; perKg: string | null }
/** GET /api/workspace/analytics/sales */
export interface SalesAnalytics {
  by: Group; from: string; to: string;
  totals: { sales: number; revenue: string; profit: Money; kg: string; perKg: string | null };
  rows: Row[];
  topCustomers: { id: string; name: string; revenue: string }[];
  priceTrend: { months: string[]; grades: { grade: string; points: { month: string; perKg: string | null }[] }[] };
}

/** Chart labels stay short so they do not run into each other. */
export const short = (s: string, n = 14): string => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/**
 * Sales analytics (enterprise plan E4.3): what sold, to whom and where — by customer, category, grade, city or
 * month, with share, kg, price per kg and margin; top customers; and the price per kg of each grade by month.
 */
@Component({
  selector: 'app-sales-analytics',
  standalone: true,
  imports: [FormsModule, TPipe, WsBarChartComponent, WsCommandBarComponent, WsDataGridComponent, WsDateRangeComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.salesAn.title' | t" [subtitle]="'ws.salesAn.subtitle' | t">
        <ws-report-actions actions [columns]="columns()" [rows]="rows()" [filename]="'thriftos-sales-by-' + by()" />
      </ws-page-header>
      <ws-command-bar>
        <label start class="select">{{ 'ws.yield.by' | t }}
          <select [ngModel]="by()" (ngModelChange)="by.set($event)">@for (g of groups; track g) { <option [value]="g">{{ 'ws.salesAn.group.' + g | t }}</option> }</select>
        </label>
        <ws-date-range end [value]="range()" (valueChange)="range.set($event)" />
      </ws-command-bar>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as d) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.dash.revenue' | t" [value]="i18n.money(d.totals.revenue)" [hint]="'ws.salesAn.salesCount' | t: { n: i18n.num(d.totals.sales) }" link="/sell/records" />
          @if (d.totals.profit !== null) { <ws-kpi-card [label]="'ws.pnl.gross' | t" [value]="i18n.money(round(d.totals.profit))" [hint]="margin()" /> }
          <ws-kpi-card [label]="'ws.salesAn.kgSold' | t" [value]="i18n.kg(d.totals.kg)" [hint]="perKg()" />
        </section>
        @if (d.rows.length) {
          <ws-bar-chart [heading]="'ws.salesAn.chart' | t: { by: ('ws.salesAn.group.' + d.by | t) }" [categories]="labels()" [series]="series()" format="money" />
        }
        <ws-data-grid [caption]="'ws.salesAn.title' | t" [columns]="columns()" [rows]="rows()" [serverTotals]="totals()" [clickable]="by() === 'customer'" (rowClick)="open($event)" [emptyHeading]="'ws.salesAn.empty' | t" />
        <div class="two">
          <section class="block"><h2>{{ 'ws.salesAn.top' | t }}</h2><ws-data-grid [caption]="'ws.salesAn.top' | t" [columns]="topColumns()" [rows]="topRows()" [clickable]="true" (rowClick)="open($event)" /></section>
          <section class="block"><h2>{{ 'ws.salesAn.priceTrend' | t }}</h2><ws-data-grid [caption]="'ws.salesAn.priceTrend' | t" [columns]="trendColumns()" [rows]="trendRows()" [emptyHeading]="'ws.salesAn.noTrend' | t" /></section>
        </div>
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .block { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-2); }
    .block h2 { margin:0; font-size:var(--ws-text-md, 15px); font-weight:600; }
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:var(--ws-4); align-items:start; }
    .select { display:inline-flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
  `],
})
export class SalesAnalyticsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly nav = inject(NavService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly groups = GROUPS;
  protected readonly by = signal<Group>('customer');
  protected readonly range = signal<WsDateRange>(rangeFor('90d'));
  protected readonly data = signal<SalesAnalytics | null>(null);
  protected readonly failed = signal(false);

  private monthName(ym: string): string {
    return new Date(ym + '-15T00:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short', year: 'numeric', numberingSystem: 'latn' });
  }
  private name(k: string): string {
    if (!k) return this.i18n.t('ws.stockValue.none');
    return this.data()?.by === 'month' ? this.monthName(k) : k;
  }
  protected readonly margin = computed(() => {
    const t = this.data()?.totals;
    return t && t.profit !== null && +t.revenue ? this.i18n.t('ws.pnl.margin', { n: this.i18n.num((+t.profit / +t.revenue) * 100, 1) }) : '';
  });
  protected readonly perKg = computed(() => {
    const t = this.data()?.totals;
    return t?.perKg ? this.i18n.t('ws.salesAn.avgPerKg', { amount: this.i18n.money(t.perKg) }) : '';
  });
  protected readonly labels = computed(() => (this.data()?.rows ?? []).slice(0, 12).map((r) => short(this.name(r.key))));
  protected readonly series = computed(() => {
    const rows = (this.data()?.rows ?? []).slice(0, 12);
    return [
      { label: this.i18n.t('ws.dash.revenue'), values: rows.map((r) => Number(r.revenue)) },
      ...(rows.some((r) => r.profit !== null) ? [{ label: this.i18n.t('ws.pnl.gross'), values: rows.map((r) => Number(r.profit ?? 0)) }] : []),
    ];
  });
  /** The Total row from the report's own totals: a bill with several categories is one bill, not one per row. */
  protected readonly totals = computed<Record<string, string> | null>(() => {
    const t = this.data()?.totals;
    return t ? ({ sales: String(t.sales), revenue: t.revenue, kg: t.kg, profit: t.profit } as unknown as Record<string, string>) : null;
  });
  protected round(v: string | number | null): number {
    return Math.round(Number(v ?? 0));
  }
  protected readonly columns = computed<WsColumn[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    const cost = this.data()?.totals.profit !== null;
    return [
      { key: 'name', label: t(`ws.salesAn.group.${this.by()}`) },
      { key: 'sales', label: t('ws.salesAn.bills'), format: 'number', total: true },
      { key: 'revenue', label: t('ws.dash.revenue'), format: 'money', total: true },
      { key: 'sharePercent', label: t('ws.sortRecord.share'), format: 'percent' },
      { key: 'kg', label: t('ws.salesAn.kgSold'), format: 'kg', total: true },
      { key: 'perKg', label: t('ws.salesAn.perKg'), format: 'money' },
      // Whole rupees as on every other screen; a loss is red.
      ...(cost ? [{ key: 'profit', label: t('ws.pnl.gross'), format: 'money' as const, total: true, round: true, tone: 'sign' as const }, { key: 'marginPercent', label: t('ws.salesAn.margin'), format: 'percent' as const, tone: 'sign' as const }] : []),
    ];
  });
  protected readonly rows = computed<WsRow[]>(() => (this.data()?.rows ?? []).map((r, i) => ({ ...r, id: r.id ?? `${i}:${r.key}`, name: this.name(r.key) })) as unknown as WsRow[]);
  protected readonly topColumns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('ws.col.customer') },
    { key: 'revenue', label: this.i18n.t('ws.dash.revenue'), format: 'money', total: true },
  ]);
  protected readonly topRows = computed<WsRow[]>(() => (this.data()?.topCustomers ?? []).map((c) => ({ ...c })) as unknown as WsRow[]);
  protected readonly trendColumns = computed<WsColumn[]>(() => [
    { key: 'grade', label: this.i18n.t('ws.container.grade') },
    ...(this.data()?.priceTrend.months ?? []).map((m) => ({ key: m, label: this.monthName(m), format: 'money' as const })),
  ]);
  protected readonly trendRows = computed<WsRow[]>(() =>
    (this.data()?.priceTrend.grades ?? []).map((g) => ({ id: g.grade, grade: g.grade, ...Object.fromEntries(g.points.map((p) => [p.month, p.perKg])) })),
  );

  constructor() {
    effect(() => {
      this.by();
      this.range();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const r = this.range();
    let params = new HttpParams().set('by', this.by());
    if (r.from) params = params.set('from', r.from);
    if (r.to) params = params.set('to', r.to);
    this.failed.set(false);
    this.http.get<SalesAnalytics>('/api/workspace/analytics/sales', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (d) => this.data.set(d), error: () => this.failed.set(true) });
  }

  protected open(row: WsRow): void {
    const id = String(row.id);
    if (!id.includes(':') && (this.by() === 'customer' || (this.data()?.topCustomers ?? []).some((c) => c.id === id))) void this.nav.open(['/khata/records', id]);
  }
}
