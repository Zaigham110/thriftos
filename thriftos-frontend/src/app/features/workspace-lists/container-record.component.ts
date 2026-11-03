import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Boxes, Coins, Layers3, LucideAngularModule, Pencil, Percent, Plus, Receipt, Scale, Truck } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsSmartButtonComponent,
  WsStateComponent,
  WsStatusPipelineComponent,
  WsTab,
  WsTabsComponent,
} from '../../shared/ui/workspace';

type Money = string | null;
/** GET /api/workspace/containers/:id — the traceability overview (money is null without cost.view). */
export interface ContainerOverview {
  container: {
    id: string; number: string; status: string; supplier: { id: string; name: string } | null; origin: string | null; createdAt: string;
    arrivedAt: string | null; clearedAt: string | null; netWeight: string; billOfLading: string | null; vessel: string | null; notes: string | null;
    purchaseCurrency: string; fxRate: string;
  };
  cost: { purchase: string; purchasePKR: string; charges: { id: string; type: string; description: string | null; amount: string }[]; chargesTotal: string; landed: string; perKg: string } | null;
  lots: { id: string; code: string; kg: string; status: string; cost: Money }[];
  sorting: { categories: { name: string; kg: string; cost: Money }[]; sortedKg: string; wasteKg: string; yieldPercent: number | null };
  grades: { name: string; kg: string }[];
  topGradePercent: number | null;
  bales: { id: string; itemId: string | null; code: string; category: string | null; grade: string | null; kg: string; sold: boolean; costFromHere: Money; totalCost: Money }[];
  sales: { id: string; number: string; date: string; customer: string; revenue: string; profit: Money }[];
  totals: { kg: string; bales: number; balesSold: number; revenue: string; profit: Money; profitPerKg: Money };
}

const STEPS = ['IN_TRANSIT', 'ARRIVED', 'CLEARED', 'CLOSED'] as const;

/**
 * A container's record page (enterprise plan E3.1): where its money went and came back — landed cost,
 * lots, sorting by category and grade, the bales made from it and the sales of those bales, with the
 * activity panel beside it.
 */
