import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { WsBarChartComponent, WsColumn, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsRow, WsStateComponent } from '../../shared/ui/workspace';
import { EXPENSE_CATEGORIES } from './lists';

type Money = string;
interface Month { month: string; revenue: Money; cost: Money; grossProfit: Money; marginPercent: number | null; writeOffs: Money; cashDifference: Money; expenses: Record<string, Money>; expenseTotal: Money; netProfit: Money }
/** GET /api/workspace/finance/pnl */
export interface Pnl { months: Month[]; totals: Omit<Month, 'month' | 'marginPercent'> }

/**
 * Profit and loss by month (enterprise plan E3.6): sales, cost of what was sold, gross profit and margin, stock
 * written off, cash short or over, expenses by category, and what is left — net profit. Management accounts.
 */
@Component({
  selector: 'app-pnl',
  standalone: true,
  imports: [FormsModule, TPipe, WsBarChartComponent, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.pnl.title' | t" [subtitle]="'ws.pnl.subtitle' | t">
        <ws-report-actions actions [columns]="columns()" [rows]="rows()" filename="thriftos-profit-and-loss" />
        <label actions class="select">{{ 'ws.pnl.period' | t }}
          <select [ngModel]="months()" (ngModelChange)="months.set($event)">
            @for (n of periods; track n) { <option [ngValue]="n">{{ 'ws.pnl.lastMonths' | t: { n } }}</option> }
          </select>
        </label>
      </ws-page-header>
      @if (failed()) {
        <ws-state kind="error" [heading]="'ws.pnl.noAccess' | t" (retry)="load()" />
      } @else if (data(); as p) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.pnl.revenue' | t" [value]="i18n.money(p.totals.revenue)" />
          <ws-kpi-card [label]="'ws.pnl.gross' | t" [value]="i18n.money(p.totals.grossProfit)" [hint]="margin(p.totals.grossProfit, p.totals.revenue)" />
          <ws-kpi-card [label]="'ws.pnl.expenses' | t" [value]="i18n.money(p.totals.expenseTotal)" />
          <ws-kpi-card [label]="'ws.pnl.net' | t" [value]="i18n.money(p.totals.netProfit)" />
        </section>
        <ws-bar-chart [heading]="'ws.pnl.chart' | t" [categories]="labels()" [series]="series()" format="money" />
        <ws-data-grid [caption]="'ws.pnl.title' | t" [columns]="columns()" [rows]="rows()" />
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .select { display:inline-flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
  `],
})
export class PnlComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly periods = [3, 6, 12, 24];
  protected readonly months = signal(6);
  protected readonly data = signal<Pnl | null>(null);
  protected readonly failed = signal(false);

  private monthName(m: string): string {
    return new Date(m + '-15T00:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short', year: '2-digit', numberingSystem: 'latn' });
  }
  protected readonly labels = computed(() => (this.data()?.months ?? []).map((m) => this.monthName(m.month)));
  protected readonly series = computed(() => {
    const m = this.data()?.months ?? [];
    return [
      { label: this.i18n.t('ws.pnl.gross'), values: m.map((x) => Number(x.grossProfit)) },
      { label: this.i18n.t('ws.pnl.expenses'), values: m.map((x) => Number(x.expenseTotal)) },
      { label: this.i18n.t('ws.pnl.net'), values: m.map((x) => Number(x.netProfit)) },
    ];
  });

  /** One row per line of the statement, one column per month (latest last) and a total. */
  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'line', label: this.i18n.t('ws.pnl.line') },
    ...(this.data()?.months ?? []).map((m) => ({ key: m.month, label: this.monthName(m.month), format: 'money' as const })),
    { key: 'total', label: this.i18n.t('ws.grid.total'), format: 'money' as const },
  ]);
  protected readonly rows = computed<WsRow[]>(() => {
    const p = this.data();
    if (!p) return [];
    const row = (id: string, label: string, pick: (m: Month | Pnl['totals']) => string, negate = false): WsRow => {
      const v = (x: Month | Pnl['totals']) => (negate ? String(-Number(pick(x))) : pick(x));
      return { id, line: label, ...Object.fromEntries(p.months.map((m) => [m.month, v(m)])), total: v(p.totals) };
    };
    return [
      row('revenue', this.i18n.t('ws.pnl.revenue'), (m) => m.revenue),
      row('cost', this.i18n.t('ws.pnl.cost'), (m) => m.cost, true),
      row('gross', this.i18n.t('ws.pnl.gross'), (m) => m.grossProfit),
      row('writeOffs', this.i18n.t('ws.pnl.writeOffs'), (m) => m.writeOffs),
      row('cash', this.i18n.t('ws.pnl.cashDifference'), (m) => m.cashDifference),
      ...EXPENSE_CATEGORIES.map((c) => row(`exp-${c}`, this.i18n.t(`ws.expenseCategory.${c}`), (m) => m.expenses[c] ?? '0', true)),
      row('net', this.i18n.t('ws.pnl.net'), (m) => m.netProfit),
    ];
  });

  constructor() {
    effect(() => {
      this.months();
      untracked(() => this.load());
    });
  }

  protected margin(gross: string, revenue: string): string {
    return +revenue ? this.i18n.t('ws.pnl.margin', { n: this.i18n.num((Number(gross) / Number(revenue)) * 100, 1) }) : '';
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<Pnl>('/api/workspace/finance/pnl', { params: new HttpParams().set('months', String(this.months())) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => this.data.set(p),
      error: () => this.failed.set(true),
    });
  }
}
