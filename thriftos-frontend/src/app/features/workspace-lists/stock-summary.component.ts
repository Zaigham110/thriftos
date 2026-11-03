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
  WsRow,
  WsStateComponent,
} from '../../shared/ui/workspace';

interface Bucket { items: number; kg: string; value: string | null }
/** GET /api/workspace/stock/summary (value is null without cost.view). */
export interface StockSummary {
  total: Bucket;
  ageing: (Bucket & { bucket: string })[];
  byCategory: (Bucket & { name: string })[];
  byGodown: (Bucket & { name: string })[];
  pendingCounts: number;
}

/** Stock ageing and valuation (enterprise plan E3.3): what is left, how old it is, what it is worth, where. */
@Component({
  selector: 'app-stock-summary',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe, WsBarChartComponent, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" (retry)="load()" />
    } @else if (data(); as d) {
      <div class="page">
        <ws-page-header [heading]="'ws.stockValue.title' | t" [subtitle]="'ws.stockValue.subtitle' | t">
          <a actions class="ws-btn" routerLink="/stock/items/counts"><lucide-icon [img]="icons.ClipboardCheck" [size]="16" aria-hidden="true" />{{ 'ws.counts.title' | t }}@if (d.pendingCounts) { · {{ 'ws.stockValue.waiting' | t: { n: d.pendingCounts } }} }</a>
        </ws-page-header>
        <section class="kpis">
          <ws-kpi-card [label]="'ws.stockValue.items' | t" [value]="i18n.num(d.total.items)" [link]="'/stock/items'" />
          <ws-kpi-card [label]="'ws.stockItem.kgLeft' | t" [value]="i18n.kg(d.total.kg)" />
          @if (d.total.value !== null) { <ws-kpi-card [label]="'ws.stock.col.value' | t" [value]="i18n.money(d.total.value)" /> }
          <ws-kpi-card [label]="'ws.stockValue.old' | t" [value]="i18n.num(old())" [hint]="'ws.stockValue.oldHint' | t" />
        </section>
        <div class="two">
          <ws-bar-chart [heading]="'ws.stockValue.ageing' | t" [categories]="ageLabels()" [series]="ageSeries()" [format]="d.total.value !== null ? 'money' : 'kg'" />
          <ws-data-grid [caption]="'ws.stockValue.ageing' | t" [columns]="ageColumns()" [rows]="ageRows()" />
        </div>
        <div class="two">
          <ws-data-grid [caption]="'ws.stockValue.byCategory' | t" [columns]="categoryColumns()" [rows]="categoryRows()" />
          <ws-data-grid [caption]="'ws.stockValue.byGodown' | t" [columns]="godownColumns()" [rows]="godownRows()" />
        </div>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
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

  protected readonly ageLabels = computed(() => (this.data()?.ageing ?? []).map((a) => this.i18n.t(`ws.stockValue.age.${a.bucket}`)));
  protected readonly ageSeries = computed(() => {
    const d = this.data();
    if (!d) return [];
    const byValue = d.total.value !== null;
    return [{ label: this.i18n.t(byValue ? 'ws.stock.col.value' : 'ws.containers.col.kg'), values: d.ageing.map((a) => Number(byValue ? a.value : a.kg)) }];
  });
  protected readonly old = computed(() => (this.data()?.ageing ?? []).filter((a) => a.bucket === '61-90' || a.bucket === '90+').reduce((s, a) => s + a.items, 0));
  protected readonly ageColumns = computed<WsColumn[]>(() => this.groupColumns('ws.stockValue.ageCol'));
  protected readonly ageRows = computed<WsRow[]>(() => (this.data()?.ageing ?? []).map((a) => ({ id: a.bucket, name: this.i18n.t(`ws.stockValue.age.${a.bucket}`), items: a.items, kg: a.kg, value: a.value })));

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
      ...(this.data()?.total.value !== null ? [{ key: 'value', label: this.i18n.t('ws.stock.col.value'), format: 'money' as const, total: true }] : []),
    ];
  }

  protected rows(list: (Bucket & { name: string })[]): WsRow[] {
    return list.map((x, i) => ({ id: String(i), ...x, name: x.name || this.i18n.t('ws.stockValue.none') }));
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<StockSummary>('/api/workspace/stock/summary').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.failed.set(true),
    });
  }
}
