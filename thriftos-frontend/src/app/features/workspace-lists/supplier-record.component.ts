import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Banknote, LucideAngularModule, Pencil, Plus } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { NavService } from '../../core/nav/nav.service';
import { ToastService } from '../../shared/floor/toast.service';
import { PAYMENT_METHODS } from './lists';
import {
  WsColumn,
  WsDataGridComponent,
  WsInfoComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsStateComponent,
  WsTab,
  WsTabsComponent,
} from '../../shared/ui/workspace';
import { withTones } from '../../shared/ui/workspace/status-tone';

type Money = string | null;
/** GET /api/workspace/suppliers/:id — what was bought from a supplier and how it did (money is null without cost.view). */
export interface SupplierScorecard {
  supplier: {
    id: string; name: string; originCountry: string | null; country: string | null; contactPerson: string | null; contactPhone: string | null;
    contactEmail: string | null; physicalAddress: string | null; notes: string | null; isActive: boolean;
  };
  /** Supplier khata: what is owed (null without cost.view) and the payments made. */
  khata: { opening: string; bought: string; paid: string; owed: string } | null;
  payments: { id: string; day: string; amount: string; method: string; note: string | null; cancelled: boolean }[];
  totals: { containers: number; lots: number; kg: string; landed: Money; revenue: string; profit: Money; profitPerKg: Money; yieldPercent: number | null; topGradePercent: number | null };
  containers: { id: string; number: string; date: string; status: string; origin: string | null; kg: string; landedCost: Money; costPerKg: Money; revenue: string; profit: Money; yield: number | null; topGrade: number | null }[];
  lots: { id: string; code: string; date: string; status: string; rawType: string | null; kg: string; cost: Money; costPerKg: Money; revenue: string; profit: Money; sortedPercent: number | null }[];
}

/**
 * A supplier's page (v2 review): who they are and how to reach them, everything bought from them — containers
 * and loose lots — in one row of numbers that reads in order, and buttons to buy from them again.
 */