@Component({
  selector: 'app-container-record',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    TPipe,
    WsDataGridComponent,
    WsPageHeaderComponent,
    WsRecordActivityComponent,
    WsSmartButtonComponent,
    WsStateComponent,
    WsStatusPipelineComponent,
    WsTabsComponent,
  ],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.container.notFound' | t" (retry)="reload()" />
    } @else if (data(); as d) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="d.container.number + (d.container.supplier ? ' · ' + d.container.supplier.name : '')" [subtitle]="subtitle()">
            @if (can('container.update')) {
              <ng-container actions>
              <a class="ws-btn" [routerLink]="['/receive/records/containers', d.container.id, 'edit']"><lucide-icon [img]="icons.Pencil" [size]="16" aria-hidden="true" />{{ 'ws.container.edit' | t }}</a>
              <a class="ws-btn" [routerLink]="['/receive/records/containers', d.container.id, 'charges', 'create']"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.container.addCharge' | t }}</a>
              </ng-container>
            }
            @if (can('rag.create')) {
              <a actions class="ws-btn" [routerLink]="['/receive/records/containers', d.container.id, 'rags', 'create']"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.container.addLot' | t }}</a>
            }
          </ws-page-header>

          <ws-status-pipeline [steps]="steps()" [current]="stepIndex()" [label]="'ws.col.status' | t" />

          <section class="smart">
            @if (d.cost) { <ws-smart-button [label]="'ws.containers.col.landedCost' | t" [value]="i18n.money(d.cost.landed)" [icon]="icons.Receipt" [link]="[]" [query]="{ tab: 'cost' }" /> }
            <ws-smart-button [label]="'ws.containers.col.kg' | t" [value]="i18n.kg(d.container.netWeight)" [icon]="icons.Scale" [link]="[]" [query]="{ tab: 'sorting' }" />
            <ws-smart-button [label]="'ws.containers.col.yield' | t" [value]="pct(d.sorting.yieldPercent)" [icon]="icons.Layers3" [link]="[]" [query]="{ tab: 'sorting' }" />
            <ws-smart-button [label]="'ws.containers.col.topGrade' | t" [value]="pct(d.topGradePercent)" [icon]="icons.Percent" [link]="[]" [query]="{ tab: 'sorting' }" />
            <ws-smart-button [label]="'ws.container.balesSold' | t" [value]="d.totals.balesSold + ' / ' + d.totals.bales" [icon]="icons.Boxes" [link]="[]" [query]="{ tab: 'bales' }" />
            <ws-smart-button [label]="'ws.containers.col.revenue' | t" [value]="i18n.money(d.totals.revenue)" [icon]="icons.Truck" [link]="[]" [query]="{ tab: 'sales' }" />
            @if (d.totals.profit !== null) {
              <ws-smart-button [label]="'ws.containers.col.profit' | t" [value]="i18n.money(d.totals.profit)" [icon]="icons.Coins" [tone]="+d.totals.profit >= 0 ? 'good' : 'bad'" [link]="[]" [query]="{ tab: 'sales' }" />
            }
          </section>

          <ol class="trace" [attr.aria-label]="'ws.container.trace' | t">
            @if (d.cost) { <li><span>{{ 'ws.container.flow.landed' | t }}</span><strong>{{ i18n.money(d.cost.landed) }}</strong><small>{{ 'ws.container.flow.costPerKg' | t: { amount: i18n.money(d.cost.perKg) } }}</small></li> }
            <li><span>{{ 'ws.container.flow.lots' | t }}</span><strong>{{ i18n.num(d.lots.length) }}</strong><small>{{ i18n.kg(d.totals.kg) }}</small></li>
            <li><span>{{ 'ws.container.flow.sorted' | t }}</span><strong>{{ i18n.kg(d.sorting.sortedKg) }}</strong><small>{{ 'ws.container.flow.waste' | t: { kg: i18n.kg(d.sorting.wasteKg) } }}</small></li>
            <li><span>{{ 'ws.container.flow.graded' | t }}</span><strong>{{ i18n.kg(gradedKg()) }}</strong><small>{{ 'ws.containers.col.topGrade' | t }} {{ pct(d.topGradePercent) }}</small></li>
            <li><span>{{ 'ws.container.flow.bales' | t }}</span><strong>{{ i18n.num(d.totals.bales) }}</strong><small>{{ 'ws.container.flow.sold' | t: { n: i18n.num(d.totals.balesSold) } }}</small></li>
            <li><span>{{ 'ws.container.flow.revenue' | t }}</span><strong>{{ i18n.money(d.totals.revenue) }}</strong>
              @if (d.totals.profitPerKg !== null) { <small>{{ 'ws.container.flow.perKg' | t: { amount: i18n.money(d.totals.profitPerKg) } }}</small> }
            </li>
          </ol>

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="chosenTab.set($event)" [label]="d.container.number" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()" class="panel">
            @switch (tab()) {
              @case ('cost') {
                <dl class="facts">
                  <div><dt>{{ 'ws.container.purchase' | t }}</dt><dd>{{ purchaseText() }}</dd></div>
                  <div><dt>{{ 'ws.container.charges' | t }}</dt><dd>{{ i18n.money(d.cost?.chargesTotal) }}</dd></div>
                  <div><dt>{{ 'ws.containers.col.landedCost' | t }}</dt><dd><strong>{{ i18n.money(d.cost?.landed) }}</strong></dd></div>
                  <div><dt>{{ 'ws.containers.col.costPerKg' | t }}</dt><dd>{{ i18n.money(d.cost?.perKg) }}</dd></div>
                </dl>
                <ws-data-grid [caption]="'ws.container.charges' | t" [columns]="chargeColumns()" [rows]="chargeRows()" [emptyHeading]="'ws.container.noCharges' | t" />
              }
              @case ('sorting') {
                <div class="two">
                  <ws-data-grid [caption]="'ws.container.categories' | t" [columns]="categoryColumns()" [rows]="categoryRows()" [emptyHeading]="'ws.container.notSorted' | t" />
                  <ws-data-grid [caption]="'ws.container.grades' | t" [columns]="gradeColumns()" [rows]="gradeRows()" [emptyHeading]="'ws.container.notGraded' | t" />
                </div>
                <ws-data-grid [caption]="'ws.container.lots' | t" [columns]="lotColumns()" [rows]="lotRows()" [emptyHeading]="'ws.container.noLots' | t" />
              }
              @case ('bales') {
                <ws-data-grid [caption]="'ws.container.bales' | t" [columns]="baleColumns()" [rows]="baleRows()" [clickable]="true" (rowClick)="openBale($event)" [emptyHeading]="'ws.container.noBales' | t" />
              }
              @case ('sales') {
                <ws-data-grid [caption]="'ws.container.sales' | t" [columns]="saleColumns()" [rows]="saleRows()" [clickable]="true" (rowClick)="openSale($event)" [emptyHeading]="'ws.container.noSales' | t" />
              }
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="container" [recordId]="d.container.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:var(--ws-3); }
    .trace { list-style:none; margin:0; padding:0; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0, 1fr); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); overflow:hidden; }
    .trace li { position:relative; display:grid; gap:2px; padding:var(--ws-3) var(--ws-4); }
    .trace li + li { border-inline-start:1px solid var(--ws-line); }
    .trace li + li::before { content:''; position:absolute; inset-inline-start:-7px; top:50%; width:12px; height:12px; margin-top:-6px; border-block-start:1px solid var(--ws-line); border-inline-end:1px solid var(--ws-line); background:var(--ws-surface); transform:rotate(45deg); }
    :host-context([dir=rtl]) .trace li + li::before { transform:rotate(-135deg); }
    .trace span { color:var(--ws-ink-2); font-size:var(--ws-text-xs); text-transform:uppercase; letter-spacing:.04em; }
    .trace strong { font-size:var(--ws-text-md); white-space:nowrap; font-variant-numeric:tabular-nums; }
    .trace small { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .panel { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:var(--ws-4); }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--ws-3); margin:0; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .facts dt { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .facts dd { margin:2px 0 0; font-variant-numeric:tabular-nums; }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } .trace { grid-auto-flow:row; } .trace li + li { border-inline-start:0; border-block-start:1px solid var(--ws-line); } .trace li + li::before { display:none; } }
  `],
})
export class ContainerRecordComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Route parameter (component input binding). */
  readonly id = input.required<string>();
  /** ?tab= from a smart button. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { Boxes, Coins, Layers3, Pencil, Percent, Plus, Receipt, Scale, Truck };
  protected readonly data = signal<ContainerOverview | null>(null);
  protected readonly failed = signal(false);
  private readonly reloads = signal(0);
  protected readonly chosenTab = signal<string | null>(null);
  private readonly lastParam = signal<string | undefined>(undefined);

  protected readonly tabs = computed<WsTab[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      ...(d.cost ? [{ id: 'cost', label: this.i18n.t('ws.container.tab.cost'), count: d.cost.charges.length }] : []),
      { id: 'sorting', label: this.i18n.t('ws.container.tab.sorting'), count: d.sorting.categories.length },
      { id: 'bales', label: this.i18n.t('ws.container.tab.bales'), count: d.bales.length },
      { id: 'sales', label: this.i18n.t('ws.container.tab.sales'), count: d.sales.length },
    ];
  });
  protected readonly tab = computed(() => {
    const ids = this.tabs().map((t) => t.id);
    const want = this.chosenTab() ?? this.tabParam();
    return want && ids.includes(want) ? want : ids[0] ?? 'sorting';
  });

  protected readonly steps = computed(() => STEPS.map((s) => this.i18n.t(`ws.cstatus.${s}`)));
  protected readonly stepIndex = computed(() => Math.max(0, STEPS.indexOf((this.data()?.container.status ?? 'IN_TRANSIT') as (typeof STEPS)[number])));
  protected readonly subtitle = computed(() => {
    const c = this.data()?.container;
    if (!c) return '';
    return [this.date(c.createdAt), c.origin, c.vessel, c.billOfLading ? `B/L ${c.billOfLading}` : null].filter(Boolean).join(' · ');
  });
  protected readonly gradedKg = computed(() => (this.data()?.grades ?? []).reduce((s, g) => s + Number(g.kg), 0));
  protected readonly purchaseText = computed(() => {
    const c = this.data();
    if (!c?.cost) return '—';
    if (c.container.purchaseCurrency === 'PKR') return this.i18n.money(c.cost.purchase);
    return `${c.container.purchaseCurrency} ${this.i18n.num(c.cost.purchase)} × ${this.i18n.num(c.container.fxRate)} = ${this.i18n.money(c.cost.purchasePKR)}`;
  });

  private readonly money = (key: string, label: string, total = false): WsColumn => ({ key, label: this.i18n.t(label), format: 'money', total });
  protected readonly chargeColumns = computed<WsColumn[]>(() => [
    { key: 'type', label: this.i18n.t('ws.col.type') },
    { key: 'description', label: this.i18n.t('ws.container.description') },
    this.money('amount', 'ws.sale.amount', true),
  ]);
  protected readonly chargeRows = computed<WsRow[]>(() => (this.data()?.cost?.charges ?? []).map((c) => ({ ...c, type: this.i18n.t(`receive.charge.${c.type}`), description: c.description === c.type ? null : c.description })));
  protected readonly categoryColumns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('ws.container.category') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
    ...(this.data()?.cost ? [this.money('cost', 'ws.col.cost', true)] : []),
  ]);
  protected readonly categoryRows = computed<WsRow[]>(() => (this.data()?.sorting.categories ?? []).map((c) => ({ id: c.name, ...c })));
  protected readonly gradeColumns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('ws.container.grade') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
  ]);
  protected readonly gradeRows = computed<WsRow[]>(() => (this.data()?.grades ?? []).map((g) => ({ id: g.name, ...g })));
  protected readonly lotColumns = computed<WsColumn[]>(() => [
    { key: 'code', label: this.i18n.t('ws.container.lot') },
    { key: 'status', label: this.i18n.t('ws.col.status') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
    ...(this.data()?.cost ? [this.money('cost', 'ws.col.cost', true)] : []),
  ]);
  protected readonly lotRows = computed<WsRow[]>(() => (this.data()?.lots ?? []).map((l) => ({ ...l, status: this.i18n.t(`ws.lotStatus.${l.status}`) })));
  protected readonly baleColumns = computed<WsColumn[]>(() => [
    { key: 'code', label: this.i18n.t('ws.container.bale') },
    { key: 'category', label: this.i18n.t('ws.container.category') },
    { key: 'grade', label: this.i18n.t('ws.container.grade') },
    { key: 'kg', label: this.i18n.t('ws.containers.col.kg'), format: 'kg', total: true },
    { key: 'state', label: this.i18n.t('ws.col.status') },
    ...(this.data()?.cost ? [this.money('costFromHere', 'ws.container.costFromHere', true)] : []),
  ]);
  protected readonly baleRows = computed<WsRow[]>(() =>
    (this.data()?.bales ?? []).map((b) => ({ ...b, state: this.i18n.t(b.sold ? 'ws.container.sold' : 'ws.container.inStock') })),
  );
  protected readonly saleColumns = computed<WsColumn[]>(() => [
    { key: 'number', label: this.i18n.t('ws.col.number') },
    { key: 'date', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'customer', label: this.i18n.t('ws.col.customer') },
    this.money('revenue', 'ws.container.share', true),
    ...(this.data()?.cost ? [this.money('profit', 'ws.col.profit', true)] : []),
  ]);
  protected readonly saleRows = computed<WsRow[]>(() => (this.data()?.sales ?? []) as unknown as WsRow[]);

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) =>
          this.http.get<ContainerOverview>(`/api/workspace/containers/${id}`).pipe(
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
    // A smart button (?tab=) wins over the tab picked earlier.
    toObservable(this.tabParam).pipe(takeUntilDestroyed()).subscribe((t) => {
      if (t !== this.lastParam()) this.chosenTab.set(null);
      this.lastParam.set(t);
    });
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }

  protected pct(v: number | null): string {
    return v === null ? '—' : `${this.i18n.num(v, 0)}%`;
  }

  private date(v: string): string {
    return new Date(v).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  protected openBale(row: WsRow): void {
    const itemId = row['itemId'];
    if (itemId) void this.router.navigate(['/stock/items', itemId]);
  }

  protected openSale(row: WsRow): void {
    void this.router.navigate(['/sell/records', row.id]);
  }
}
