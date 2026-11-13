import { RouterLink } from '@angular/router';
import { NavService } from '../../core/nav/nav.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { short } from './sales-analytics.component';
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

type Money = string | null;
interface Row { rank: number; key: string; id: string | null; containers: number; lots: number; kg: string; landed: Money; costPerKg: Money; revenue: string; profit: Money; profitPerKg: Money; yieldPercent: number | null; topGradePercent: number | null }
/** GET /api/workspace/analytics/suppliers */
export interface Scorecard { by: 'supplier' | 'origin'; totals: { containers: number; lots: number; kg: string; revenue: string; profit: Money; profitPerKg: Money; yieldPercent: number | null; topGradePercent: number | null }; rows: Row[] }

/**
 * Supplier and origin scorecard (enterprise plan E4.2): which supplier or country gives the most profit per kg
 * bought, how much of it sorts into sellable stock and how much is top grade — ranked, for containers and loose lots bought in
 * the period.
 */
@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [FormsModule, RouterLink, TPipe, WsBarChartComponent, WsCommandBarComponent, WsDataGridComponent, WsDateRangeComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.score.title' | t" [subtitle]="'ws.score.subtitle' | t">
        <a actions class="ws-btn" routerLink="/receive/records/suppliers">{{ 'ws.sp.allSuppliers' | t }}</a>
        <ws-report-actions actions [columns]="columns()" [rows]="rows()" [filename]="'thriftos-scorecard-' + by()" />
      </ws-page-header>
      <ws-command-bar>
        <div start class="switch" role="group" [attr.aria-label]="'ws.yield.by' | t">
          @for (g of groups; track g) { <button type="button" class="ws-btn" [class.on]="by() === g" [attr.aria-pressed]="by() === g" (click)="by.set(g)">{{ 'ws.yield.group.' + g | t }}</button> }
        </div>
        <ws-date-range end [allowAll]="true" [value]="range()" (valueChange)="range.set($event)" />
      </ws-command-bar>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as d) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.score.bought' | t" [value]="i18n.kg(d.totals.kg)" [hint]="'ws.sp.bought' | t: { c: i18n.num(d.totals.containers), l: i18n.num(d.totals.lots) }" />
          @if (d.totals.profitPerKg !== null) { <ws-kpi-card [label]="'ws.suppliers.col.profitPerKg' | t" [value]="i18n.money(d.totals.profitPerKg)" [hint]="'ws.score.profitSoFar' | t: { amount: i18n.money(d.totals.profit) }" /> }
          <ws-kpi-card [label]="'ws.containers.col.yield' | t" [value]="pct(d.totals.yieldPercent)" />
          <ws-kpi-card [label]="'ws.containers.col.topGrade' | t" [value]="pct(d.totals.topGradePercent)" />
        </section>
        @if (d.rows.length) {
          <ws-bar-chart [heading]="(d.totals.profitPerKg !== null ? 'ws.score.chartProfit' : 'ws.score.chartYield') | t" [categories]="labels()" [series]="series()" [format]="d.totals.profitPerKg !== null ? 'money' : 'number'" />
        }
        <ws-data-grid [caption]="'ws.score.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="by() === 'supplier'" (rowClick)="open($event)" [emptyHeading]="'ws.score.empty' | t" />
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .switch { display:flex; gap:var(--ws-2); }
    .switch .on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); }
  `],
})
export class ScorecardComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly nav = inject(NavService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly groups = ['supplier', 'origin'] as const;
  protected readonly by = signal<'supplier' | 'origin'>('supplier');
  protected readonly range = signal<WsDateRange>(rangeFor('all'));
  protected readonly data = signal<Scorecard | null>(null);
  protected readonly failed = signal(false);

  private name(k: string): string {
    return k || this.i18n.t('ws.stockValue.none');
  }
  protected readonly labels = computed(() => (this.data()?.rows ?? []).slice(0, 12).map((r) => short(this.name(r.key))));
  protected readonly series = computed(() => {
    const rows = (this.data()?.rows ?? []).slice(0, 12);
    return this.data()?.totals.profitPerKg !== null
      ? [{ label: this.i18n.t('ws.suppliers.col.profitPerKg'), values: rows.map((r) => Number(r.profitPerKg ?? 0)) }]
      : [
          { label: this.i18n.t('ws.containers.col.yield'), values: rows.map((r) => r.yieldPercent ?? 0) },
          { label: this.i18n.t('ws.containers.col.topGrade'), values: rows.map((r) => r.topGradePercent ?? 0) },
        ];
  });
  protected readonly columns = computed<WsColumn[]>(() => {
    const cost = this.data()?.totals.profitPerKg !== null;
    const t = (k: string) => this.i18n.t(k);
    return [
      { key: 'rank', label: t('ws.score.rank'), format: 'number', width: '64px' },
      { key: 'name', label: t(`ws.yield.group.${this.by()}`) },
      { key: 'containers', label: t('ws.suppliers.col.containers'), format: 'number', total: true },
      { key: 'lots', label: t('ws.purchasing.lots'), format: 'number', total: true },
      { key: 'kg', label: t('ws.suppliers.col.kg'), format: 'kg', total: true },
      ...(cost ? [{ key: 'costPerKg', label: t('ws.containers.col.costPerKg'), format: 'money' as const }] : []),
      { key: 'revenue', label: t('ws.containers.col.revenue'), format: 'money', total: true },
      ...(cost ? [{ key: 'profit', label: t('ws.containers.col.profit'), format: 'money' as const, total: true }, { key: 'profitPerKg', label: t('ws.suppliers.col.profitPerKg'), format: 'money' as const }] : []),
      { key: 'yieldPercent', label: t('ws.containers.col.yield'), format: 'percent' },
      { key: 'topGradePercent', label: t('ws.containers.col.topGrade'), format: 'percent' },
    ];
  });
  protected readonly rows = computed<WsRow[]>(() => (this.data()?.rows ?? []).map((r) => ({ ...r, id: r.id ?? r.key ?? String(r.rank), name: this.name(r.key) })) as unknown as WsRow[]);

  constructor() {
    effect(() => {
      this.by();
      this.range();
      untracked(() => this.load());
    });
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
    this.http.get<Scorecard>('/api/workspace/analytics/suppliers', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (d) => this.data.set(d), error: () => this.failed.set(true) });
  }

  protected open(row: WsRow): void {
    const r = (this.data()?.rows ?? []).find((x) => (x.id ?? x.key) === row.id);
    if (r?.id) void this.nav.open(['/receive/records/suppliers', r.id]);
  }
}