@Component({
  selector: 'app-supplier-record',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, TPipe, WsDataGridComponent, WsInfoComponent, WsPageHeaderComponent, WsRecordActivityComponent, WsStateComponent, WsTabsComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.supplier.notFound' | t" (retry)="reload()" />
    } @else if (data(); as d) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="d.supplier.name" [subtitle]="subtitle()">
            @if (phone(); as ph) { <a actions class="ws-btn" [href]="'tel:' + ph">{{ 'ws.sp.call' | t }}</a> }
            @if (whatsapp(); as wa) { <a actions class="ws-btn" [href]="'https://wa.me/' + wa" target="_blank" rel="noopener">{{ 'ws.sp.whatsapp' | t }}</a> }
            @if (d.khata && can('expense.create')) {
              <button actions type="button" class="ws-btn primary" (click)="startPay()"><lucide-icon [img]="icons.Banknote" [size]="16" aria-hidden="true" />{{ 'ws.sp.pay' | t }}</button>
            }
            @if (can('vendor.update')) {
              <a actions class="ws-btn" [routerLink]="['/receive/records/suppliers', d.supplier.id, 'edit']" [state]="nav.trailState()"><lucide-icon [img]="icons.Pencil" [size]="16" aria-hidden="true" />{{ 'ws.container.edit' | t }}</a>
            }
            @if (can('container.create')) {
              <a actions class="ws-btn" [routerLink]="['/receive/records/containers/new']" [queryParams]="{ supplier: d.supplier.id }" [state]="nav.trailState()"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.new.container' | t }}</a>
            }
            @if (can('rag.create')) {
              <a actions class="ws-btn" [routerLink]="['/receive/records/lots/new']" [queryParams]="{ supplier: d.supplier.id }" [state]="nav.trailState()"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'ws.new.gaari' | t }}</a>
            }
          </ws-page-header>
          @if (d.supplier.notes) { <p class="note">{{ d.supplier.notes }}</p> }

          @if (paying()) {
            <form class="pay" (ngSubmit)="pay()">
              <label>{{ 'ws.sp.payAmount' | t }}<input name="amount" type="number" min="1" step="0.01" required [(ngModel)]="payAmount" /></label>
              <label>{{ 'common.date' | t }}<input name="day" type="date" required [max]="today" [(ngModel)]="payDay" /></label>
              <label>{{ 'ws.expenses.paidBy' | t }}
                <select name="method" [(ngModel)]="payMethod">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
              </label>
              <label class="wide">{{ 'ws.customer.note' | t }} · {{ 'common.optional' | t }}<input name="note" maxlength="300" [(ngModel)]="payNote" /></label>
              <div class="pay-actions">
                <button type="button" class="ws-btn" (click)="paying.set(false)">{{ 'common.cancel' | t }}</button>
                <button type="submit" class="ws-btn primary" [disabled]="!(payAmount! > 0) || !payDay || busy()">{{ (busy() ? 'common.saving' : 'common.save') | t }}</button>
              </div>
            </form>
          }

          <ol class="story" [attr.aria-label]="'ws.sp.story' | t">
            <li>
              <span class="lbl">{{ 'ws.suppliers.col.kg' | t }} <ws-info [title]="'ws.suppliers.col.kg' | t" [text]="'ws.sp.info.kg' | t" /></span>
              <strong>{{ i18n.kg(d.totals.kg) }}</strong><small>{{ 'ws.sp.bought' | t: { c: i18n.num(d.totals.containers), l: i18n.num(d.totals.lots) } }}</small>
            </li>
            @if (d.totals.landed !== null) {
              <li>
                <span class="lbl">{{ 'ws.containers.col.landedCost' | t }} <ws-info [title]="'ws.containers.col.landedCost' | t" [text]="'ws.sp.info.cost' | t" /></span>
                <strong>{{ rs(d.totals.landed) }}</strong>
              </li>
            }
            @if (d.khata; as k) {
              <li>
                <span class="lbl">{{ (owes() ? 'ws.sp.owe' : +k.owed < 0 ? 'ws.sp.paidAhead' : 'ws.sp.owe') | t }} <ws-info [title]="'ws.sp.owe' | t" [text]="'ws.sp.oweInfo' | t" /></span>
                <strong [class.bad]="owes()">{{ rs(+k.owed < 0 ? -k.owed : k.owed) }}</strong>
                <small>{{ 'ws.sp.oweLine' | t: { bought: rs(+k.bought + +k.opening), paid: rs(k.paid) } }}</small>
              </li>
            }
            <li>
              <span class="lbl">{{ 'ws.containers.col.yield' | t }} <ws-info [title]="'ws.containers.col.yield' | t" [text]="'ws.sp.info.sorted' | t" /></span>
              <strong>{{ pct(d.totals.yieldPercent) }}</strong><small>{{ 'ws.containers.col.topGrade' | t }} {{ pct(d.totals.topGradePercent) }}</small>
            </li>
            <li>
              <span class="lbl">{{ 'ws.containers.col.revenue' | t }} <ws-info [title]="'ws.containers.col.revenue' | t" [text]="'ws.sp.info.sold' | t" /></span>
              <strong>{{ bought() ? rs(d.totals.revenue) : '—' }}</strong>
            </li>
            @if (d.totals.profit !== null) {
              <li>
                <span class="lbl">{{ 'ws.containers.col.profit' | t }} <ws-info [title]="'ws.containers.col.profit' | t" [text]="'ws.sp.info.profit' | t" /></span>
                <strong [class]="bought() ? profitTone() : ''">{{ bought() ? rs(d.totals.profit) : '—' }}</strong>
                @if (bought() && d.totals.profitPerKg !== null) { <small>{{ 'ws.cr.perKgBought' | t: { amount: i18n.money(d.totals.profitPerKg) } }}</small> }
              </li>
            }
          </ol>

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="pickTab($event)" [label]="d.supplier.name" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()">
            @if (tab() === 'payments') {
              @if (d.payments.length) {
                <table class="pays">
                  <thead><tr><th>{{ 'common.date' | t }}</th><th class="num">{{ 'ws.sp.payAmount' | t }}</th><th>{{ 'ws.expenses.paidBy' | t }}</th><th>{{ 'ws.customer.note' | t }}</th><th></th></tr></thead>
                  <tbody>
                    @for (p of d.payments; track p.id) {
                      <tr [class.off]="p.cancelled">
                        <td>{{ day(p.day) }}</td><td class="num">{{ i18n.money(p.amount) }}</td><td>{{ 'method.' + p.method | t }}</td><td>{{ p.note ?? '—' }}</td>
                        <td class="end">
                          @if (p.cancelled) { <span class="ws-status" data-tone="muted">{{ 'ws.sp.payCancelled' | t }}</span> }
                          @else if (can('expense.create') && can('finance.view')) { <button type="button" class="ws-btn" [disabled]="busy()" (click)="cancelPay(p.id, p.amount)">{{ 'ws.sp.payCancel' | t }}</button> }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else { <ws-state kind="empty" [heading]="'ws.sp.noPayments' | t" /> }
            } @else if (tab() === 'lots') {
              <ws-data-grid [caption]="'ws.purchasing.lots' | t" [columns]="lotColumns()" [rows]="lotRows()" [clickable]="true" (rowClick)="openLot($event)" [emptyHeading]="'ws.sp.noLots' | t" />
            } @else {
              <ws-data-grid [caption]="'ws.containers.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" (rowClick)="open($event)" [emptyHeading]="'ws.supplier.noContainers' | t" />
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="supplier" [recordId]="d.supplier.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .note { margin:calc(-1 * var(--ws-3)) 0 0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .story { list-style:none; margin:0; padding:0; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0, 1fr); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .story li { display:grid; align-content:start; gap:4px; padding:var(--ws-3) var(--ws-4); min-width:0; }
    .story li + li { border-inline-start:1px solid var(--ws-line); }
    .story .lbl { display:inline-flex; align-items:center; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .story strong { font-size:var(--ws-text-lg); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
    .story strong.good { color:var(--ws-good); }
    .story strong.bad { color:var(--ws-bad); }
    .pay { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .pay label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .pay .wide { grid-column:1 / -1; }
    .pay input, .pay select { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .pay-actions { grid-column:1 / -1; display:flex; justify-content:flex-end; gap:var(--ws-2); }
    .pays { width:100%; border-collapse:collapse; border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); font-size:var(--ws-text-sm); }
    .pays th { text-align:start; padding:var(--ws-2) var(--ws-3); color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; border-block-end:1px solid var(--ws-line); }
    .pays td { padding:var(--ws-2) var(--ws-3); border-block-end:1px solid var(--ws-line); }
    .pays .num { text-align:end; font-variant-numeric:tabular-nums; }
    .pays .end { text-align:end; }
    .pays tr.off td:not(.end) { color:var(--ws-ink-2); text-decoration:line-through; }
    @media (max-width: 640px) { .pay { grid-template-columns:minmax(0, 1fr); } }
    .story small { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } .story { grid-auto-flow:row; } .story li + li { border-inline-start:0; border-block-start:1px solid var(--ws-line); } }
  `],
})
export class SupplierRecordComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly nav = inject(NavService);
  /** Route parameter (component input binding). */
  readonly id = input.required<string>();
  /** ?tab= (containers or lots), kept in the address so Back opens the same tab. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { Banknote, Pencil, Plus };
  private readonly toast = inject(ToastService);
  protected readonly methods = PAYMENT_METHODS;
  /** Today in Pakistan (UTC+5), as yyyy-mm-dd. */
  protected readonly today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
  // Pay supplier (supplier khata): a small form under the header.
  protected readonly paying = signal(false);
  protected readonly busy = signal(false);
  protected payAmount: number | null = null;
  protected payDay = this.today;
  protected payMethod: string = 'CASH';
  protected payNote = '';
  private payKey = crypto.randomUUID();
  protected readonly owes = computed(() => Number(this.data()?.khata?.owed ?? 0) > 0);
  protected readonly data = signal<SupplierScorecard | null>(null);
  protected readonly failed = signal(false);
  private readonly reloads = signal(0);

  /** The breadcrumb and browser tab name this supplier once loaded. */
  private readonly crumbName = effect(() => {
    const d = this.data();
    if (d) this.nav.setName(this.id(), d.supplier.name);
  });

  protected readonly tabs = computed<WsTab[]>(() => {
    const d = this.data();
    return d
      ? [
          { id: 'containers', label: this.i18n.t('ws.purchasing.containers'), count: d.containers.length },
          { id: 'lots', label: this.i18n.t('ws.purchasing.lots'), count: d.lots.length },
          ...(d.khata ? [{ id: 'payments', label: this.i18n.t('ws.sp.payments'), count: d.payments.filter((p) => !p.cancelled).length }] : []),
        ]
      : [];
  });
  /** Opens on loose lots when the supplier sold you only loose lots. */
  protected readonly tab = computed(() => {
    const want = this.tabParam();
    if (want === 'lots' || want === 'containers' || want === 'payments') return want;
    const d = this.data();
    return d && !d.containers.length && d.lots.length ? 'lots' : 'containers';
  });
  /** Nothing bought yet: sold and profit read "—", not Rs 0. */
  protected readonly bought = computed(() => (this.data()?.totals.containers ?? 0) + (this.data()?.totals.lots ?? 0) > 0);
  /** The saved number with its country code (digits and a leading +), for the Call and WhatsApp buttons. */
  protected readonly phone = computed(() => {
    const raw = (this.data()?.supplier.contactPhone ?? '').replace(/[^\d+]/g, '');
    return raw.replace(/\D/g, '').length >= 7 ? raw : null;
  });
  /** WhatsApp needs the country code: a number saved the local way (0300 1234567) is a Pakistan mobile. */
  protected readonly whatsapp = computed(() => {
    const digits = (this.phone() ?? '').replace(/\D/g, '');
    if (!digits) return null;
    return /^03\d{9}$/.test(digits) ? `92${digits.slice(1)}` : digits.replace(/^00/, '');
  });
  protected readonly profitTone = computed(() => (Number(this.data()?.totals.profit ?? 0) < 0 ? 'bad' : 'good'));

  /** Country · city · WhatsApp · contact person · email (no internal codes). */
  protected readonly subtitle = computed(() => {
    const s = this.data()?.supplier;
    if (!s) return '';
    return [s.originCountry ?? s.country, s.physicalAddress, s.contactPhone, s.contactPerson, s.contactEmail, s.isActive ? null : this.i18n.t('ws.sp.inactive')].filter(Boolean).join(' · ');
  });

  private readonly money = (key: string, label: string, exact = false): WsColumn => ({ key, label: this.i18n.t(label), format: 'money', total: !exact, round: !exact });
  protected readonly columns = computed<WsColumn[]>(() => {
    const cost = this.data()?.totals.profit !== null;
    const t = (k: string) => this.i18n.t(k);
    return [
      { key: 'number', label: t('ws.containers.col.number') },
      { key: 'date', label: t('ws.containers.col.date'), format: 'date' },
      { key: 'status', label: t('ws.col.status') },
      { key: 'kg', label: t('ws.containers.col.kg'), format: 'kg', total: true },
      ...(cost ? [this.money('landedCost', 'ws.containers.col.landedCost'), this.money('costPerKg', 'ws.containers.col.costPerKg', true)] : []),
      this.money('revenue', 'ws.containers.col.revenue'),
      ...(cost ? [this.money('profit', 'ws.containers.col.profit')] : []),
      { key: 'yield', label: t('ws.containers.col.yield'), format: 'percent' },
      { key: 'topGrade', label: t('ws.containers.col.topGrade'), format: 'percent' },
    ];
  });
  protected readonly rows = computed<WsRow[]>(() =>
    (this.data()?.containers ?? []).map((c) => withTones({ ...c, status: this.i18n.t(`ws.cstatus.${c.status}`) }, { status: c.status })) as unknown as WsRow[],
  );
  protected readonly lotColumns = computed<WsColumn[]>(() => {
    const cost = this.data()?.totals.landed !== null;
    const t = (k: string) => this.i18n.t(k);
    return [
      { key: 'code', label: t('ws.container.lot') },
      { key: 'date', label: t('ws.purchaseLots.col.date'), format: 'date' },
      { key: 'status', label: t('ws.col.status') },
      { key: 'kg', label: t('ws.containers.col.kg'), format: 'kg', total: true },
      ...(cost ? [this.money('cost', 'ws.purchaseLots.col.cost'), this.money('costPerKg', 'ws.purchaseLots.col.costPerKg', true)] : []),
      // Profit per lot; raw type and "Sold so far" are on the lot's own page, so the table fits a laptop beside the activity panel.
      ...(cost ? [this.money('profit', 'ws.containers.col.profit')] : []),
      { key: 'sortedPercent', label: t('ws.purchaseLots.col.sorted'), format: 'percent' },
    ];
  });
  protected readonly lotRows = computed<WsRow[]>(() =>
    (this.data()?.lots ?? []).map((l) => withTones({ ...l, status: this.i18n.t(`ws.lotStatus.${l.status}`) }, { status: l.status })) as unknown as WsRow[],
  );

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) =>
          this.http.get<SupplierScorecard>(`/api/workspace/suppliers/${id}`).pipe(
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
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }

  protected pct(v: number | null): string {
    return v === null ? '—' : `${this.i18n.num(v, 0)}%`;
  }

  /** Whole rupees for totals (per-kg prices keep paisa). */
  protected rs(v: string | number | null | undefined): string {
    return v === null || v === undefined || v === '' ? '—' : this.i18n.money(Math.round(Number(v)));
  }

  protected day(v: string): string {
    return new Date(`${v}T00:00:00`).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
  }

  /** Opens the payment form with what is owed already typed in. */
  protected startPay(): void {
    const owed = Number(this.data()?.khata?.owed ?? 0);
    this.payAmount = owed > 0 ? owed : null;
    this.payDay = this.today;
    this.payNote = '';
    this.paying.set(true);
  }

  protected pay(): void {
    if (!(Number(this.payAmount) > 0) || this.busy()) return;
    this.busy.set(true);
    const body = { amount: Number(this.payAmount), day: this.payDay, method: this.payMethod, ...(this.payNote.trim() ? { note: this.payNote.trim() } : {}) };
    this.http.post(`/api/workspace/suppliers/${this.id()}/payments`, body, { headers: new HttpHeaders({ 'Idempotency-Key': this.payKey }) }).subscribe({
      next: () => {
        this.payKey = crypto.randomUUID();
        this.busy.set(false);
        this.paying.set(false);
        this.toast.show(this.i18n.t('ws.sp.paySaved'));
        this.pickTab('payments');
        this.reload();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.toast.error(e.error?.code === 'CASH_CLOSED' ? this.i18n.t('ws.expenses.err.CASH_CLOSED') : e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }

  protected cancelPay(paymentId: string, amount: string): void {
    if (!confirm(this.i18n.t('ws.sp.payCancelAsk', { amount: this.i18n.money(amount) }))) return;
    this.busy.set(true);
    this.http.post(`/api/workspace/suppliers/${this.id()}/payments/${paymentId}/cancel`, {}).subscribe({
      next: () => { this.busy.set(false); this.reload(); },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.toast.error(e.error?.code === 'CASH_CLOSED' ? this.i18n.t('ws.expenses.err.CASH_CLOSED') : e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }

  protected pickTab(tab: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  protected open(row: WsRow): void {
    void this.nav.open(['/receive/records/containers', row.id]);
  }

  protected openLot(row: WsRow): void {
    void this.nav.open(['/sort/records', row.id]);
  }
}
