import { HttpClient } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Pencil, Plus } from 'lucide-angular';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { TenantService } from '../../core/tenant/tenant.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { CONTAINER_CHARGES } from './container-form.component';
import {
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsInfoComponent,
  WsRow,
  WsSideSheetComponent,
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
    purchaseCurrency: string; fxRate: string; kantaKg: string | null;
    shipping: {
      referenceNumber: string | null; containerType: string | null; billOfLading: string | null; shippingLine: string | null; vessel: string | null;
      forwarder: string | null; portOfLoading: string | null; portOfDischarge: string | null; etd: string | null; eta: string | null;
    };
  };
  cost: { purchase: string; purchasePKR: string; charges: { id: string; type: string; description: string | null; amount: string }[]; chargesTotal: string; landed: string; perKg: string } | null;
  lots: { id: string; code: string; kg: string; status: string; rawType: string | null; cost: Money }[];
  sorting: { categories: { name: string; kg: string; cost: Money }[]; sortedKg: string; wasteKg: string; yieldPercent: number | null };
  grades: { name: string; kg: string }[];
  topGradePercent: number | null;
  bales: { id: string; itemId: string | null; code: string; category: string | null; grade: string | null; kg: string; sold: boolean; costFromHere: Money; totalCost: Money }[];
  sales: { id: string; number: string; date: string; customer: string; revenue: string; profit: Money }[];
  totals: { kg: string; bales: number; balesSold: number; revenue: string; profit: Money; profitPerKg: Money };
}

