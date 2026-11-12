import { moduleOn } from '../../core/tenant/module-on';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsAreaChartComponent,
  WsBarChartComponent,
  WsColumn,
  WsCommandBarComponent,
  WsDataGridComponent,
  WsDateRange,
  WsDateRangeComponent,
  WsInfoComponent,
  WsKpiCardComponent,
  WsPageHeaderComponent,
  WsRow,
  WsStateComponent,
  rangeFor,
} from '../../shared/ui/workspace';
import { FirstWeekComponent } from '../home/first-week.component';
import { CashTodayComponent } from '../home/cash-today.component';
import { withTones } from '../../shared/ui/workspace/status-tone';

type Money = string | null;
const AGES = ['0-30', '31-60', '61-90', '90+'] as const;
/** GET /api/workspace/dashboard */
export interface Dashboard {
  period: { from: string; to: string; days: number };
  sales: { count: number; revenue: string; previousRevenue: string; grossProfit: Money; previousGrossProfit: Money; marginPercent: number | null; previousMarginPercent: number | null; trend: { by: 'day' | 'month'; points: { key: string; revenue: string; profit: Money }[] } };
  cash: { collected: string; previousCollected: string; byMethod: { method: string; amount: string }[] };
  expenses: { total: string; netProfit: Money } | null;
  udhaar: { owed: string; customers: number; buckets: Record<string, string>; brokenPromises: number };
  stock: { items: number; kg: string; value: Money; ageing: { bucket: string; items: number; kg: string; value: Money }[] };
  containers: { count: number; kg: string; list: { id: string; number: string; supplier: string | null; status: string; kg: string; revenue: string; profit: Money; yield: number | null }[] };
  today: { sales: number; revenue: string; payments: number; collected: string };
}

const change = (now: string | number | null, before: string | number | null): number | null => {
  if (now === null || before === null) return null;
  const b = Number(before);
  return b === 0 ? null : Math.round(((Number(now) - b) / Math.abs(b)) * 1000) / 10;
};

