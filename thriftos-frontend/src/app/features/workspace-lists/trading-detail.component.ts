import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { moduleOn } from '../../core/tenant/module-on';
import { WsColumn, WsDataGridComponent, WsReportActionsComponent, WsRow, WsStateComponent } from '../../shared/ui/workspace';

type Money = string;
interface Profit { revenue: Money; cost: Money; profit: Money; marginPercent: number | null }
interface LotRow { kind: 'LOT' | 'CONTAINER'; id: string; code: string; supplier: string | null; boughtAt: string; bought: Money; kg: Money; revenue: Money; costSold: Money; profit: Money; notSold: Money }
/** GET /api/workspace/finance/trading */
interface Trading {
  from: string;
  stock: { opening: Money; bought: Money; soldAtCost: Money; writtenOff: Money; closing: Money; parts: { waiting: Money; sorted: Money; ready: Money } };
  byCustomer: Array<Profit & { id: string; name: string; city: string | null; bills: number }>;
  byItem: Array<Profit & { name: string; kg: Money }>;
  byLot: LotRow[];
  bySupplier: Array<{ id: string; name: string; lots: number; kg: Money; bought: Money; revenue: Money; costSold: Money; profit: Money; notSold: Money; owed: Money }>;
  owed: { toSuppliers: Money; paidToSuppliers: Money; byCustomers: Money; receivedFromCustomers: Money };
}
type Tab = 'lot' | 'supplier' | 'customer' | 'item';

/**
 * What stands behind the Trading report (owner, 2026-11-17): the stock account of the period, what is owed to
 * suppliers and by customers, and profit by lot or container, supplier, customer and item. Lots and suppliers
 * are to date (a lot bought earlier still sells now); customers and items are for the period picked.
 */