const STEPS = ['IN_TRANSIT', 'ARRIVED', 'CLEARED', 'CLOSED'] as const;
/** Moves the server allows from each status (closing is final). */
const MOVES: Record<string, string[]> = { IN_TRANSIT: ['ARRIVED'], ARRIVED: ['CLEARED', 'IN_TRANSIT'], CLEARED: ['CLOSED', 'ARRIVED'], CLOSED: [] };
interface RawType { id: string; name: string; rawType?: string }

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
    WsInfoComponent,
    WsSideSheetComponent,
    FormsModule,
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
            @if (can('container.update') && !closed()) {
              <ng-container actions>
              <a class="ws-btn" [routerLink]="['/receive/records/containers', d.container.id, 'edit']" [state]="nav.trailState()"><lucide-icon [img]="icons.Pencil" [size]="16" aria-hidden="true" />{{ 'ws.container.edit' | t }}</a>
              @if (d.cost) { <button type="button" class="ws-btn" (click)="openCharge(null)"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.container.addCharge' | t }}</button> }
              </ng-container>
            }
            @if (can('rag.create') && !closed()) {
              <button actions type="button" class="ws-btn" (click)="openLot()"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.container.addLot' | t }}</button>
            }
          </ws-page-header>

          <ws-status-pipeline [steps]="steps()" [current]="stepIndex()" [label]="'ws.col.status' | t" [allowed]="moves()" [moveLabel]="'ws.cr.moveTo' | t" (pick)="askMove($event)" />

          <ol class="story" [attr.aria-label]="'ws.container.trace' | t">
            @if (d.cost) {
              <li>
                <span class="lbl">{{ 'ws.containers.col.landedCost' | t }} <ws-info [title]="'ws.containers.col.landedCost' | t" [text]="'ws.containers.info.landedCost' | t" /></span>
                <a [routerLink]="[]" [queryParams]="{ tab: 'cost' }"><strong>{{ rs(d.cost.landed) }}</strong><small>{{ 'ws.container.flow.costPerKg' | t: { amount: i18n.money(d.cost.perKg) } }}</small></a>
              </li>
            }
            <li>
              <span class="lbl">{{ 'ws.containers.col.kg' | t }} <ws-info [title]="'ws.containers.col.kg' | t" [text]="'ws.cr.info.kg' | t" /></span>
              <a [routerLink]="[]" [queryParams]="{ tab: 'sorting' }"><strong>{{ i18n.kg(d.container.netWeight) }}</strong><small>{{ 'ws.cr.lotsKg' | t: { n: i18n.num(d.lots.length), kg: i18n.kg(d.totals.kg) } }}</small></a>
            </li>
            <li>
              <span class="lbl">{{ 'ws.containers.col.yield' | t }} <ws-info [title]="'ws.containers.col.yield' | t" [text]="'ws.containers.info.yield' | t" /></span>
              <a [routerLink]="[]" [queryParams]="{ tab: 'sorting' }"><strong>{{ pct(d.sorting.yieldPercent) }}</strong><small>{{ 'ws.cr.sortedLine' | t: { a: pct(d.topGradePercent), waste: i18n.kg(d.sorting.wasteKg) } }}</small></a>
            </li>
            <li>
              <span class="lbl">{{ 'ws.container.flow.bales' | t }} <ws-info [title]="'ws.container.flow.bales' | t" [text]="'ws.cr.info.bales' | t" /></span>
              <a [routerLink]="[]" [queryParams]="{ tab: 'bales' }"><strong>{{ i18n.num(d.totals.bales) }}</strong><small>{{ 'ws.container.flow.sold' | t: { n: i18n.num(d.totals.balesSold) } }}</small></a>
            </li>
            <li>
              <span class="lbl">{{ 'ws.containers.col.revenue' | t }} <ws-info [title]="'ws.containers.col.revenue' | t" [text]="'ws.containers.info.revenue' | t" /></span>
              <a [routerLink]="[]" [queryParams]="{ tab: 'sales' }"><strong>{{ rs(d.totals.revenue) }}</strong><small>{{ 'ws.cr.salesCount' | t: { n: i18n.num(d.sales.length) } }}</small></a>
            </li>
            @if (d.totals.profit !== null) {
              <li>
                <span class="lbl">{{ 'ws.containers.col.profit' | t }} <ws-info [title]="'ws.containers.col.profit' | t" [text]="'ws.cr.info.profit' | t" /></span>
                <a [routerLink]="[]" [queryParams]="{ tab: 'sales' }"><strong [class]="profitTone()">{{ rs(d.totals.profit) }}</strong>
                  @if (d.totals.profitPerKg !== null) { <small>{{ 'ws.cr.perKgBought' | t: { amount: i18n.money(d.totals.profitPerKg) } }}</small> }</a>
              </li>
            }
          </ol>

          @if (shippingFacts().length) {
            <details class="ship">
              <summary>{{ 'common.more' | t }}</summary>
              <dl class="facts">@for (f of shippingFacts(); track f.label) { <div><dt>{{ f.label | t }}</dt><dd>{{ f.value }}</dd></div> }</dl>
            </details>
          }

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="pickTab($event)" [label]="d.container.number" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()" class="panel">
            @switch (tab()) {
              @case ('cost') {
                <dl class="facts">
                  <div><dt>{{ 'ws.container.purchase' | t }}</dt><dd>{{ purchaseText() }}</dd></div>
                  <div><dt>{{ 'ws.container.charges' | t }}</dt><dd>{{ i18n.money(d.cost?.chargesTotal) }}</dd></div>
                  <div><dt>{{ 'ws.containers.col.landedCost' | t }}</dt><dd><strong>{{ i18n.money(d.cost?.landed) }}</strong></dd></div>
                  <div><dt>{{ 'ws.containers.col.costPerKg' | t }}</dt><dd>{{ i18n.money(d.cost?.perKg) }}</dd></div>
                </dl>
                <ws-data-grid [caption]="'ws.container.charges' | t" [columns]="chargeColumns()" [rows]="chargeRows()" [clickable]="canCharge()" (rowClick)="openCharge($event)" [emptyHeading]="'ws.container.noCharges' | t" />
                @if (canCharge() && chargeRows().length) { <p class="hint">{{ 'ws.cr.chargeHint' | t }}</p> }
              }
              @case ('sorting') {
                <div class="two">
                  <ws-data-grid [caption]="'ws.container.categories' | t" [columns]="categoryColumns()" [rows]="categoryRows()" [emptyHeading]="'ws.container.notSorted' | t" />
                  <ws-data-grid [caption]="'ws.container.grades' | t" [columns]="gradeColumns()" [rows]="gradeRows()" [emptyHeading]="'ws.container.notGraded' | t" />
                </div>
                <ws-data-grid [caption]="'ws.container.lots' | t" [columns]="lotColumns()" [rows]="lotRows()" [clickable]="true" (rowClick)="openLotRecord($event)" [emptyHeading]="'ws.container.noLots' | t" />
              }
              @case ('bales') {
                <ws-data-grid [caption]="'ws.container.bales' | t" [columns]="baleColumns()" [rows]="baleRows()" [clickable]="stockOn()" (rowClick)="openBale($event)" [emptyHeading]="'ws.container.noBales' | t" />
              }
              @case ('sales') {
                <ws-data-grid [caption]="'ws.container.sales' | t" [columns]="saleColumns()" [rows]="saleRows()" [clickable]="true" (rowClick)="openSale($event)" [emptyHeading]="'ws.container.noSales' | t" />
              }
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="container" [recordId]="d.container.id" /></aside>
      </div>

      <ws-side-sheet [open]="sheet() === 'charge'" [heading]="(chargeId ? 'ws.cr.editCharge' : 'ws.container.addCharge') | t" (close)="sheet.set(null)">
        <form class="sheet-form" id="ws-charge-form" (ngSubmit)="saveCharge()">
          <label>{{ 'ws.cf.chargeType' | t }}
            <select name="ctype" [(ngModel)]="chargeType">@for (t of chargeTypes; track t) { <option [value]="t">{{ 'receive.charge.' + t | t }}</option> }</select>
          </label>
          <label>{{ 'ws.sale.amount' | t }}<input name="camount" type="number" min="0" step="0.01" required [(ngModel)]="chargeAmount" /></label>
          <label>{{ 'ws.customer.note' | t }} · {{ 'common.optional' | t }}<input name="cnote" maxlength="200" [(ngModel)]="chargeNote" /></label>
        </form>
        <ng-container footer>
          @if (chargeId) { <button type="button" class="ws-btn danger" [disabled]="busy()" (click)="removeCharge()">{{ 'common.remove' | t }}</button> }
          <button type="button" class="ws-btn" (click)="sheet.set(null)">{{ 'common.cancel' | t }}</button>
          <button type="submit" form="ws-charge-form" class="ws-btn primary" [disabled]="busy() || chargeAmount === null || chargeAmount < 0">{{ 'common.save' | t }}</button>
        </ng-container>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'lot'" [heading]="'ws.container.addLot' | t" (close)="sheet.set(null)">
        <form class="sheet-form" id="ws-lot-form" (ngSubmit)="saveLot()">
          <p class="hint">{{ 'ws.cr.lotHint' | t: { kg: i18n.kg(roomKg()) } }}</p>
          <label>{{ 'ws.cf.rawType' | t }}
            <select name="lraw" [(ngModel)]="lotRaw">@for (r of rawTypes(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }</select>
          </label>
          <label>{{ 'receive.lotWeight' | t }} ({{ 'unit.kgShort' | t }})<input name="lkg" type="number" min="0.01" step="0.01" required [(ngModel)]="lotKg" /></label>
        </form>
        <ng-container footer>
          <button type="button" class="ws-btn" (click)="sheet.set(null)">{{ 'common.cancel' | t }}</button>
          <button type="submit" form="ws-lot-form" class="ws-btn primary" [disabled]="busy() || !lotKg || lotKg <= 0">{{ 'receive.saveLot' | t }}</button>
        </ng-container>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'status'" [heading]="'ws.cr.moveTitle' | t: { status: ('ws.cstatus.' + moveTarget() | t) }" (close)="sheet.set(null)">
        <p class="sheet-text">{{ (moveTarget() === 'CLOSED' ? 'ws.cr.closeText' : 'ws.cr.moveText') | t: { no: d.container.number, status: ('ws.cstatus.' + moveTarget() | t) } }}</p>
        <ng-container footer>
          <button type="button" class="ws-btn" (click)="sheet.set(null)">{{ 'common.cancel' | t }}</button>
          <button type="button" class="ws-btn primary" [disabled]="busy()" (click)="move()">{{ 'ws.cr.moveTitle' | t: { status: ('ws.cstatus.' + moveTarget() | t) } }}</button>
        </ng-container>
      </ws-side-sheet>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .story { list-style:none; margin:0; padding:0; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0, 1fr); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .story li { position:relative; display:grid; align-content:start; gap:4px; padding:var(--ws-3) var(--ws-4); min-width:0; }
    .story li + li { border-inline-start:1px solid var(--ws-line); }
    .story li + li::before { content:''; position:absolute; inset-inline-start:-7px; top:50%; width:12px; height:12px; margin-top:-6px; border-block-start:1px solid var(--ws-line); border-inline-end:1px solid var(--ws-line); background:var(--ws-surface); transform:rotate(45deg); }
    :host-context([dir=rtl]) .story li + li::before { transform:rotate(-135deg); }
    .story .lbl { display:inline-flex; align-items:center; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .story a { display:grid; gap:2px; color:inherit; text-decoration:none; border-radius:var(--ws-r-sm, 4px); }
    .story a:hover strong { color:var(--ws-brand); }
    .story a:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:2px; }
    .story strong { font-size:var(--ws-text-lg); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
    .story strong.good { color:var(--ws-good); }
    .story strong.bad { color:var(--ws-bad); }
    .story small { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .ship { padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .ship summary { cursor:pointer; font-weight:600; font-size:var(--ws-text-sm); }
    .ship .facts { margin-block-start:var(--ws-3); padding:0; border:0; }
    .hint { margin:0; color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
    .sheet-form { display:grid; gap:var(--ws-3); }
    .sheet-form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .sheet-form input, .sheet-form select { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .sheet-text { margin:0; line-height:1.5; }
    .ws-btn.danger { margin-inline-end:auto; border-color:var(--ws-bad); color:var(--ws-bad); }
    .panel { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:var(--ws-4); }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--ws-3); margin:0; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .facts dt { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .facts dd { margin:2px 0 0; font-variant-numeric:tabular-nums; }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } .story { grid-auto-flow:row; } .story li + li { border-inline-start:0; border-block-start:1px solid var(--ws-line); } .story li + li::before { display:none; } }
  `],
})
export class ContainerRecordComponent {
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
    if (d && id) this.nav.setName(id, d.container.number);
  });
  /** ?tab= from a smart button. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { Pencil, Plus };
  protected readonly chargeTypes = CONTAINER_CHARGES;
  protected readonly sheet = signal<'charge' | 'lot' | 'status' | null>(null);
  protected readonly busy = signal(false);
  protected readonly moveTarget = signal('');
  protected readonly rawTypes = signal<RawType[]>([]);
  protected chargeId: string | null = null;
  protected chargeType: string = 'DUTY';
  protected chargeAmount: number | null = null;
  protected chargeNote = '';
  protected lotRaw = '';
  protected lotKg: number | null = null;
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
      { id: 'sorting', label: this.i18n.t('ws.container.tab.sorting'), count: d.lots.length },
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
    return [this.date(c.createdAt), c.origin].filter(Boolean).join(' · ');
  });
  protected readonly profitTone = computed(() => (Number(this.data()?.totals.profit ?? 0) < 0 ? 'bad' : 'good'));
  private readonly tenants = inject(TenantService);
  /** Bales open their stock page only when this business uses Stock. */
  protected readonly stockOn = computed(() => this.tenants.isModuleEnabled('STOCK', this.tenants.tenant()));
  protected readonly closed = computed(() => this.data()?.container.status === 'CLOSED');
  protected readonly canCharge = computed(() => !!this.data()?.cost && !this.closed() && this.can('container.update'));
  /** Status steps the owner can move to from here (a button each on the bar). */
  protected readonly moves = computed(() => {
    const s = this.data()?.container.status;
    if (!s || !this.can('container.update')) return [];
    return (MOVES[s] ?? []).map((m) => STEPS.indexOf(m as (typeof STEPS)[number]));
  });
  /** Kg of the container not yet in a lot (a new lot fits in this). */
  protected readonly roomKg = computed(() => {
    const d = this.data();
    return d ? Math.max(0, Number(d.container.netWeight) - Number(d.totals.kg)) : 0;
  });
  protected readonly shippingFacts = computed(() => {
    const c = this.data()?.container;
    if (!c) return [];
    const sh = c.shipping;
    const f: { label: string; value: string }[] = [
      { label: 'receive.weighbridgeKg', value: c.kantaKg ? this.i18n.kg(c.kantaKg) : '' },
      { label: 'ws.cf.reference', value: sh.referenceNumber ?? '' },
      { label: 'ws.cf.containerType', value: sh.containerType ?? '' },
      { label: 'ws.cf.bl', value: sh.billOfLading ?? '' },
      { label: 'ws.cf.shippingLine', value: sh.shippingLine ?? '' },
      { label: 'ws.cf.vessel', value: sh.vessel ?? '' },
      { label: 'ws.cf.forwarder', value: sh.forwarder ?? '' },
      { label: 'ws.cf.portLoading', value: sh.portOfLoading ?? '' },
      { label: 'ws.cf.portDischarge', value: sh.portOfDischarge ?? '' },
      { label: 'ws.cf.etd', value: sh.etd ? this.date(sh.etd) : '' },
      { label: 'ws.cf.eta', value: sh.eta ? this.date(sh.eta) : '' },
      { label: 'ws.customer.note', value: c.notes ?? '' },
    ];
    return f.filter((x) => x.value);
  });
  protected readonly gradedKg = computed(() => (this.data()?.grades ?? []).reduce((s, g) => s + Number(g.kg), 0));
  protected readonly purchaseText = computed(() => {
    const c = this.data();
    if (!c?.cost) return '—';
    if (c.container.purchaseCurrency === 'PKR') return this.i18n.money(c.cost.purchase);
    return `${c.container.purchaseCurrency} ${this.i18n.num(c.cost.purchase)} × ${this.i18n.num(c.container.fxRate)} = ${this.i18n.money(c.cost.purchasePKR)}`;
  });

  /** Money columns show whole rupees (per-kg prices keep paisa). */
  private readonly money = (key: string, label: string, total = false, info?: string): WsColumn => ({ key, label: this.i18n.t(label), format: 'money', total, round: true, ...(info ? { info: this.i18n.t(info) } : {}) });
  protected readonly chargeColumns = computed<WsColumn[]>(() => [
    { key: 'type', label: this.i18n.t('ws.col.type') },
    ...(this.chargeRows().some((c) => c['description']) ? [{ key: 'description', label: this.i18n.t('ws.customer.note') }] : []),
    { key: 'amount', label: this.i18n.t('ws.sale.amount'), format: 'money', total: true },
  ]);
  protected readonly chargeRows = computed<WsRow[]>(() => (this.data()?.cost?.charges ?? []).map((c) => ({ ...c, chargeType: c.type, type: this.i18n.t(`receive.charge.${c.type}`), description: c.description === c.type ? null : c.description })));
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
    { key: 'rawType', label: this.i18n.t('ws.lots.col.raw') },
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
    ...(this.data()?.cost ? [this.money('costFromHere', 'ws.cr.baleCost', true, 'ws.cr.info.baleCost')] : []),
  ]);
  protected readonly baleRows = computed<WsRow[]>(() =>
    (this.data()?.bales ?? []).map((b) => ({ ...b, state: this.i18n.t(b.sold ? 'ws.container.sold' : 'ws.container.inStock') })),
  );
  protected readonly saleColumns = computed<WsColumn[]>(() => [
    { key: 'number', label: this.i18n.t('ws.col.number') },
    { key: 'date', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'customer', label: this.i18n.t('ws.col.customer') },
    this.money('revenue', 'ws.cr.fromHere', true, 'ws.cr.info.fromHere'),
    ...(this.data()?.cost ? [this.money('profit', 'ws.col.profit', true, 'ws.cr.info.saleProfit')] : []),
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
    if (itemId) void this.nav.open(['/stock/items', itemId]);
  }

  protected openSale(row: WsRow): void {
    void this.nav.open(['/sell/records', row.id]);
  }

  protected openLotRecord(row: WsRow): void {
    void this.nav.open(['/sort/records', row.id]);
  }

  /** Whole rupees for totals on the page (per-kg prices keep paisa through i18n.money). */
  protected rs(v: string | number | null | undefined): string {
    return v === null || v === undefined || v === '' ? '—' : this.i18n.money(Math.round(Number(v)));
  }

  protected openCharge(row: WsRow | null): void {
    if (row && !this.canCharge()) return;
    this.chargeId = row ? String(row.id) : null;
    this.chargeType = row ? String(row['chargeType']) : 'DUTY';
    this.chargeAmount = row ? Number(row['amount']) : null;
    this.chargeNote = row ? String(row['description'] ?? '') : '';
    this.sheet.set('charge');
  }

  protected async saveCharge(): Promise<void> {
    const id = this.data()?.container.id;
    if (!id || this.chargeAmount === null || this.chargeAmount < 0) return;
    const body = { chargeType: this.chargeType, amount: Number(this.chargeAmount), description: this.chargeNote.trim() };
    await this.run(
      this.chargeId
        ? this.http.patch(`/api/procurement/containers/${id}/charges/${this.chargeId}`, body)
        : this.http.post(`/api/procurement/containers/${id}/charges`, { ...body, description: body.description || undefined }),
      'ws.cr.chargeSaved',
    );
  }

  protected async removeCharge(): Promise<void> {
    const id = this.data()?.container.id;
    if (!id || !this.chargeId) return;
    await this.run(this.http.delete(`/api/procurement/containers/${id}/charges/${this.chargeId}`), 'ws.cr.chargeRemoved');
  }

  protected openLot(): void {
    if (!this.rawTypes().length) {
      this.http.get<RawType[]>('/api/tenant/raw-categories').subscribe((l) => {
        this.rawTypes.set(l ?? []);
        this.lotRaw ||= (l ?? []).find((r) => r.rawType === 'BALE')?.id ?? l?.[0]?.id ?? '';
      });
    }
    this.lotKg = this.roomKg() > 0 ? Math.round(this.roomKg() * 100) / 100 : null;
    this.sheet.set('lot');
  }

  protected async saveLot(): Promise<void> {
    const id = this.data()?.container.id;
    if (!id || !this.lotKg || this.lotKg <= 0) return;
    await this.run(
      this.http.post('/api/procurement/rags', { containerId: id, ragBaleType: 'BALE', weightKg: Number(this.lotKg), ...(this.lotRaw ? { rawCategoryId: this.lotRaw } : {}) }),
      'ws.cr.lotSaved',
    );
  }

  protected askMove(i: number): void {
    this.moveTarget.set(STEPS[i]);
    this.sheet.set('status');
  }

  protected async move(): Promise<void> {
    const id = this.data()?.container.id;
    if (!id || !this.moveTarget()) return;
    await this.run(this.http.patch(`/api/procurement/containers/${id}/status`, { status: this.moveTarget() }), 'ws.cr.moved');
  }

  /** Send one change, then close the panel, say so and reload the page's numbers. */
  private async run(request: import('rxjs').Observable<unknown>, done: string): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(request);
      this.sheet.set(null);
      this.toast.show(this.i18n.t(done));
      this.reload();
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
