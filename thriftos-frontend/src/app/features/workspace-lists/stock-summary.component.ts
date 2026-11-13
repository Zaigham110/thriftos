import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ClipboardCheck, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsBarChartComponent,
  WsColumn,
  WsDataGridComponent,
  WsKpiCardComponent,
  WsPageHeaderComponent,
  WsReportActionsComponent,
  WsRow,
  WsStateComponent,
} from '../../shared/ui/workspace';

interface Bucket { items: number; kg: string; value: string | null }
/** GET /api/workspace/stock/summary (value is null without cost.view). */
export interface StockSummary {
  total: Bucket;
  /** Of the total: sorted kg not in bales yet. */
  sorted?: { kg: string; value: string | null };
  ageing: (Bucket & { bucket: string })[];
  byCategory: (Bucket & { name: string })[];
  byGodown: (Bucket & { name: string })[];
  pendingCounts: number;
  ageByCategory: { name: string; buckets: Record<string, { kg: string; value: string | null }> }[];
}

/** Stock ageing and valuation (enterprise plan E3.3): what is left, how old it is, what it is worth, where. */
@Component({
  selector: 'app-stock-summary',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe, WsBarChartComponent, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" (retry)="load()" />
    } @else if (data(); as d) {
      <div class="page">
        <ws-page-header [heading]="'ws.stockValue.title' | t" [subtitle]="'ws.stockValue.subtitle' | t">
          <ws-report-actions actions [columns]="matrixColumns()" [rows]="matrixRows()" filename="thriftos-stock-ageing" />
          <a actions class="ws-btn" routerLink="/stock/items/counts"><lucide-icon [img]="icons.ClipboardCheck" [size]="16" aria-hidden="true" />{{ 'ws.counts.title' | t }}@if (d.pendingCounts) { · {{ 'ws.stockValue.waiting' | t: { n: d.pendingCounts } }} }</a>
        </ws-page-header>
        <section class="kpis">
          <ws-kpi-card [label]="'ws.stockValue.items' | t" [value]="i18n.num(d.total.items)" [link]="'/stock/by-item'" />
          <!-- Sorted kg not in bales yet is stock too (v2 review); the line under says how much of it there is. -->
          <ws-kpi-card [label]="'ws.stockItem.kgLeft' | t" [value]="i18n.kg(d.total.kg)" [hint]="d.sorted ? ('ws.si.sortedHint' | t: { kg: i18n.kg(d.sorted.kg) }) : ''" />
          @if (d.total.value !== null) { <ws-kpi-card [label]="'ws.stock.col.value' | t" [value]="i18n.money(round(d.total.value))" [hint]="d.sorted?.value ? ('ws.si.sortedValueHint' | t: { value: i18n.money(round(d.sorted!.value)) }) : ''" /> }
          <ws-kpi-card [label]="'ws.stockValue.old' | t" [value]="i18n.kg(old())" [hint]="old() > 0 ? ('ws.stockValue.oldHint' | t) : ''" />
        </section>
        <div class="two">
          <ws-bar-chart [heading]="'ws.stockValue.ageing' | t" [categories]="ageLabels()" [series]="ageSeries()" [format]="d.total.value !== null ? 'money' : 'kg'" />
          <section class="block"><h2>{{ 'ws.stockValue.ageing' | t }}</h2><ws-data-grid [caption]="'ws.stockValue.ageing' | t" [columns]="ageColumns()" [rows]="ageRows()" /></section>
        </div>
        <!-- Every table says what it is (v2 review). -->
        <section class="block"><h2>{{ 'ws.stockValue.matrix' | t }}</h2><ws-data-grid [caption]="'ws.stockValue.matrix' | t" [columns]="matrixColumns()" [rows]="matrixRows()" /></section>
        <div class="two">
          <section class="block"><h2>{{ 'ws.stockValue.byCategory' | t }}</h2><ws-data-grid [caption]="'ws.stockValue.byCategory' | t" [columns]="categoryColumns()" [rows]="categoryRows()" /></section>
          <section class="block"><h2>{{ 'ws.stockValue.byGodown' | t }}</h2><ws-data-grid [caption]="'ws.stockValue.byGodown' | t" [columns]="godownColumns()" [rows]="godownRows()" /></section>
        </div>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .block { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-2); }
    .block h2 { margin:0; font-size:var(--ws-text-md, 15px); font-weight:600; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:var(--ws-4); align-items:start; }
  `],
})
export class StockSummaryComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { ClipboardCheck };
  protected readonly data = signal<StockSummary | null>(null);
  protected readonly failed = signal(false);

  protected round(v: string | number | null | undefined): number | null {
    return v === null || v === undefined || v === '' ? null : Math.round(Number(v));
  }
  protected readonly ageLabels = computed(() => (this.data()?.ageing ?? []).map((a) => this.i18n.t(`ws.stockValue.age.${a.bucket}`)));
  protected readonly ageSeries = computed(() => {
    const d = this.data();
    if (!d) return [];
    const byValue = d.total.value !== null;
    return [{ label: this.i18n.t(byValue ? 'ws.stock.col.value' : 'ws.containers.col.kg'), values: d.ageing.map((a) => Number(byValue ? a.value : a.kg)) }];
  });
  /** Kg older than 60 days, bales and sorted kg alike (items alone missed old sorted stock). */
  protected readonly old = computed(() => (this.data()?.ageing ?? []).filter((a) => a.bucket === '61-90' || a.bucket === '90+').reduce((s, a) => s + Number(a.kg), 0));
  protected readonly ageColumns = computed<WsColumn[]>(() => this.groupColumns('ws.stockValue.ageCol'));
  protected readonly ageRows = computed<WsRow[]>(() => (this.data()?.ageing ?? []).map((a) => ({ id: a.bucket, name: this.i18n.t(`ws.stockValue.age.${a.bucket}`), items: a.items || null, kg: a.kg, value: a.value })));

  /** Category × age: value left (or kg without cost permission); old stock to clear first. */
  protected readonly matrixColumns = computed<WsColumn[]>(() => {
    const money = this.data()?.total.value !== null;
    return [
      { key: 'name', label: this.i18n.t('ws.container.category') },
      ...['0-30', '31-60', '61-90', '90+'].map((k) => ({ key: k, label: this.i18n.t(`ws.stockValue.age.${k}`), format: (money ? 'money' : 'kg') as 'money' | 'kg', total: true, round: true })),
    ];
  });
  protected readonly matrixRows = computed<WsRow[]>(() => {
    const money = this.data()?.total.value !== null;
    return (this.data()?.ageByCategory ?? []).map((c, i) => ({
      id: String(i), name: c.name || this.i18n.t('ws.stockValue.none'),
      ...Object.fromEntries(Object.entries(c.buckets).map(([k, b]) => [k, money ? b.value : b.kg])),
    }));
  });
  protected readonly categoryRows = computed(() => this.rows(this.data()?.byCategory ?? []));
  protected readonly godownRows = computed(() => this.rows(this.data()?.byGodown ?? []));
  protected readonly categoryColumns = computed(() => this.groupColumns('ws.container.category'));
  protected readonly godownColumns = computed(() => this.groupColumns('ws.stock.col.godown'));

  constructor() {
    this.load();
  }

  protected groupColumns(label: string): WsColumn[] {
    return [
      { key: 'name', label: this.i18n.t(label) },
      { key: 'items', label: this.i18n.t('ws.stockValue.items'), format: 'number', total: true },
      { key: 'kg', label: this.i18n.t('ws.stockItem.kgLeft'), format: 'kg', total: true },
      ...(this.data()?.total.value !== null ? [{ key: 'value', label: this.i18n.t('ws.stock.col.value'), format: 'money' as const, total: true, round: true }] : []),
    ];
  }

  protected rows(list: (Bucket & { name: string })[]): WsRow[] {
    // Sorted kg that is not baled is no bale or item: its count reads "—", not 0.
    return list.map((x, i) => ({ id: String(i), ...x, items: x.items || null, name: x.name || this.i18n.t('ws.stockValue.none') }));
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<StockSummary>('/api/workspace/stock/summary').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.failed.set(true),
    });
  }
}
