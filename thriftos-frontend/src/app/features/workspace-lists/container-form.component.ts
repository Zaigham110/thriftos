import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { COUNTRIES } from '../../shared/countries';
import { ToastService } from '../../shared/floor/toast.service';
import { WsInfoComponent, WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

/** Charge types offered when receiving (CIF is old data only: the price is the purchase cost now). */
export const CONTAINER_CHARGES = ['DUTY', 'TAX', 'CLEARING', 'PORT_HANDLING', 'FREIGHT', 'TRANSPORT', 'LABOUR', 'MISC'] as const;
const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP'];
const CONTAINER_TYPES = ['20ft', '40ft', '40HC', '45HC'];

interface Option { id: string; name: string; originCountry?: string | null; country?: string | null; rawType?: string }
interface ChargeLine { type: string; amount: number | null }
/** GET /api/procurement/containers/:id (the fields this form uses). */
interface ContainerRow {
  id: string; containerNumber: string; status: string; vendorId: string | null; originCountry: string | null; createdAt: string; arrivedAt: string | null;
  netWeight: string; weighbridgeNetWeight: string | null; purchaseCost: string; purchaseCurrency: string; fxRate: string;
  referenceNumber: string | null; containerType: string | null; billOfLadingNumber: string | null; shippingLine: string | null; vesselName: string | null;
  portOfLoading: string | null; portOfDischarge: string | null; forwarder: string | null; etd: string | null; eta: string | null; notes: string | null;
  containerCharges: { amount: string }[]; rags: { status: string; rawCategoryId: string | null }[];
}

/** Today in Pakistan (UTC+5), as yyyy-mm-dd. */
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const day = (v: string | null) => (v ? new Date(new Date(v).getTime() + 5 * 3_600_000).toISOString().slice(0, 10) : '');
const num = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * The laptop form to receive a container, and to edit one (v2 review). One page: supplier and what is inside,
 * when it came, kg and price, charges; the shipping papers fold away. A summary on the side shows the cost per kg
 * as you type and says what is still missing. Saving opens the container.
 */
@Component({
  selector: 'app-container-form',
  standalone: true,
  imports: [FormsModule, RouterLink, TPipe, WsInfoComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    @if (loadFailed()) {
      <ws-state kind="error" [heading]="'ws.container.notFound' | t" (retry)="load()" />
    } @else if (loading()) {
      <ws-state kind="loading" />
    } @else {
      <form class="page" (ngSubmit)="save()">
        <ws-page-header [heading]="id() ? ('ws.cf.editTitle' | t: { no: number }) : ('ws.new.container' | t)" [subtitle]="(id() ? 'ws.cf.editHint' : 'ws.cf.newHint') | t" />
        @if (closed()) { <p class="banner" role="status">{{ 'ws.cf.closed' | t }}</p> }

        <div class="cols">
          <div class="main">
            <section class="card">
              <h2>{{ 'ws.cf.whatCame' | t }}</h2>
              <div class="grid">
                <label class="span2">{{ 'common.supplier' | t }}
                  @if (!adding()) {
                    <span class="row">
                      <select name="vendor" [(ngModel)]="vendorId" (ngModelChange)="pickSupplier($event)" required>
                        <option value="" disabled>{{ 'ws.cf.pickSupplier' | t }}</option>
                        @for (s of suppliers(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                      </select>
                      <button type="button" class="ws-btn" (click)="adding.set(true)">+ {{ 'common.newSupplier' | t }}</button>
                    </span>
                  }
                </label>
                @if (adding()) {
                  <div class="span2 new-supplier">
                    <label>{{ 'receive.newSupplierName' | t }}<input name="newSupplier" maxlength="120" [(ngModel)]="newSupplier" autocomplete="off" /></label>
                    <label>{{ 'common.country' | t }}<input name="newSupplierCountry" list="ws-cf-countries" maxlength="60" [(ngModel)]="newSupplierCountry" autocomplete="off" /></label>
                    <span class="row">
                      <button type="button" class="ws-btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
                      <button type="button" class="ws-btn primary" [disabled]="!newSupplier.trim() || busy()" (click)="addSupplier()">{{ 'common.save' | t }}</button>
                    </span>
                  </div>
                }
                <label>{{ 'receive.origin' | t }}<input name="origin" list="ws-cf-countries" maxlength="60" [(ngModel)]="origin" autocomplete="off" [placeholder]="'ws.cf.countryHint' | t" /></label>
                <label>{{ 'ws.cf.rawType' | t }}
                  <select name="raw" [(ngModel)]="rawCategoryId" [disabled]="rawLocked()">
                    @if (!rawTypes().length) { <option value="">{{ 'ws.cf.rawDefault' | t }}</option> }
                    @for (r of rawTypes(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
                  </select>
                  @if (rawLocked()) { <small>{{ 'ws.cf.rawLocked' | t }}</small> }
                </label>
              </div>
            </section>

            <section class="card">
              <h2>{{ 'ws.cf.when' | t }}</h2>
              <div class="grid">
                <fieldset class="span2">
                  <legend>{{ 'ws.col.status' | t }}</legend>
                  @if (statusEditable()) {
                    <span class="seg" role="radiogroup">
                      @for (s of statuses; track s) {
                        <label class="opt" [class.on]="status === s"><input type="radio" name="status" [value]="s" [(ngModel)]="status" />{{ 'ws.cstatus.' + s | t }}</label>
                      }
                    </span>
                  } @else {
                    <p class="static">{{ 'ws.cstatus.' + status | t }}</p>
                  }
                </fieldset>
                <label>
                  <span class="lbl">{{ 'ws.cf.date' | t }} <ws-info [title]="'ws.cf.date' | t" [text]="'ws.cf.dateInfo' | t" /></span>
                  <input name="date" type="date" required [max]="maxDay" [(ngModel)]="date" />
                </label>
                <label>{{ 'receive.containerNo' | t }}
                  @if (id()) { <input name="number" [value]="number" disabled /> }
                  @else { <input name="number" maxlength="50" [(ngModel)]="number" autocomplete="off" class="ltr" [placeholder]="'ws.cf.numberHint' | t" /> }
                </label>
              </div>
            </section>

            <section class="card">
              <h2>{{ 'ws.cf.weightPrice' | t }}</h2>
              <div class="grid">
                <label>{{ 'receive.invoiceKg' | t }} ({{ 'unit.kgShort' | t }})
                  <input name="kg" type="number" min="1" step="0.01" required [(ngModel)]="kg" [disabled]="kgLocked()" />
                  @if (kgLocked()) { <small>{{ 'ws.cf.kgLocked' | t }}</small> }
                </label>
                @if (!id()) {
                  <label>
                    <span class="lbl">{{ 'receive.weighbridgeKg' | t }} ({{ 'unit.kgShort' | t }}) · {{ 'common.optional' | t }} <ws-info [title]="'receive.weighbridgeKg' | t" [text]="'ws.cf.kantaInfo' | t" /></span>
                    <input name="kanta" type="number" min="0" step="0.01" [(ngModel)]="kanta" />
                  </label>
                }
                <label>{{ 'receive.currency' | t }}
                  <select name="currency" [(ngModel)]="currency">@for (c of currencies; track c) { <option [value]="c">{{ c }}</option> }</select>
                </label>
                <label>{{ 'receive.purchaseCost' | t }} ({{ currency }})<input name="cost" type="number" min="0" step="0.01" required [(ngModel)]="cost" /></label>
                @if (currency !== 'PKR') {
                  <label>{{ 'ws.cf.rate' | t: { cur: currency } }}<input name="rate" type="number" min="0" step="0.0001" required [(ngModel)]="rate" /></label>
                }
              </div>
            </section>

            <section class="card">
              <h2>{{ 'receive.charges' | t }}</h2>
              @if (id()) {
                <p class="hint">{{ 'ws.cf.chargesOnRecord' | t }} <a [routerLink]="['/receive/records/containers', id()]" [queryParams]="{ tab: 'cost' }">{{ 'ws.container.tab.cost' | t }}</a></p>
              } @else {
                @for (c of charges; track $index; let i = $index) {
                  <div class="charge">
                    <select [name]="'ct' + i" [(ngModel)]="c.type" [attr.aria-label]="'ws.cf.chargeType' | t">
                      @for (t of chargeTypes; track t) { <option [value]="t">{{ 'receive.charge.' + t | t }}</option> }
                    </select>
                    <input [name]="'ca' + i" type="number" min="0" step="0.01" [(ngModel)]="c.amount" [attr.aria-label]="'ws.sale.amount' | t" placeholder="Rs" />
                    <button type="button" class="ws-btn" (click)="removeCharge(i)" [attr.aria-label]="'common.remove' | t">×</button>
                  </div>
                }
                <span class="row"><button type="button" class="ws-btn" (click)="addCharge()">+ {{ 'ws.container.addCharge' | t }}</button><small>{{ 'ws.cf.chargesHint' | t }}</small></span>
              }
            </section>

            <details class="card" [open]="shippingOpen">
              <summary>{{ 'ws.cf.shipping' | t }} <small>· {{ 'common.optional' | t }}</small></summary>
              <div class="grid">
                <label>{{ 'ws.cf.reference' | t }}<input name="ref" maxlength="100" [(ngModel)]="ship.referenceNumber" /></label>
                <label>{{ 'ws.cf.containerType' | t }}
                  <select name="ctype" [(ngModel)]="ship.containerType"><option value="">—</option>@for (t of containerTypes; track t) { <option [value]="t">{{ t }}</option> }</select>
                </label>
                <label>{{ 'ws.cf.bl' | t }}<input name="bl" maxlength="100" [(ngModel)]="ship.billOfLadingNumber" /></label>
                <label>{{ 'ws.cf.shippingLine' | t }}<input name="line" maxlength="100" [(ngModel)]="ship.shippingLine" /></label>
                <label>{{ 'ws.cf.vessel' | t }}<input name="vessel" maxlength="100" [(ngModel)]="ship.vesselName" /></label>
                <label>{{ 'ws.cf.forwarder' | t }}<input name="fwd" maxlength="100" [(ngModel)]="ship.forwarder" /></label>
                <label>{{ 'ws.cf.portLoading' | t }}<input name="pol" maxlength="100" [(ngModel)]="ship.portOfLoading" /></label>
                <label>{{ 'ws.cf.portDischarge' | t }}<input name="pod" maxlength="100" [(ngModel)]="ship.portOfDischarge" /></label>
                <label>{{ 'ws.cf.etd' | t }}<input name="etd" type="date" [(ngModel)]="ship.etd" /></label>
                <label>{{ 'ws.cf.eta' | t }}<input name="eta" type="date" [(ngModel)]="ship.eta" /></label>
                <label class="span2">{{ 'ws.customer.note' | t }}<textarea name="notes" rows="2" maxlength="1000" [(ngModel)]="ship.notes"></textarea></label>
              </div>
            </details>
          </div>

          <aside class="side card" aria-live="polite">
            <h2>{{ 'ws.cf.summary' | t }}</h2>
            <dl>
              <div><dt>{{ 'ws.cf.price' | t }}</dt><dd>{{ priceRs() === null ? '—' : i18n.money(priceRs()) }}</dd></div>
              <div><dt>{{ 'receive.charges' | t }}</dt><dd>{{ i18n.money(chargesRs()) }}</dd></div>
              <div class="total"><dt>{{ 'ws.containers.col.landedCost' | t }}</dt><dd>{{ totalRs() === null ? '—' : i18n.money(totalRs()) }}</dd></div>
              <div><dt>{{ 'ws.cf.kgUsed' | t }}</dt><dd>{{ kgUsed() ? i18n.kg(kgUsed()) : '—' }}</dd></div>
              <div class="total big"><dt>{{ 'common.costPerKg' | t }}</dt><dd>{{ perKg() === null ? '—' : i18n.money(perKg()) }}</dd></div>
            </dl>
            @if (missing().length) {
              <div class="missing" role="status">
                <strong>{{ 'ws.cf.missing' | t }}</strong>
                <ul>@for (m of missing(); track m) { <li>{{ m | t }}</li> }</ul>
              </div>
            }
            <button type="submit" class="ws-btn primary block" [disabled]="missing().length > 0 || busy() || closed()">{{ (busy() ? 'common.saving' : (id() ? 'common.save' : 'receive.saveContainer')) | t }}</button>
            <a class="ws-btn block" [routerLink]="id() ? ['/receive/records/containers', id()] : '/receive/records/containers'">{{ 'common.cancel' | t }}</a>
          </aside>
        </div>
        <datalist id="ws-cf-countries">@for (c of countries; track c) { <option [value]="c"></option> }</datalist>
      </form>
    }
  `,
  styles: [`
    :host { display:block; font-family:var(--ws-font); color:var(--ws-ink); }
    .page { max-width:1080px; margin-inline:auto; }
    .cols { display:grid; grid-template-columns:minmax(0, 1fr) 300px; gap:var(--ws-5); align-items:start; }
    .main { display:grid; gap:var(--ws-4); min-width:0; }
    .card { padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    h2 { margin:0 0 var(--ws-3); font-size:var(--ws-text-md); font-weight:600; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:var(--ws-3); }
    .span2 { grid-column:1 / -1; }
    label { display:grid; gap:4px; align-content:start; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .lbl { display:inline-flex; align-items:center; gap:6px; }
    input, select, textarea { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-size:var(--ws-text-md); }
    input:disabled, select:disabled { background:var(--ws-surface-2); color:var(--ws-ink-2); }
    small, .hint { margin:0; color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
    .row { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .row select { flex:1 1 220px; width:auto; }
    .new-supplier { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)) auto; gap:var(--ws-3); align-items:end; padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
    fieldset { margin:0; padding:0; border:0; min-width:0; }
    legend { padding:0; margin-block-end:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .seg { display:inline-flex; padding:2px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
    .opt { display:inline-flex; align-items:center; padding:6px var(--ws-4); border-radius:calc(var(--ws-r-md) - 2px); color:var(--ws-ink-2); font-size:var(--ws-text-md); cursor:pointer; }
    .opt input { position:absolute; opacity:0; width:1px; height:1px; min-height:0; pointer-events:none; }
    .opt.on { background:var(--ws-surface); color:var(--ws-ink); font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.08); }
    .opt:has(input:focus-visible) { outline:2px solid var(--ws-focus, var(--ws-brand)); }
    .static { margin:0; font-weight:600; }
    .charge { display:grid; grid-template-columns:minmax(0, 1fr) 160px auto; gap:var(--ws-2); margin-block-end:var(--ws-2); }
    details summary { cursor:pointer; font-weight:600; }
    details[open] summary { margin-block-end:var(--ws-3); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); display:grid; gap:var(--ws-3); }
    .side h2 { margin:0; }
    dl { display:grid; gap:var(--ws-2); margin:0; }
    dl div { display:flex; justify-content:space-between; gap:var(--ws-3); font-size:var(--ws-text-sm); }
    dt { color:var(--ws-ink-2); }
    dd { margin:0; font-variant-numeric:tabular-nums; }
    .total { padding-block-start:var(--ws-2); border-block-start:1px solid var(--ws-line); font-weight:600; }
    .big dd { font-size:var(--ws-text-xl); }
    .missing { padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-warn-soft, var(--ws-surface-2)); font-size:var(--ws-text-sm); }
    .missing ul { margin:4px 0 0; padding-inline-start:18px; }
    .block { justify-content:center; width:100%; }
    .banner { margin:0 0 var(--ws-4); padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-bad-soft); color:var(--ws-bad); }
    .ltr { direction:ltr; }
    @media (max-width: 1023px) { .cols { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
    @media (max-width: 640px) { .grid, .new-supplier { grid-template-columns:minmax(0, 1fr); } }
  `],
})
export class ContainerFormComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  /** Absent on the "receive" page; the container's id on its edit page. */
  readonly id = input<string | undefined>();

  protected readonly statuses = ['ARRIVED', 'IN_TRANSIT'] as const;
  protected readonly currencies = CURRENCIES;
  protected readonly chargeTypes = CONTAINER_CHARGES;
  protected readonly containerTypes = CONTAINER_TYPES;
  protected readonly countries = COUNTRIES;
  protected readonly maxDay = today();

  protected readonly suppliers = signal<Option[]>([]);
  protected readonly rawTypes = signal<Option[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  protected readonly kgLocked = signal(false);
  protected readonly rawLocked = signal(false);
  protected readonly closed = signal(false);
  protected readonly statusEditable = signal(true);
  protected shippingOpen = false;

  // The form (plain fields with ngModel; the summary reads them through `tick`).
  private readonly tick = signal(0);
  private _vendorId = '';
  private _kg: number | null = null;
  private _kanta: number | null = null;
  private _cost: number | null = null;
  private _rate: number | null = null;
  private _currency = 'PKR';
  private _charges: ChargeLine[] = [];
  protected get vendorId() { return this._vendorId; }
  protected set vendorId(v: string) { this._vendorId = v; this.tick.update((n) => n + 1); }
  protected get kg() { return this._kg; }
  protected set kg(v: number | null) { this._kg = v; this.tick.update((n) => n + 1); }
  protected get kanta() { return this._kanta; }
  protected set kanta(v: number | null) { this._kanta = v; this.tick.update((n) => n + 1); }
  protected get cost() { return this._cost; }
  protected set cost(v: number | null) { this._cost = v; this.tick.update((n) => n + 1); }
  protected get rate() { return this._rate; }
  protected set rate(v: number | null) { this._rate = v; this.tick.update((n) => n + 1); }
  protected get currency() { return this._currency; }
  protected set currency(v: string) { this._currency = v; this.tick.update((n) => n + 1); }
  /** Charge lines; each line's amount change re-runs the summary through a proxy. */
  protected get charges(): ChargeLine[] { return this._charges; }

  protected status: 'ARRIVED' | 'IN_TRANSIT' | string = 'ARRIVED';
  protected date = today();
  protected number = '';
  protected origin = '';
  protected rawCategoryId = '';
  protected newSupplier = '';
  protected newSupplierCountry = '';
  protected ship = { referenceNumber: '', containerType: '', billOfLadingNumber: '', shippingLine: '', vesselName: '', forwarder: '', portOfLoading: '', portOfDischarge: '', etd: '', eta: '', notes: '' };
  private existingChargesRs = 0;

  protected readonly priceRs = computed(() => {
    this.tick();
    if (this._cost === null || this._cost === undefined) return null;
    const rate = this._currency === 'PKR' ? 1 : this._rate;
    return rate ? Math.round(this._cost * rate * 100) / 100 : null;
  });
  protected readonly chargesRs = computed(() => {
    this.tick();
    return this.existingChargesRs + this._charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  });
  protected readonly totalRs = computed(() => (this.priceRs() === null ? null : (this.priceRs() ?? 0) + this.chargesRs()));
  protected readonly kgUsed = computed(() => {
    this.tick();
    return this._kanta && this._kanta > 0 ? this._kanta : this._kg;
  });
  protected readonly perKg = computed(() => {
    const kg = this.kgUsed();
    const total = this.totalRs();
    return kg && total !== null ? Math.round((total / kg) * 100) / 100 : null;
  });
  /** What stops saving, in plain words (Save stays off until the list is empty). */
  protected readonly missing = computed(() => {
    this.tick();
    const m: string[] = [];
    if (!this._vendorId) m.push('ws.cf.need.supplier');
    if (!this._kg || this._kg <= 0) m.push('ws.cf.need.kg');
    if (this._cost === null || this._cost === undefined || this._cost < 0) m.push('ws.cf.need.cost');
    if (this._currency !== 'PKR' && !this._rate) m.push('ws.cf.need.rate');
    if (this._kanta && this._kg && this._kanta > this._kg) m.push('ws.cf.need.kanta');
    if (this._charges.some((c) => c.amount !== null && c.amount !== undefined && Number(c.amount) < 0)) m.push('ws.cf.need.charge');
    return m;
  });

  ngOnInit(): void {
    this.http.get<Option[]>('/api/procurement/vendors').subscribe({ next: (l) => this.suppliers.set(l ?? []) });
    this.http.get<Option[]>('/api/tenant/raw-categories').subscribe({
      next: (l) => {
        this.rawTypes.set(l ?? []);
        // Like the server's default: the first bale raw type.
        if (!this.id() && !this.rawCategoryId) this.rawCategoryId = (l ?? []).find((r) => r.rawType === 'BALE')?.id ?? l?.[0]?.id ?? '';
      },
    });
    if (this.id()) this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.http.get<ContainerRow>(`/api/procurement/containers/${this.id()}`).subscribe({
      next: (c) => {
        this.number = c.containerNumber;
        this.vendorId = c.vendorId ?? '';
        this.origin = c.originCountry ?? '';
        this.status = c.status;
        this.statusEditable.set(c.status === 'IN_TRANSIT' || c.status === 'ARRIVED');
        this.closed.set(c.status === 'CLOSED');
        this.date = day(c.createdAt);
        this.kg = num(c.netWeight);
        this.kanta = num(c.weighbridgeNetWeight);
        this.currency = c.purchaseCurrency || 'PKR';
        this.cost = num(c.purchaseCost);
        this.rate = this._currency === 'PKR' ? null : num(c.fxRate);
        this.existingChargesRs = c.containerCharges.reduce((s, x) => s + Number(x.amount), 0);
        const started = c.rags.some((r) => r.status !== 'NOT_STARTED');
        this.kgLocked.set(started);
        this.rawLocked.set(!c.rags.some((r) => r.status === 'NOT_STARTED'));
        this.rawCategoryId = c.rags.find((r) => r.rawCategoryId)?.rawCategoryId ?? '';
        this.ship = {
          referenceNumber: c.referenceNumber ?? '', containerType: c.containerType ?? '', billOfLadingNumber: c.billOfLadingNumber ?? '', shippingLine: c.shippingLine ?? '',
          vesselName: c.vesselName ?? '', forwarder: c.forwarder ?? '', portOfLoading: c.portOfLoading ?? '', portOfDischarge: c.portOfDischarge ?? '',
          etd: day(c.etd), eta: day(c.eta), notes: c.notes ?? '',
        };
        this.shippingOpen = Object.values(this.ship).some(Boolean);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.loadFailed.set(true); },
    });
  }

  protected pickSupplier(id: string): void {
    const s = this.suppliers().find((x) => x.id === id);
    const from = s?.originCountry || s?.country;
    if (from && !this.origin) this.origin = from;
  }

  protected async addSupplier(): Promise<void> {
    this.busy.set(true);
    const country = this.newSupplierCountry.trim();
    try {
      const s = await firstValueFrom(this.http.post<Option>('/api/procurement/vendors', { name: this.newSupplier.trim(), ...(country ? { originCountry: country, country } : {}) }));
      this.suppliers.update((l) => [s, ...l]);
      this.vendorId = s.id;
      if (country) this.origin = country;
      this.adding.set(false);
      this.newSupplier = '';
      this.newSupplierCountry = '';
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }

  protected addCharge(): void {
    const used = new Set(this._charges.map((c) => c.type));
    const line: ChargeLine = { type: CONTAINER_CHARGES.find((t) => !used.has(t)) ?? 'MISC', amount: null };
    // Each line tells the summary when its amount changes.
    const tick = this.tick;
    let amount: number | null = null;
    Object.defineProperty(line, 'amount', { enumerable: true, get: () => amount, set: (v: number | null) => { amount = v; tick.update((n) => n + 1); } });
    this._charges.push(line);
    this.tick.update((n) => n + 1);
  }

  protected removeCharge(i: number): void {
    this._charges.splice(i, 1);
    this.tick.update((n) => n + 1);
  }

  protected async save(): Promise<void> {
    if (this.missing().length || this.busy() || this.closed()) return;
    const text = (v: string) => (v.trim() ? v.trim() : undefined);
    const ship = {
      referenceNumber: text(this.ship.referenceNumber), containerType: text(this.ship.containerType), billOfLadingNumber: text(this.ship.billOfLadingNumber),
      shippingLine: text(this.ship.shippingLine), vesselName: text(this.ship.vesselName), forwarder: text(this.ship.forwarder),
      portOfLoading: text(this.ship.portOfLoading), portOfDischarge: text(this.ship.portOfDischarge), notes: text(this.ship.notes),
      eta: this.ship.eta || undefined, etd: this.ship.etd || undefined,
    };
    const common = {
      vendorId: this._vendorId,
      originCountry: this.origin.trim() || undefined,
      purchaseCost: Number(this._cost),
      purchaseCurrency: this._currency,
      ...(this._currency !== 'PKR' ? { fxRate: Number(this._rate) } : {}),
      receivedAt: this.date,
      ...(this.rawCategoryId && !this.rawLocked() ? { rawCategoryId: this.rawCategoryId } : {}),
      ...(this.statusEditable() ? { status: this.status } : {}),
      ...ship,
    };
    this.busy.set(true);
    try {
      let id = this.id();
      if (id) {
        await firstValueFrom(this.http.patch(`/api/procurement/containers/${id}`, { ...common, ...(this.kgLocked() ? {} : { netWeightKg: Number(this._kg) }) }));
        this.toast.show(this.i18n.t('ws.cf.saved'));
      } else {
        const r = await firstValueFrom(
          this.http.post<{ id: string; containerNumber: string }>('/api/procurement/containers', {
            ...common,
            netWeightKg: Number(this._kg),
            ...(this._kanta ? { weighbridgeKg: Number(this._kanta) } : {}),
            ...(this.number.trim() ? { containerNumber: this.number.trim() } : {}),
            charges: this._charges.filter((c) => Number(c.amount) > 0).map((c) => ({ chargeType: c.type, amount: Number(c.amount) })),
            withLot: true,
          }),
        );
        id = r.id;
        this.toast.show(this.i18n.t('ws.cf.received', { no: r.containerNumber }));
      }
      void this.router.navigate(['/receive/records/containers', id]);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