@Component({
  selector: 'app-trading-detail',
  standalone: true,
  imports: [TPipe, WsDataGridComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.pnl.loadFailed' | t" (retry)="load()" />
    } @else if (data(); as d) {
      <div class="pair">
        <section class="card" [attr.aria-label]="'ws.tr.stock' | t">
          <h2>{{ 'ws.tr.stock' | t }}</h2>
          <dl>
            <div><dt>{{ 'ws.tr.opening' | t }}</dt><dd class="ws-num">{{ rs(d.stock.opening) }}</dd></div>
            <div><dt>+ {{ 'ws.tr.bought' | t }}</dt><dd class="ws-num">{{ rs(d.stock.bought) }}</dd></div>
            <div><dt>− {{ 'ws.tr.soldAtCost' | t }}</dt><dd class="ws-num">{{ rs(d.stock.soldAtCost) }}</dd></div>
            @if (+d.stock.writtenOff) { <div><dt>− {{ 'ws.pnl.writeOffs' | t }}</dt><dd class="ws-num">{{ rs(d.stock.writtenOff) }}</dd></div> }
            <div class="sum"><dt>= {{ 'ws.tr.closing' | t }}</dt><dd class="ws-num">{{ rs(d.stock.closing) }}</dd></div>
          </dl>
          <p class="tip">{{ 'ws.tr.closingParts' | t: { waiting: rs(d.stock.parts.waiting), sorted: rs(d.stock.parts.sorted), ready: rs(d.stock.parts.ready) } }}</p>
          <p class="tip">{{ 'ws.tr.openingNote' | t }}</p>
        </section>
        <section class="card" [attr.aria-label]="'ws.tr.owed' | t">
          <h2>{{ 'ws.tr.owed' | t }}</h2>
          <dl>
            <div><dt>{{ 'ws.tr.toSuppliers' | t }}</dt><dd class="ws-num">{{ rs(d.owed.toSuppliers) }}</dd></div>
            <div class="sub"><dt>{{ 'ws.tr.paidToSuppliers' | t }}</dt><dd class="ws-num">{{ rs(d.owed.paidToSuppliers) }}</dd></div>
            @if (on('KHATA')) {
              <div><dt>{{ 'ws.tr.byCustomers' | t }}</dt><dd class="ws-num">{{ rs(d.owed.byCustomers) }}</dd></div>
            }
            <div class="sub"><dt>{{ 'ws.tr.received' | t }}</dt><dd class="ws-num">{{ rs(d.owed.receivedFromCustomers) }}</dd></div>
          </dl>
        </section>
      </div>
      <section class="card">
        <div class="head">
          <div class="tabs" role="tablist" [attr.aria-label]="'ws.tr.profitBy' | t">
            @for (x of tabs; track x) {
              <button type="button" role="tab" [attr.aria-selected]="tab() === x" [class.on]="tab() === x" (click)="tab.set(x)">{{ 'ws.tr.tab.' + x | t }}</button>
            }
          </div>
          <ws-report-actions [columns]="columns()" [rows]="rows()" [filename]="'thriftos-trading-by-' + tab()" />
        </div>
        <ws-data-grid [caption]="'ws.tr.tab.' + tab() | t" [columns]="columns()" [rows]="rows()" [clickable]="tab() !== 'item'" (rowClick)="open($event)" [emptyHeading]="'ws.tr.none' | t" />
        <p class="tip">{{ (tab() === 'lot' || tab() === 'supplier' ? 'ws.tr.toDate' : 'ws.tr.inPeriod') | t }}</p>
      </section>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    :host { display:grid; gap:var(--ws-4); }
    .pair { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap:var(--ws-4); }
    .card { display:grid; gap:var(--ws-3); align-content:start; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); min-width:0; }
    h2 { margin:0; font-size:var(--ws-text-md); font-weight:600; color:var(--ws-ink); }
    dl { display:grid; gap:var(--ws-2); margin:0; }
    dl > div { display:flex; justify-content:space-between; gap:var(--ws-3); }
    dt { color:var(--ws-ink-2); }
    dd { margin:0; font-weight:600; }
    dl > div.sub dt { padding-inline-start:var(--ws-4); font-size:var(--ws-text-sm); }
    dl > div.sub dd { font-weight:400; }
    dl > div.sum { padding-block-start:var(--ws-2); border-block-start:1px solid var(--ws-line); }
    dl > div.sum dt { color:var(--ws-ink); font-weight:600; }
    .tip { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-3); }
    .tabs { display:flex; flex-wrap:wrap; gap:var(--ws-1); }
    .tabs button { min-height:var(--ws-control-h); padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink-2); font:inherit; cursor:pointer; }
    .tabs button.on { border-color:var(--ws-primary); color:var(--ws-ink); font-weight:600; }
  `],
})
export class TradingDetailComponent {
  /** Months of the period, as picked on the page. */
  readonly months = input.required<number>();
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly on = moduleOn();
  protected readonly data = signal<Trading | null>(null);
  protected readonly failed = signal(false);
  protected readonly tabs: Tab[] = ['lot', 'supplier', 'customer', 'item'];
  protected readonly tab = signal<Tab>('lot');

  constructor() {
    effect(() => {
      this.months();
      untracked(() => this.load());
    });
  }

  protected rs(v: string | number): string {
    return this.i18n.money(Math.round(Number(v)));
  }

  protected readonly columns = computed<WsColumn[]>(() => {
    const t = (k: string) => this.i18n.t(k);
    const money = (key: string, label: string, extra: Partial<WsColumn> = {}): WsColumn => ({ key, label: t(label), format: 'money', round: true, total: true, ...extra });
    const profit = money('profit', 'ws.col.profit', { tone: 'sign' });
    switch (this.tab()) {
      case 'lot':
        return [
          { key: 'code', label: t('ws.tr.col.lot') }, { key: 'supplier', label: t('ws.suppliers.col.name') }, { key: 'boughtAt', label: t('ws.tr.col.boughtOn'), format: 'date' },
          money('bought', 'ws.tr.col.boughtFor'), money('revenue', 'ws.tr.col.soldFor'), money('costSold', 'ws.tr.col.costSold'), profit, money('notSold', 'ws.tr.col.notSold', { info: t('ws.tr.notSoldInfo') }),
        ];
      case 'supplier':
        return [
          { key: 'name', label: t('ws.suppliers.col.name') }, { key: 'lots', label: t('ws.tr.col.lots'), format: 'number', total: true },
          money('bought', 'ws.tr.col.boughtFor'), money('revenue', 'ws.tr.col.soldFor'), money('costSold', 'ws.tr.col.costSold'), profit, money('notSold', 'ws.tr.col.notSold', { info: t('ws.tr.notSoldInfo') }), money('owed', 'ws.suppliers.col.owed'),
        ];
      case 'customer':
        return [
          { key: 'name', label: t('ws.col.customer') }, { key: 'city', label: t('ws.col.city') }, { key: 'bills', label: t('ws.customers.col.bills'), format: 'number', total: true },
          money('revenue', 'ws.pnl.revenue'), money('cost', 'ws.pnl.cost'), profit, { key: 'marginPercent', label: t('ws.tr.col.margin'), format: 'percent' },
        ];
      default:
        return [
          { key: 'name', label: t('ws.stock.col.name') }, { key: 'kg', label: t('ws.tr.col.kgSold'), format: 'kg', total: true },
          money('revenue', 'ws.pnl.revenue'), money('cost', 'ws.pnl.cost'), profit, { key: 'marginPercent', label: t('ws.tr.col.margin'), format: 'percent' },
        ];
    }
  });
  protected readonly rows = computed<WsRow[]>(() => {
    const d = this.data();
    if (!d) return [];
    switch (this.tab()) {
      case 'lot': return d.byLot.map((r) => ({ ...r, id: `${r.kind}:${r.id}` })) as unknown as WsRow[];
      case 'supplier': return d.bySupplier as unknown as WsRow[];
      case 'customer': return d.byCustomer as unknown as WsRow[];
      default: return d.byItem.map((r) => ({ ...r, id: r.name })) as unknown as WsRow[];
    }
  });

  /** A row opens what it is about: the lot or container, the supplier, the customer. */
  protected open(row: WsRow): void {
    const id = String(row.id);
    if (this.tab() === 'lot') return void this.router.navigate(id.startsWith('CONTAINER:') ? ['/receive/records/containers', id.slice(10)] : ['/receive/records/lots', id.slice(4)]);
    if (this.tab() === 'supplier') return void this.router.navigate(['/receive/records/suppliers', id]);
    if (this.tab() === 'customer') return void this.router.navigate(['/sell/customers', id]);
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<Trading>('/api/workspace/finance/trading', { params: new HttpParams().set('months', String(this.months())) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.failed.set(true),
    });
  }
}
