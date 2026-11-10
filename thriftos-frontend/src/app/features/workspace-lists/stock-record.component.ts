import { moduleOn } from '../../core/tenant/module-on';
import { HttpClient } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ArrowLeftRight, Clock, ClipboardCheck, Coins, LucideAngularModule, Package, QrCode, Scale, Tag } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import {
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsSideSheetComponent,
  WsSmartButtonComponent,
  WsStateComponent,
  WsTab,
  WsTabsComponent,
} from '../../shared/ui/workspace';

type Money = string | null;
/** GET /api/workspace/stock/:id (money is null without cost.view). */
export interface StockOverview {
  item: {
    id: string; code: string | null; name: string | null; category: { id: string; name: string } | null; grade: { id: string; name: string } | null;
    source: string; unit: 'KG' | 'BALE' | 'PIECE'; status: string; quantity: string; used: string; left: string; weightKg: string | null; leftKg: string | null;
    salePrice: string | null; priceTier: string | null; createdAt: string; ageDays: number; godown: { id: string; name: string } | null;
    supplier: { id: string; name: string } | null; parent: { id: string; name: string | null } | null; qrCode: string | null; repackUnitId: string | null;
  };
  cost: { total: string; unitCost: string; valueLeft: string } | null;
  lineage: { container: { id: string; number: string } | null; supplier: { id: string; name: string } | null; lot: { id: string; code: string } | null; category: string | null; grade: string | null; amount: string; measure: string; cost: Money }[];
  pieces: { id: string; name: string | null; priceTier: string | null; quantity: string; left: string; salePrice: string | null; cost: Money }[];
  sales: { id: string; number: string; date: string; customer: string; unit: string; quantity: string; unitPrice: string; total: string; cost: Money; profit: Money }[];
  movements: { id: string; type: string; kg: string; pcs: number; date: string; details: Record<string, unknown> | null }[];
  counts: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; book: string; counted: string; difference: string; reason: string; requestedBy: string | null; decidedBy: string | null; note: string | null; date: string; costChange: Money }[];
  godowns: { id: string; name: string }[];
}

const UNIT_KEYS: Record<string, string> = { KG: 'ws.stock.unit.KG', BALE: 'ws.stock.unit.BALE', PIECE: 'ws.stock.unit.PIECE' };

/**
 * A stock item's record page (enterprise plan E3.3): what is left and what it is worth, where it came from
 * (container, lot, category, grade), its sales and opened pieces, every movement, and stock counts that wait
 * for approval; print its QR label, count it, or move it to another godown.
 */