/**
 * Owner dashboard on the laptop (enterprise plan E4.1): sales, gross profit and margin against the previous
 * period with their trend, cash collected, udhaar owed by age, stock value by age, containers in progress and
 * today. Every number opens the list or page behind it; every card has an "i" that says what it shows.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, TPipe, CashTodayComponent, FirstWeekComponent, WsAreaChartComponent, WsBarChartComponent, WsCommandBarComponent, WsDataGridComponent, WsDateRangeComponent, WsInfoComponent, WsKpiCardComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.dash.title' | t" [subtitle]="subtitle()" />
      <app-first-week class="first-week" />
      @if (on('CASH_CLOSE')) { <app-cash-today /> }
      <ws-command-bar>
        <p start class="today">
          @if (data(); as d) { {{ (d.today.sales === 1 ? 'ws.dash.todayOne' : 'ws.dash.today') | t: { sales: i18n.num(d.today.sales), revenue: i18n.money(d.today.revenue), collected: i18n.money(d.today.collected) } }} }
        </p>
        <ws-date-range end [value]="range()" (valueChange)="range.set($event)" />
      </ws-command-bar>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as d) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.dash.revenue' | t" [value]="rs(d.sales.revenue)" [delta]="delta(d.sales.revenue, d.sales.previousRevenue)" [trend]="revenueTrend()" link="/sell/records" [info]="'ws.dash.info.sales' | t" />
          @if (d.sales.grossProfit !== null) {
            <ws-kpi-card [label]="'ws.pnl.gross' | t" [value]="rs(d.sales.grossProfit)" [delta]="delta(d.sales.grossProfit, d.sales.previousGrossProfit)" [trend]="profitTrend()" [info]="'ws.dash.info.gross' | t" [hint]="d.sales.marginPercent !== null ? ('ws.pnl.margin' | t: { n: i18n.num(d.sales.marginPercent, 1) }) : ''" [link]="on('PNL') ? '/finance/pnl' : null" />
          }
          <ws-kpi-card [label]="'ws.dash.collected' | t" [value]="rs(d.cash.collected)" [delta]="delta(d.cash.collected, d.cash.previousCollected)" [hint]="methods()" [link]="on(['CASH_CLOSE', 'EXPENSES']) ? '/finance/book' : null" [info]="'ws.dash.info.collected' | t" />
          @if (on('KHATA')) {
          <ws-kpi-card [label]="'ws.collections.owed' | t" [value]="rs(d.udhaar.owed)" [higherIsBetter]="false" [hint]="owing(d.udhaar.customers, d.udhaar.brokenPromises)" link="/khata/records" [info]="'ws.dash.info.owed' | t" />
          }
          @if (d.stock.value !== null) {
            <ws-kpi-card [label]="'ws.stock.col.value' | t" [value]="rs(d.stock.value)" [hint]="'ws.dash.stockHint' | t: { kg: i18n.kg(d.stock.kg), n: i18n.num(d.stock.items) }" link="/stock/value" [info]="'ws.dash.info.stock' | t" />
          }
          @if (d.expenses?.netProfit; as net) {
            <ws-kpi-card [label]="'ws.pnl.net' | t" [value]="rs(net)" [hint]="'ws.dash.afterExpenses' | t: { amount: i18n.money(d.expenses!.total) }" [link]="on('PNL') ? '/finance/pnl' : null" [info]="'ws.dash.info.net' | t" />
          }
        </section>

        <!-- By day: bars, so a day's sales stand on that day alone (a line between days made one sales day look
             like sales on the days around it); by month: the trend line. -->
        @if (d.sales.trend.by === 'day') {
          <ws-bar-chart [heading]="'ws.dash.trendDay' | t" [categories]="trendLabels()" [series]="trendSeries()" format="money" [info]="'ws.dash.info.trend' | t" />
        } @else {
          <ws-area-chart [heading]="'ws.dash.trendMonth' | t" [categories]="trendLabels()" [series]="trendSeries()" format="money" [info]="'ws.dash.info.trend' | t" />
        }

        <div class="two">
          @if (on('KHATA')) {
          <section class="panel">
            <div class="ph"><h2><a routerLink="/khata/records">{{ 'ws.collections.ageing' | t }}</a></h2><ws-info [title]="'ws.collections.ageing' | t" [text]="'ws.dash.info.udhaarAge' | t" /></div>
            <ol class="bars">
              @for (k of ages; track k) {
                <li [class.hot]="k === '61-90' || k === '90+'"><span>{{ 'ws.stockValue.age.' + k | t }}</span><i [style.width.%]="share(d.udhaar.buckets[k], d.udhaar.owed)"></i><strong>{{ rs(d.udhaar.buckets[k]) }}</strong></li>
              }
            </ol>
          </section>
          }
          <section class="panel">
            <div class="ph"><h2><a routerLink="/stock/value">{{ 'ws.stockValue.ageing' | t }}</a></h2><ws-info [title]="'ws.stockValue.ageing' | t" [text]="'ws.dash.info.stockAge' | t" /></div>
            <ol class="bars">
              @for (a of d.stock.ageing; track a.bucket) {
                <li [class.hot]="a.bucket === '61-90' || a.bucket === '90+'"><span>{{ 'ws.stockValue.age.' + a.bucket | t }}</span><i [style.width.%]="share(a.value ?? a.kg, d.stock.value ?? d.stock.kg)"></i><strong>{{ a.value !== null ? rs(a.value) : i18n.kg(a.kg) }}</strong></li>
              }
            </ol>
          </section>
        </div>

        @if (on('CONTAINERS')) {
        <section class="grid-panel">
          <div class="ph"><h2>{{ 'ws.dash.containers' | t: { n: i18n.num(d.containers.count) } }}</h2><ws-info [title]="'ws.dash.containers' | t: { n: i18n.num(d.containers.count) }" [text]="'ws.dash.info.containers' | t" /></div>
          <ws-data-grid [caption]="'ws.dash.containers' | t: { n: i18n.num(d.containers.count) }" [columns]="containerColumns()" [rows]="containerRows()" [clickable]="true" (rowClick)="openContainer($event)" [emptyHeading]="'ws.dash.noContainers' | t" />
        </section>
        }
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .today { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:var(--ws-3); }
    /* Five or six cards: three to a row on a laptop, so the second row is not left half empty. */
    @media (min-width: 900px) { .kpis:has(> :nth-child(5)) { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:var(--ws-4); align-items:start; }
    .panel { display:grid; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    h2 { margin:0; font-size:var(--ws-text-md); font-weight:600; }
    h2 a { color:inherit; text-decoration:none; } h2 a:hover { color:var(--ws-brand); }
    .bars { list-style:none; margin:0; padding:0; display:grid; gap:var(--ws-2); }
    .bars li { display:grid; grid-template-columns:96px minmax(0, 1fr) auto; align-items:center; gap:var(--ws-2); font-size:var(--ws-text-sm); }
    .bars span { color:var(--ws-ink-2); }
    .bars i { display:block; height:8px; min-width:2px; border-radius:4px; background:var(--ws-chart-1, #2a78d4); }
    .bars li.hot i { background:var(--ws-bad); }
    .bars strong { font-variant-numeric:tabular-nums; }
    .ph { display:flex; align-items:center; justify-content:space-between; gap:var(--ws-3); }
    .grid-panel { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-3); min-width:0; }
    .grid-panel .ph { padding-inline:var(--ws-1); }
  `],
})
export class DashboardComponent {
  protected readonly on = moduleOn();
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly nav = inject(NavService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly ages = AGES;
  protected readonly range = signal<WsDateRange>(rangeFor('month'));
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly failed = signal(false);

  private fmtDay(ymd: string, opts: Intl.DateTimeFormatOptions): string {
    return new Date(ymd + 'T12:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { ...opts, numberingSystem: 'latn' });
  }
  protected readonly subtitle = computed(() => {
    const p = this.data()?.period;
    return p ? this.i18n.t('ws.dash.period', { from: this.fmtDay(p.from, { day: 'numeric', month: 'short' }), to: this.fmtDay(p.to, { day: 'numeric', month: 'short', year: 'numeric' }) }) : '';
  });
  protected readonly revenueTrend = computed(() => (this.data()?.sales.trend.points ?? []).map((p) => Number(p.revenue)));
  protected readonly profitTrend = computed(() => (this.data()?.sales.trend.points ?? []).map((p) => Number(p.profit ?? 0)));
  protected readonly trendLabels = computed(() => {
    const t = this.data()?.sales.trend;
    return (t?.points ?? []).map((p) => (t!.by === 'day' ? this.fmtDay(p.key, { day: 'numeric', month: 'short' }) : this.fmtDay(p.key + '-15', { month: 'short', year: '2-digit' })));
  });
  protected readonly trendSeries = computed(() => {
    const pts = this.data()?.sales.trend.points ?? [];
    return [
      { label: this.i18n.t('ws.dash.revenue'), values: pts.map((p) => Number(p.revenue)) },
      ...(pts.some((p) => p.profit !== null) ? [{ label: this.i18n.t('ws.pnl.gross'), values: pts.map((p) => Number(p.profit ?? 0)) }] : []),
    ];
  });
  protected readonly methods = computed(() => (this.data()?.cash.byMethod ?? []).map((m) => `${this.i18n.t('method.' + m.method)} ${this.i18n.money(m.amount)}`).join(' · '));
  protected readonly containerColumns = computed<WsColumn[]>(() => [
    { key: 'number', label: this.i18n.t('ws.containers.col.number') },
    { key: 'supplier', label: this.i18n.t('ws.containers.col.supplier') },
    { key: 'status', label: this.i18n.t('ws.col.status') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg' },
    { key: 'revenue', label: this.i18n.t('ws.containers.col.revenue'), format: 'money' },
    ...(this.data()?.containers.list.some((c) => c.profit !== null) ? [{ key: 'profit', label: this.i18n.t('ws.containers.col.profit'), format: 'money' as const }] : []),
    { key: 'yield', label: this.i18n.t('ws.containers.col.yield'), format: 'percent' },
  ]);
  protected readonly containerRows = computed<WsRow[]>(() => (this.data()?.containers.list ?? []).map((c) => withTones({ ...c, status: this.i18n.t(`ws.cstatus.${c.status}`) }, { status: c.status })) as unknown as WsRow[]);

  constructor() {
    effect(() => {
      this.range();
      untracked(() => this.load());
    });
  }

  /** Headline tiles show whole rupees (the lists keep paisa). */
  /** "1 customer owes · 1 broken promise": singular for one. */
  protected owing(customers: number, broken: number): string {
    const c = this.i18n.t(customers === 1 ? 'ws.dash.owingOne' : 'ws.dash.owingN', { n: this.i18n.num(customers) });
    const b = this.i18n.t(broken === 1 ? 'ws.dash.brokenOne' : 'ws.dash.brokenN', { n: this.i18n.num(broken) });
    return `${c} · ${b}`;
  }

  protected rs(v: string | null): string {
    return this.i18n.money(Math.round(Number(v ?? 0)));
  }

  protected delta(now: string | null, before: string | null): number | null {
    return change(now, before);
  }
  protected share(part: string | null, whole: string | null): number {
    const w = Number(whole ?? 0);
    return w > 0 ? Math.max(0, Math.min(100, (Number(part ?? 0) / w) * 100)) : 0;
  }
  protected load(): void {
    const r = this.range();
    let params = new HttpParams();
    if (r.from) params = params.set('from', r.from);
    if (r.to) params = params.set('to', r.to);
    this.failed.set(false);
    this.http.get<Dashboard>('/api/workspace/dashboard', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (d) => this.data.set(d), error: () => this.failed.set(true) });
  }

  protected openContainer(row: WsRow): void {
    void this.nav.open(['/receive/records/containers', row.id]);
  }
}
