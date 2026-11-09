import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { WsBarChartComponent, WsColumn, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsRow, WsStateComponent } from '../../shared/ui/workspace';
import { EXPENSE_CATEGORIES } from './lists';

type Money = string;
interface Totals { revenue: Money; cost: Money; grossProfit: Money; marginPercent: number | null; writeOffs: Money; cashDifference: Money; expenses: Record<string, Money>; expenseTotal: Money; netProfit: Money }
interface Month extends Totals { month: string; cashDays: string[] }
/** GET /api/workspace/finance/pnl */
export interface Pnl {
  months: Month[];
  totals: Totals;
  /** The same number of months just before (null when nothing happened then). */
  previous: Totals | null;
  /** The latest month is not over yet. */
  current: { month: string; days: number; of: number } | null;
}

/** One line of the statement: what it shows per month, and whether it is a deduction (shown with a minus). */
interface Line { id: string; label: string; pick: (m: Totals) => string; negate?: boolean; strong?: boolean; sub?: boolean }

const change = (now: string, before: string | undefined): number | null => {
  if (before === undefined) return null;
  const b = Number(before);
  return b === 0 ? null : Math.round(((Number(now) - b) / Math.abs(b)) * 1000) / 10;
};
const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/**
 * Profit and loss by month (enterprise plan E3.6, v2 review): sales, cost of what was sold, gross profit,
 * expenses (with the categories under them), stock written off, cash short or over, and net profit. Whole
 * rupees on screen (the CSV keeps paisa), compared with the months before, the month not yet over said plainly,
 * every amount opens what is behind it, and on a phone one month at a time.
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
        <ws-state kind="error" [heading]="'ws.pnl.loadFailed' | t" (retry)="load()" />
      } @else if (data(); as p) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.pnl.revenue' | t" [value]="rs(p.totals.revenue)" [delta]="delta(p.totals.revenue, p.previous?.revenue)" />
          <ws-kpi-card [label]="'ws.pnl.gross' | t" [value]="rs(p.totals.grossProfit)" [delta]="delta(p.totals.grossProfit, p.previous?.grossProfit)" [hint]="share(p.totals.grossProfit, p.totals.revenue, 'ws.pnl.margin')" />
          <ws-kpi-card [label]="'ws.pnl.expenses' | t" [value]="rs(p.totals.expenseTotal)" [delta]="delta(p.totals.expenseTotal, p.previous?.expenseTotal)" [higherIsBetter]="false" />
          <ws-kpi-card [label]="'ws.pnl.net' | t" [value]="rs(p.totals.netProfit)" [delta]="delta(p.totals.netProfit, p.previous?.netProfit)" [hint]="share(p.totals.netProfit, p.totals.revenue, 'ws.pnl.netMargin')" />
        </section>
        @if (p.previous || p.current) {
          <p class="note">
            @if (p.previous) { <span>{{ 'ws.pnl.compared' | t: { n: p.months.length } }}</span> }
            @if (p.current; as c) { <span>{{ 'ws.pnl.notOver' | t: { month: monthName(c.month), days: c.days, of: c.of } }}</span> }
          </p>
        }
        <ws-bar-chart [heading]="'ws.pnl.chart' | t" [categories]="labels()" [series]="series()" format="money" />
        <div class="desk">
          <ws-data-grid [caption]="'ws.pnl.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" (cellClick)="open($event.row['id'] + '', $event.key)" />
          <p class="tip">{{ 'ws.pnl.tapTip' | t }}</p>
        </div>
        <section class="phone" [attr.aria-label]="'ws.pnl.title' | t">
          <div class="chips" role="radiogroup" [attr.aria-label]="'ws.pnl.month' | t">
            @for (m of p.months; track m.month) {
              <label class="chip" [class.on]="m.month === picked()"><input type="radio" name="pnl-month" [value]="m.month" [ngModel]="picked()" (ngModelChange)="pick.set($event)" />{{ monthLabel(m.month) }}</label>
            }
          </div>
          @if (pickedMonth(); as m) {
            <ul class="lines">
              @for (l of lines(); track l.id) {
                <li [class.strong]="l.strong" [class.sub]="l.sub">
                  <button type="button" (click)="open(l.id, m.month)" [disabled]="l.id === 'net'">
                    <span class="name">{{ l.label }}</span>
                    <span class="amt ws-num" [class.neg]="l.id === 'net' && +l.pick(m) < 0">{{ rs(value(l, m)) }}</span>
                    @if (before(); as b) { <small class="was">{{ 'ws.pnl.was' | t: { month: monthName(b.month), amount: rs(value(l, b)) } }}</small> }
                  </button>
                </li>
              }
            </ul>
          }
        </section>
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
    .note { display:flex; flex-wrap:wrap; gap:var(--ws-1) var(--ws-4); margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .tip { margin:var(--ws-2) 0 0; color:var(--ws-ink-3, var(--ws-ink-2)); font-size:var(--ws-text-sm); }
    .phone { display:none; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip { position:relative; flex:none; display:inline-flex; align-items:center; min-height:36px; padding:0 12px; border:1px solid var(--ws-line); border-radius:999px; background:var(--ws-surface); color:var(--ws-ink); font-size:var(--ws-text-sm); cursor:pointer; user-select:none; }
    .chip input { position:absolute; opacity:0; width:1px; height:1px; pointer-events:none; }
    .chip.on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); font-weight:600; }
    .chip:has(input:focus-visible) { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:1px; }
    .lines { list-style:none; margin:var(--ws-3) 0 0; padding:0; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg, 12px); background:var(--ws-surface); overflow:hidden; }
    .lines li + li { border-top:1px solid var(--ws-line); }
    .lines button { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:2px var(--ws-3); width:100%; padding:var(--ws-3); border:0; background:none; color:inherit; font:inherit; text-align:start; cursor:pointer; }
    .lines button:disabled { cursor:default; color:inherit; }
    .lines .amt { text-align:end; }
    .lines .was { grid-column:1 / -1; color:var(--ws-ink-2); font-size:var(--ws-text-xs, 12px); text-align:end; }
    .lines li.strong { font-weight:700; background:var(--ws-surface-2, transparent); }
    .lines li.sub .name { padding-inline-start:var(--ws-4); color:var(--ws-ink-2); }
    .neg { color:var(--ws-bad); }
    @media (max-width: 640px) {
      .kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:var(--ws-2); }
      .desk { display:none; }
      .phone { display:block; }
    }
  `],
})
export class PnlComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly periods = [3, 6, 12, 24];
  protected readonly months = signal(6);
  protected readonly data = signal<Pnl | null>(null);
  protected readonly failed = signal(false);
  /** The month shown on a phone (the latest unless one is picked). */
  protected readonly pick = signal<string | null>(null);

  protected monthName(m: string): string {
    return new Date(m + '-15T00:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short', year: '2-digit', numberingSystem: 'latn' });
  }
  /** "Nov 26 (so far)" for the month not yet over. */
  protected monthLabel(m: string): string {
    return this.data()?.current?.month === m ? this.i18n.t('ws.pnl.soFar', { month: this.monthName(m) }) : this.monthName(m);
  }
  protected rs(v: string | number): string {
    return this.i18n.money(Math.round(Number(v)));
  }

  protected readonly labels = computed(() => (this.data()?.months ?? []).map((m) => this.monthLabel(m.month)));
  protected readonly series = computed(() => {
    const m = this.data()?.months ?? [];
    const r = (v: string) => Math.round(Number(v));
    return [
      { label: this.i18n.t('ws.pnl.gross'), values: m.map((x) => r(x.grossProfit)) },
      { label: this.i18n.t('ws.pnl.expenses'), values: m.map((x) => r(x.expenseTotal)) },
      { label: this.i18n.t('ws.pnl.net'), values: m.map((x) => r(x.netProfit)) },
    ];
  });

  /** The statement's lines; categories, write-offs and cash short/over only when the period has any. */
  protected readonly lines = computed<Line[]>(() => {
    const p = this.data();
    if (!p) return [];
    const any = (pick: (m: Totals) => string) => p.months.some((m) => Number(pick(m)) !== 0);
    const t = (k: string) => this.i18n.t(k);
    return [
      { id: 'revenue', label: t('ws.pnl.revenue'), pick: (m) => m.revenue },
      { id: 'cost', label: t('ws.pnl.cost'), pick: (m) => m.cost, negate: true },
      { id: 'gross', label: t('ws.pnl.gross'), pick: (m) => m.grossProfit, strong: true },
      { id: 'expenses', label: t('ws.pnl.expenses'), pick: (m) => m.expenseTotal, negate: true, strong: true },
      ...EXPENSE_CATEGORIES.filter((c) => any((m) => m.expenses[c] ?? '0')).map((c): Line => ({ id: `exp-${c}`, label: t(`ws.expenseCategory.${c}`), pick: (m) => m.expenses[c] ?? '0', negate: true, sub: true })),
      ...(any((m) => m.writeOffs) ? [{ id: 'writeOffs', label: t('ws.pnl.writeOffs'), pick: (m: Totals) => m.writeOffs }] : []),
      ...(any((m) => m.cashDifference) ? [{ id: 'cash', label: t('ws.pnl.cashDifference'), pick: (m: Totals) => m.cashDifference }] : []),
      { id: 'net', label: t('ws.pnl.net'), pick: (m) => m.netProfit, strong: true },
    ];
  });
  protected value(l: Line, m: Totals): string {
    const v = l.pick(m);
    return l.negate ? String(-Number(v)) : v;
  }

  /** One row per line, one column per month (latest last) and a total. Whole rupees on screen, paisa in the CSV. */
  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'line', label: this.i18n.t('ws.pnl.line') },
    ...(this.data()?.months ?? []).map((m) => ({ key: m.month, label: this.monthLabel(m.month), format: 'money' as const, round: true })),
    { key: 'total', label: this.i18n.t('ws.grid.total'), format: 'money' as const, round: true },
  ]);
  protected readonly rows = computed<WsRow[]>(() => {
    const p = this.data();
    if (!p) return [];
    return this.lines().map((l) => ({
      id: l.id, line: l.label, _strong: !!l.strong, _sub: !!l.sub,
      ...Object.fromEntries(p.months.map((m) => [m.month, this.value(l, m)])),
      total: this.value(l, p.totals),
    }));
  });

  protected readonly picked = computed(() => {
    const months = this.data()?.months ?? [];
    const want = this.pick();
    return months.some((m) => m.month === want) ? want : (months.at(-1)?.month ?? null);
  });
  protected readonly pickedMonth = computed(() => this.data()?.months.find((m) => m.month === this.picked()) ?? null);
  /** The month before the one shown on a phone, to compare with. */
  protected readonly before = computed(() => {
    const months = this.data()?.months ?? [];
    const i = months.findIndex((m) => m.month === this.picked());
    return i > 0 ? months[i - 1] : null;
  });

  constructor() {
    effect(() => {
      this.months();
      untracked(() => this.load());
    });
  }

  protected delta(now: string, before: string | undefined): number | null {
    return change(now, before);
  }
  /** "55% margin" / "18% of sales". */
  protected share(part: string, revenue: string, key: string): string {
    return +revenue ? this.i18n.t(key, { n: this.i18n.num((Number(part) / Number(revenue)) * 100, 1) }) : '';
  }

  /**
   * What is behind an amount: sales of the month, its expenses (of one category), the day closed short or over,
   * the stock counts. `key` is a month (YYYY-MM) or anything else for the whole period.
   */
  protected open(line: string, key: string): void {
    const p = this.data();
    if (!p || line === 'net' || !p.months.length) return;
    const month = p.months.find((m) => m.month === key);
    const from = `${(month ?? p.months[0]).month}-01`;
    const to = lastDay((month ?? p.months[p.months.length - 1]).month);
    const between = { field: 'date', op: 'between', value: `${from}..${to}` };
    const list = (path: string, filters: object[]) => void this.router.navigate([path], { queryParams: { v: JSON.stringify({ filters, datePreset: 'custom' }) } });
    if (line === 'revenue' || line === 'cost' || line === 'gross') return list('/sell/records', [between]);
    if (line === 'expenses') return list('/finance/expenses', [{ field: 'cancelled', op: 'isnull' }, between]);
    if (line.startsWith('exp-')) return list('/finance/expenses', [{ field: 'cancelled', op: 'isnull' }, { field: 'category', op: 'eq', value: line.slice(4) }, between]);
    if (line === 'writeOffs') return void this.router.navigate(['/stock/items/counts']);
    if (line === 'cash') {
      const days = (month ? [month] : p.months).flatMap((m) => m.cashDays);
      return void this.router.navigate(['/finance/close'], { queryParams: days.length ? { day: days[days.length - 1] } : {} });
    }
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<Pnl>('/api/workspace/finance/pnl', { params: new HttpParams().set('months', String(this.months())) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => this.data.set(p),
      error: () => this.failed.set(true),
    });
  }
}