@Component({
  selector: 'app-stock-record',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    TPipe,
    WsDataGridComponent,
    WsPageHeaderComponent,
    WsRecordActivityComponent,
    WsSideSheetComponent,
    WsSmartButtonComponent,
    WsStateComponent,
    WsTabsComponent,
  ],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.stockItem.notFound' | t" (retry)="reload()" />
    } @else if (data(); as d) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="title()" [subtitle]="subtitle()">
            <ng-container actions>
              @if (d.item.repackUnitId) {
                <a class="ws-btn" [routerLink]="['/stock/label', d.item.repackUnitId]"><lucide-icon [img]="icons.QrCode" [size]="16" aria-hidden="true" />{{ 'ws.stockItem.label' | t }}</a>
              }
              @if (can('price.manage') && +d.item.left > 0) {
                <button type="button" class="ws-btn" (click)="openPrice()">{{ 'ws.si.setPrice' | t }}</button>
              }
              <!-- Counting and moving are for stock that is still here, not for sold bales (v2 review). -->
              @if (can('INVENTORY_ADJUST') && +d.item.left > 0) {
                @if (on('STOCK_COUNTS')) {
                <button type="button" class="ws-btn" (click)="sheet.set('count')"><lucide-icon [img]="icons.ClipboardCheck" [size]="16" aria-hidden="true" />{{ 'ws.stockItem.count' | t }}</button>
                }
                @if (d.godowns.length && on('WAREHOUSES')) {
                  <button type="button" class="ws-btn" (click)="sheet.set('move')"><lucide-icon [img]="icons.ArrowLeftRight" [size]="16" aria-hidden="true" />{{ 'ws.stockItem.move' | t }}</button>
                }
              }
            </ng-container>
          </ws-page-header>

          @if (on('STOCK_COUNTS') && pending(); as p) {
            <div class="pending" role="status">
              <span>{{ 'ws.stockItem.pending' | t: { counted: qty(p.counted), book: qty(p.book), by: p.requestedBy ?? '—' } }} · {{ p.reason }}</span>
              @if (can('INVENTORY_APPROVE')) {
                <span class="row">
                  <button type="button" class="ws-btn primary" [disabled]="busy()" (click)="decide(p.id, true)">{{ 'ws.stockItem.approve' | t }}</button>
                  <button type="button" class="ws-btn" [disabled]="busy()" (click)="decide(p.id, false)">{{ 'ws.stockItem.reject' | t }}</button>
                </span>
              }
            </div>
          }

          <section class="smart">
            <ws-smart-button [label]="'ws.stock.col.left' | t" [value]="qty(d.item.left) + ' / ' + qty(d.item.quantity)" [icon]="icons.Package" [link]="[]" />
            @if (d.item.leftKg !== null) { <ws-smart-button [label]="'ws.stockItem.kgLeft' | t" [value]="i18n.kg(d.item.leftKg)" [icon]="icons.Scale" [link]="[]" /> }
            @if (d.cost) { <ws-smart-button [label]="'ws.stock.col.value' | t" [value]="i18n.money(round(d.cost.valueLeft))" [icon]="icons.Coins" [link]="[]" /> }
            @if (d.item.salePrice) { <ws-smart-button [label]="'ws.stock.col.price' | t" [value]="i18n.money(d.item.salePrice)" [icon]="icons.Tag" [link]="[]" /> }
            <ws-smart-button [label]="'ws.stock.col.age' | t" [value]="i18n.num(d.item.ageDays)" [icon]="icons.Clock" [tone]="d.item.ageDays > 90 ? 'bad' : 'plain'" [link]="[]" />
            <ws-smart-button [label]="'ws.container.tab.sales' | t" [value]="i18n.num(d.sales.length)" [icon]="icons.Coins" [link]="[]" [query]="{ tab: 'sales' }" />
          </section>

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="pickTab($event)" [label]="title()" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()" class="panel">
            @switch (tab()) {
              @case ('lineage') {
                @if (d.lineage.length) {
                  <ws-data-grid [caption]="'ws.stockItem.tab.lineage' | t" [columns]="lineageColumns()" [rows]="lineageRows()" [clickable]="true" (rowClick)="openSource($event)" />
                } @else {
                  <dl class="facts">
                    <div><dt>{{ 'ws.stock.col.source' | t }}</dt><dd>{{ 'ws.stock.source.' + d.item.source | t }}</dd></div>
                    <div><dt>{{ 'ws.containers.col.supplier' | t }}</dt><dd>{{ d.item.supplier?.name ?? '—' }}</dd></div>
                    @if (d.item.parent) { <div><dt>{{ 'ws.stockItem.openedFrom' | t }}</dt><dd><a [routerLink]="['/stock/items', d.item.parent.id]" [state]="nav.trailState()">{{ d.item.parent.name ?? '—' }}</a></dd></div> }
                    @if (d.cost) { <div><dt>{{ 'ws.col.cost' | t }}</dt><dd>{{ i18n.money(round(d.cost.total)) }}</dd></div> }
                  </dl>
                }
              }
              @case ('sales') {
                <ws-data-grid [caption]="'ws.container.tab.sales' | t" [columns]="saleColumns()" [rows]="saleRows()" [clickable]="true" (rowClick)="openSale($event)" [emptyHeading]="'ws.container.noSales' | t" />
              }
              @case ('pieces') {
                <ws-data-grid [caption]="'ws.stockItem.tab.pieces' | t" [columns]="pieceColumns()" [rows]="pieceRows()" [clickable]="true" (rowClick)="openItem($event)" />
              }
              @case ('movements') {
                <ws-data-grid [caption]="'ws.stockItem.tab.movements' | t" [columns]="movementColumns()" [rows]="movementRows()" [emptyHeading]="'ws.stockItem.noMovements' | t" />
              }
              @case ('counts') {
                <ws-data-grid [caption]="'ws.stockItem.tab.counts' | t" [columns]="countColumns()" [rows]="countRows()" [emptyHeading]="'ws.stockItem.noCounts' | t" />
              }
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="stockItem" [recordId]="d.item.id" /></aside>
      </div>

      <ws-side-sheet [open]="sheet() === 'price'" [heading]="'ws.si.setPrice' | t" (close)="sheet.set(null)">
        <form class="form" id="ws-item-price" (ngSubmit)="submitPrice()">
          <label>{{ 'ws.si.pricePer' | t: { unit: ('ws.stock.unit.' + d.item.unit | t) } }}<input name="price" type="number" min="0" step="1" [(ngModel)]="price" /></label>
          <p class="hint">{{ 'ws.si.priceOneHint' | t }}</p>
        </form>
        <ng-container footer>
          <button type="button" class="ws-btn" (click)="sheet.set(null)">{{ 'common.cancel' | t }}</button>
          <button type="submit" form="ws-item-price" class="ws-btn primary" [disabled]="busy()">{{ 'common.save' | t }}</button>
        </ng-container>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'count'" [heading]="'ws.stockItem.count' | t" (close)="sheet.set(null)">
        <form class="form" (ngSubmit)="submitCount()">
          <p class="hint">{{ 'ws.stockItem.countHint' | t: { book: qty(d.item.left) } }}</p>
          <label>{{ 'ws.counts.col.counted' | t }} ({{ unitLabel() }})
            <input name="counted" type="number" min="0" [step]="d.item.unit === 'KG' ? '0.01' : '1'" required [(ngModel)]="counted" />
          </label>
          <label>{{ 'ws.counts.col.reason' | t }}
            <textarea name="reason" rows="3" required minlength="2" maxlength="300" [(ngModel)]="reason"></textarea>
          </label>
          <p class="hint">{{ 'ws.stockItem.countApproval' | t }}</p>
          <button type="submit" class="ws-btn primary" [disabled]="busy() || counted === null || reason.trim().length < 2">{{ 'ws.stockItem.sendCount' | t }}</button>
        </form>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'move'" [heading]="'ws.stockItem.move' | t" (close)="sheet.set(null)">
        <form class="form" (ngSubmit)="submitMove()">
          <p class="hint">{{ 'ws.stockItem.moveHint' | t: { from: d.item.godown?.name ?? ('ws.stockItem.noGodown' | t) } }}</p>
          <label>{{ 'ws.stock.col.godown' | t }}
            <select name="godown" required [(ngModel)]="godownId">
              <option value="">…</option>
              @for (g of d.godowns; track g.id) { @if (g.id !== d.item.godown?.id) { <option [value]="g.id">{{ g.name }}</option> } }
            </select>
          </label>
          <button type="submit" class="ws-btn primary" [disabled]="busy() || !godownId">{{ 'ws.stockItem.moveNow' | t }}</button>
        </form>
      </ws-side-sheet>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:var(--ws-3); }
    .panel { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .row { display:inline-flex; gap:var(--ws-2); }
    .pending { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-3); padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-warn, #b45309); border-radius:var(--ws-r-lg); background:var(--ws-warn-soft, #fef3c7); color:var(--ws-ink); }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--ws-3); margin:0; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .facts dt { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .facts dd { margin:2px 0 0; }
    .facts a { color:var(--ws-brand); }
    .form { display:grid; gap:var(--ws-3); }
    .form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .form input, .form textarea, .form select { padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .hint { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
  `],
})
export class StockRecordComponent {
  protected readonly on = moduleOn();
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  /** Route parameter (component input binding). */
  readonly id = input.required<string>();
  private readonly tabRoute = inject(ActivatedRoute);
  /** The tab goes into the address (?tab=), so Back from a row opens this tab again. */
  protected pickTab(tab: string): void {
    void this.router.navigate([], { relativeTo: this.tabRoute, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected readonly nav = inject(NavService);
  /** The breadcrumb and browser tab name this record once it has loaded. */
  private readonly crumbName = effect(() => {
    const d = this.data();
    const id = this.id();
    if (d && id) this.nav.setName(id, this.title());
  });
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { ArrowLeftRight, ClipboardCheck, Clock, Coins, Package, QrCode, Scale, Tag };
  protected readonly data = signal<StockOverview | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly sheet = signal<'count' | 'move' | 'price' | null>(null);
  protected price: number | null = null;
  protected readonly chosenTab = signal<string | null>(null);
  private readonly reloads = signal(0);
  protected counted: number | null = null;
  protected reason = '';
  protected godownId = '';

  protected readonly title = computed(() => {
    const i = this.data()?.item;
    if (!i) return '';
    return [i.code, i.name].filter(Boolean).join(' · ') || '—';
  });
  protected readonly subtitle = computed(() => {
    const i = this.data()?.item;
    if (!i) return '';
    const date = new Date(i.createdAt).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
    return [this.i18n.t(`ws.stock.status.${i.status}`), i.category?.name, i.grade?.name, date, i.godown?.name].filter(Boolean).join(' · ');
  });
  protected readonly unitLabel = computed(() => this.i18n.t(UNIT_KEYS[this.data()?.item.unit ?? 'KG']));
  protected readonly pending = computed(() => this.data()?.counts.find((c) => c.status === 'PENDING') ?? null);

  protected readonly tabs = computed<WsTab[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { id: 'lineage', label: this.i18n.t('ws.stockItem.tab.lineage'), count: d.lineage.length || undefined },
      { id: 'sales', label: this.i18n.t('ws.container.tab.sales'), count: d.sales.length },
      ...(d.pieces.length ? [{ id: 'pieces', label: this.i18n.t('ws.stockItem.tab.pieces'), count: d.pieces.length }] : []),
      { id: 'movements', label: this.i18n.t('ws.stockItem.tab.movements'), count: d.movements.length },
      { id: 'counts', label: this.i18n.t('ws.stockItem.tab.counts'), count: d.counts.length },
    ];
  });
  protected readonly tab = computed(() => {
    const ids = this.tabs().map((t) => t.id);
    const want = this.chosenTab() ?? this.tabParam();
    return want && ids.includes(want) ? want : 'lineage';
  });

  private col(key: string, label: string, format?: WsColumn['format'], total?: boolean): WsColumn {
    return { key, label: this.i18n.t(label), format, total };
  }
  protected readonly lineageColumns = computed<WsColumn[]>(() => [
    this.col('container', 'ws.containers.col.number'),
    this.col('supplier', 'ws.containers.col.supplier'),
    this.col('lot', 'ws.container.lot'),
    this.col('category', 'ws.container.category'),
    this.col('grade', 'ws.container.grade'),
    // "Used 57" said nothing: the kg (or pieces) this item took from each source, and its cost in whole rupees.
    { ...this.col(this.data()?.lineage.every((l) => l.measure === 'WEIGHT') ? 'kg' : 'amount', 'ws.stockItem.used', this.data()?.lineage.every((l) => l.measure === 'WEIGHT') ? 'kg' : 'number', true) },
    ...(this.data()?.cost ? [{ ...this.col('cost', 'ws.col.cost', 'money', true), round: true }] : []),
  ]);
  protected readonly lineageRows = computed<WsRow[]>(() =>
    (this.data()?.lineage ?? []).map((l, i) => ({
      id: String(i), containerId: l.container?.id ?? null, lotId: l.lot?.id ?? null, container: l.container?.number ?? null, supplier: l.supplier?.name ?? null, lot: l.lot?.code ?? null,
      category: l.category, grade: l.grade, amount: l.amount, kg: l.amount, cost: l.cost,
    })),
  );
  protected readonly saleColumns = computed<WsColumn[]>(() => [
    this.col('number', 'ws.col.number'),
    this.col('date', 'ws.col.date', 'date'),
    this.col('customer', 'ws.col.customer'),
    this.col('quantity', 'ws.sale.quantity', 'number', true),
    this.col('unitPrice', 'ws.sale.unitPrice', 'money'),
    this.col('total', 'ws.col.total', 'money', true),
    ...(this.data()?.cost ? [this.col('cost', 'ws.col.cost', 'money', true), this.col('profit', 'ws.col.profit', 'money', true)] : []),
  ]);
  protected readonly saleRows = computed<WsRow[]>(() => (this.data()?.sales ?? []) as unknown as WsRow[]);
  protected readonly pieceColumns = computed<WsColumn[]>(() => [
    this.col('name', 'ws.stock.col.name'),
    this.col('quantity', 'ws.stock.col.quantity', 'number', true),
    this.col('left', 'ws.stock.col.left', 'number', true),
    this.col('salePrice', 'ws.stock.col.price', 'money'),
  ]);
  protected readonly pieceRows = computed<WsRow[]>(() => (this.data()?.pieces ?? []).map((p) => ({ ...p, name: p.name ?? p.priceTier })) as unknown as WsRow[]);
  protected readonly movementColumns = computed<WsColumn[]>(() => [
    this.col('date', 'ws.col.date', 'date'),
    this.col('type', 'ws.col.type'),
    this.col('change', 'ws.stockItem.change'),
    this.col('details', 'ws.container.description'),
  ]);
  protected readonly movementRows = computed<WsRow[]>(() =>
    (this.data()?.movements ?? []).map((m) => {
      const d = m.details ?? {};
      const details = m.type === 'TRANSFER' ? `${d['from'] ?? '—'} → ${d['to'] ?? '—'}` : String(d['reason'] ?? '');
      const change = m.pcs ? this.i18n.num(m.pcs) : this.i18n.kg(m.kg);
      return { id: m.id, date: m.date, type: this.i18n.t(`ws.movement.${m.type}`), change, details };
    }),
  );
  protected readonly countColumns = computed<WsColumn[]>(() => [
    this.col('date', 'ws.col.date', 'date'),
    this.col('status', 'ws.col.status'),
    this.col('book', 'ws.counts.col.book', 'number'),
    this.col('counted', 'ws.counts.col.counted', 'number'),
    this.col('difference', 'ws.counts.col.difference', 'number'),
    this.col('reason', 'ws.counts.col.reason'),
    this.col('people', 'ws.stockItem.people'),
    ...(this.data()?.cost ? [this.col('costChange', 'ws.counts.col.costChange', 'money', true)] : []),
  ]);
  protected readonly countRows = computed<WsRow[]>(() =>
    (this.data()?.counts ?? []).map((c) => ({
      ...c, status: this.i18n.t(`ws.counts.status.${c.status}`), people: [c.requestedBy, c.decidedBy].filter(Boolean).join(' → '),
    })) as unknown as WsRow[],
  );

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) =>
          this.http.get<StockOverview>(`/api/workspace/stock/${id}`).pipe(
            map((d) => ({ ok: true as const, d })),
            catchError(() => of({ ok: false as const })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.failed.set(!x.ok);
        if (x.ok) this.data.set(x.d);
      });
    toObservable(this.tabParam).pipe(takeUntilDestroyed()).subscribe(() => this.chosenTab.set(null));
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }

  protected qty(v: string): string {
    const unit = this.data()?.item.unit;
    return unit === 'KG' ? this.i18n.kg(v) : this.i18n.num(v);
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  private done(message: string): void {
    this.busy.set(false);
    this.sheet.set(null);
    this.toast.show(message);
    this.reload();
  }

  private failedWith(e: { status?: number; error?: { message?: string } }): void {
    this.busy.set(false);
    this.toast.show(e.status === 409 || e.status === 400 ? (e.error?.message ?? this.i18n.t('common.couldNotSave')) : this.i18n.t('common.couldNotSave'));
  }

  protected openPrice(): void {
    const p = this.data()?.item.salePrice;
    this.price = p ? Number(p) : null;
    this.sheet.set('price');
  }

  /** One item's price (empty clears it). */
  protected submitPrice(): void {
    const d = this.data();
    if (!d) return;
    this.busy.set(true);
    this.http.patch(`/api/workspace/stock/items/${d.item.id}/price`, { salePrice: this.price || this.price === 0 ? Number(this.price) : null }).subscribe({
      next: () => this.done(this.i18n.t('ws.si.priceSavedOne')),
      error: (e) => this.failedWith(e),
    });
  }

  protected submitCount(): void {
    const d = this.data();
    if (!d || this.counted === null) return;
    this.busy.set(true);
    this.http.post(`/api/workspace/stock/${d.item.id}/counts`, { counted: this.counted, reason: this.reason.trim() }).subscribe({
      next: () => { this.counted = null; this.reason = ''; this.done(this.i18n.t('ws.stockItem.countSent')); },
      error: (e) => this.failedWith(e),
    });
  }

  protected decide(countId: string, approve: boolean): void {
    this.busy.set(true);
    this.http.post(`/api/workspace/stock-counts/${countId}/${approve ? 'approve' : 'reject'}`, {}).subscribe({
      next: () => this.done(this.i18n.t(approve ? 'ws.stockItem.approved' : 'ws.stockItem.rejected')),
      error: (e) => this.failedWith(e),
    });
  }

  protected submitMove(): void {
    const d = this.data();
    if (!d || !this.godownId) return;
    const to = d.godowns.find((g) => g.id === this.godownId)?.name ?? '';
    this.busy.set(true);
    this.http.post(`/api/workspace/stock/${d.item.id}/transfer`, { godownId: this.godownId }).subscribe({
      next: () => { this.godownId = ''; this.done(this.i18n.t('ws.stockItem.moved', { to })); },
      error: (e) => this.failedWith(e),
    });
  }

  /** Whole rupees for totals (per-kg prices keep paisa). */
  protected round(v: string | number | null | undefined): number | null {
    return v === null || v === undefined || v === '' ? null : Math.round(Number(v));
  }

  /** A source row opens the lot it was sorted from (its page leads on to the container), else the container. */
  protected openSource(row: WsRow): void {
    if (row['lotId']) void this.nav.open(['/sort/records', row['lotId']]);
    else if (row['containerId']) void this.nav.open(['/receive/records/containers', row['containerId']]);
  }

  protected openSale(row: WsRow): void {
    void this.nav.open(['/sell/records', row.id]);
  }

  protected openItem(row: WsRow): void {
    void this.nav.open(['/stock/items', row.id]);
  }
}
