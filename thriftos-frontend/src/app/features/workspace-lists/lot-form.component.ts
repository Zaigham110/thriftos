import { HttpClient } from '@angular/common/http';
import { Component, HostListener, computed, inject, input, OnInit, signal } from '@angular/core';
import { NavService } from '../../core/nav/nav.service';
import { HasUnsavedChanges, warnBeforeUnload } from '../../core/nav/unsaved-changes.guard';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { COUNTRIES } from '../../shared/countries';
import { ToastService } from '../../shared/floor/toast.service';
import { PAYMENT_METHODS } from './lists';
import { WsInfoComponent, WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

interface Option { id: string; name: string; originCountry?: string | null; country?: string | null; rawType?: string }
/** GET /api/procurement/rags/:id (the fields this form uses). */
interface LotRow {
  id: string; ragCode: string; status: string; containerId: string | null; vendorId: string | null; rawCategoryId: string | null;
  weightKg: string; purchaseCost: string | null; ratePerKg: string | null; pieces?: number | null; ratePerPiece?: string | null; notes: string | null; createdAt: string;
  charges?: { kind: ChargeKind; amount: string; note: string | null }[];
}
type ChargeKind = 'TRANSPORT' | 'LABOUR' | 'LOADING' | 'OTHER';
interface Charge { kind: ChargeKind; amount: number | null; note: string }
const CHARGE_KINDS: ChargeKind[] = ['TRANSPORT', 'LABOUR', 'LOADING', 'OTHER'];
/** What can be attached to a lot (the server checks the same: photos, PDF, Excel, Word; 10 MB each). */
const DOC_TYPES = 'image/*,application/pdf,.xlsx,.xls,.csv,.docx';

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const day = (v: string) => new Date(new Date(v).getTime() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * The laptop form to buy a loose lot (a gaari or bales bought locally, no container), and to fix one later
 * (v2 review). Supplier, what is inside, the day, kg and price (a total, or a rate per kg), extra charges
 * (transport, labour…, part of the lot's cost) and the bill or other papers; the side shows the lot's cost and cost
 * per kg and what is still missing. Saving opens the lot. Kg and raw type stay as they are once sorting has started.
 */
@Component({
  selector: 'app-lot-form',
  standalone: true,
  imports: [FormsModule, RouterLink, TPipe, WsInfoComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    @if (loadFailed()) {
      <ws-state kind="error" [heading]="'ws.sortRecord.notFound' | t" (retry)="load()" />
    } @else if (loading()) {
      <ws-state kind="loading" />
    } @else if (containerId()) {
      <ws-state kind="empty" [heading]="'ws.lf.containerLot' | t">
        <a class="ws-btn" [routerLink]="['/receive/records/containers', containerId()]" [state]="nav.trailState()">{{ 'ws.lf.openContainer' | t }}</a>
      </ws-state>
    } @else {
      <form class="page" (ngSubmit)="save()" (input)="touched = true" (change)="touched = true">
        <ws-page-header [heading]="id() ? ('ws.lf.editTitle' | t: { code: code }) : ('ws.new.gaari' | t)" [subtitle]="(id() ? 'ws.lf.editHint' : 'ws.lf.newHint') | t" />
        <div class="cols">
          <div class="main">
            <section class="card">
              <h2>{{ 'ws.cf.whatCame' | t }}</h2>
              <div class="grid">
                <label class="span2">{{ 'common.supplier' | t }} · {{ 'common.optional' | t }}
                  @if (!adding()) {
                    <span class="row">
                      <select name="vendor" [(ngModel)]="vendorId">
                        <option value="">{{ 'ws.lf.noSupplier' | t }}</option>
                        @for (s of suppliers(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                      </select>
                      <button type="button" class="ws-btn" (click)="adding.set(true)">+ {{ 'common.newSupplier' | t }}</button>
                    </span>
                  }
                </label>
                @if (adding()) {
                  <div class="span2 new-supplier">
                    <label>{{ 'receive.newSupplierName' | t }}<input name="newSupplier" maxlength="120" [(ngModel)]="newSupplier" autocomplete="off" /></label>
                    <label>{{ 'common.country' | t }}<input name="newSupplierCountry" list="ws-lf-countries" maxlength="60" [(ngModel)]="newSupplierCountry" autocomplete="off" /></label>
                    <span class="row">
                      <button type="button" class="ws-btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
                      <button type="button" class="ws-btn primary" [disabled]="!newSupplier.trim() || busy()" (click)="addSupplier()">{{ 'common.save' | t }}</button>
                    </span>
                  </div>
                }
                <label>{{ 'ws.cf.rawType' | t }}
                  <select name="raw" [(ngModel)]="rawCategoryId" [disabled]="locked()">
                    @for (r of rawTypes(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
                  </select>
                  @if (locked()) { <small>{{ 'ws.cf.rawLocked' | t }}</small> }
                </label>
                <label>
                  <span class="lbl">{{ 'ws.lf.date' | t }} <ws-info [title]="'ws.lf.date' | t" [text]="'ws.lf.dateInfo' | t" /></span>
                  <input name="date" type="date" required [max]="maxDay" [(ngModel)]="date" />
                </label>
              </div>
            </section>

            <section class="card">
              <h2>{{ 'ws.cf.weightPrice' | t }}</h2>
              <div class="grid">
                <label>{{ 'receive.lotWeight' | t }} ({{ 'unit.kgShort' | t }})@if (byPiece()) { · {{ 'common.optional' | t }} }
                  <input name="kg" type="number" min="0.01" step="0.01" [required]="!byPiece()" [ngModel]="kg()" (ngModelChange)="kg.set($event)" [disabled]="locked()" />
                  @if (byPiece() && !locked()) { <small>{{ 'ws.lf.weightOptional' | t }}</small> }
                  @if (locked()) { <small>{{ 'ws.cf.kgLocked' | t }}</small> }
                </label>
                <div class="price">
                  <span class="seg" role="radiogroup" [attr.aria-label]="'ws.lf.priceAs' | t">
                    <button type="button" role="radio" [attr.aria-checked]="!byRate() && !byPiece()" [class.on]="!byRate() && !byPiece()" (click)="priceAs('TOTAL')">{{ 'ws.lf.total' | t }}</button>
                    <button type="button" role="radio" [attr.aria-checked]="byRate()" [class.on]="byRate()" (click)="priceAs('KG')">{{ 'ws.lf.rate' | t }}</button>
                    <button type="button" role="radio" [attr.aria-checked]="byPiece()" [class.on]="byPiece()" (click)="priceAs('PIECE')">{{ 'ws.lf.ratePiece' | t }}</button>
                  </span>
                  @if (byPiece()) {
                    <label>{{ 'ws.lf.pieces' | t }}<input name="pieces" type="number" min="1" step="1" required [ngModel]="pieces()" (ngModelChange)="pieces.set($event)" /></label>
                    <label>{{ 'ws.lf.ratePerPiece' | t }}<input name="pieceRate" type="number" min="0" step="0.01" required [ngModel]="pieceRate()" (ngModelChange)="pieceRate.set($event)" /></label>
                    <small>{{ 'ws.lf.priceIs' | t: { amount: price() === null ? '—' : i18n.money(price()) } }}</small>
                  } @else if (byRate()) {
                    <label>{{ 'ws.lf.ratePerKg' | t }}<input name="rate" type="number" min="0" step="0.01" required [ngModel]="rate()" (ngModelChange)="rate.set($event)" /></label>
                    <small>{{ 'ws.lf.priceIs' | t: { amount: price() === null ? '—' : i18n.money(price()) } }}</small>
                  } @else {
                    <label>{{ 'ws.lf.pricePaid' | t }}<input name="cost" type="number" min="0" step="0.01" required [ngModel]="cost()" (ngModelChange)="cost.set($event)" /></label>
                  }
                </div>
                @if (!id() && vendorId) {
                  <!-- Supplier khata: the price is owed to the supplier; money handed over now comes off it. -->
                  <label>{{ 'ws.lf.paidNow' | t }} · {{ 'common.optional' | t }}<input name="paidNow" type="number" min="0" step="0.01" [(ngModel)]="paidNow" /><small>{{ 'ws.lf.paidNowHint' | t }}</small></label>
                  @if (paidNow) {
                    <label>{{ 'ws.expenses.paidBy' | t }}
                      <select name="paidMethod" [(ngModel)]="paidMethod">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
                    </label>
                  }
                }
                <label class="span2">{{ 'ws.customer.note' | t }} · {{ 'common.optional' | t }}<input name="notes" maxlength="500" [(ngModel)]="notes" [placeholder]="'ws.lf.noteHint' | t" /></label>
              </div>
            </section>

            <section class="card">
              <h2 class="lbl">{{ 'ws.lf.charges' | t }} <ws-info [title]="'ws.lf.charges' | t" [text]="'ws.lf.chargesInfo' | t" /></h2>
              @if (charges().length) {
                <ul class="charges">
                  @for (c of charges(); track $index; let i = $index) {
                    <li>
                      <select [name]="'kind' + i" [ngModel]="c.kind" (ngModelChange)="setCharge(i, { kind: $event })" [attr.aria-label]="'ws.lf.chargeKind' | t">
                        @for (k of chargeKinds; track k) { <option [value]="k">{{ 'ws.lf.kind.' + k | t }}</option> }
                      </select>
                      <input [name]="'amount' + i" type="number" min="0.01" step="0.01" [ngModel]="c.amount" (ngModelChange)="setCharge(i, { amount: $event })" [attr.aria-label]="'ws.lf.chargeAmount' | t" [placeholder]="'ws.lf.chargeAmount' | t" />
                      <input [name]="'note' + i" maxlength="120" [ngModel]="c.note" (ngModelChange)="setCharge(i, { note: $event })" [attr.aria-label]="'ws.customer.note' | t" [placeholder]="'ws.lf.chargeNote' | t" />
                      <button type="button" class="ws-btn" (click)="removeCharge(i)" [attr.aria-label]="'ws.lf.removeCharge' | t">×</button>
                    </li>
                  }
                </ul>
              }
              <div class="row">
                @for (k of chargeKinds; track k) { <button type="button" class="ws-btn" (click)="addCharge(k)">+ {{ 'ws.lf.kind.' + k | t }}</button> }
              </div>
            </section>

            <section class="card">
              <h2>{{ 'ws.lf.docs' | t }}</h2>
              @if (files().length) {
                <ul class="files">
                  @for (f of files(); track $index; let i = $index) {
                    <li><span>{{ f.name }}</span><small>{{ size(f.size) }}</small><button type="button" class="ws-btn" (click)="removeFile(i)" [attr.aria-label]="'ws.lf.removeDoc' | t">×</button></li>
                  }
                </ul>
              }
              <label class="ws-btn pick">+ {{ 'ws.lf.addDoc' | t }}<input type="file" multiple [accept]="docTypes" (change)="pickFiles($event)" /></label>
              <small>{{ (id() ? 'ws.lf.docsHintEdit' : 'ws.lf.docsHint') | t }}</small>
            </section>
          </div>

          <aside class="side card" aria-live="polite">
            <h2>{{ 'ws.cf.summary' | t }}</h2>
            <dl>
              <div><dt>{{ 'ws.lf.pricePaid' | t }}</dt><dd>{{ price() === null ? '—' : i18n.money(price()) }}</dd></div>
              @if (chargesTotal() > 0) { <div><dt>{{ 'ws.lf.charges' | t }}</dt><dd>{{ i18n.money(chargesTotal()) }}</dd></div> }
              <div class="total"><dt>{{ 'ws.lf.lotCost' | t }}</dt><dd>{{ lotCost() === null ? '—' : i18n.money(lotCost()) }}</dd></div>
              <div><dt>{{ 'receive.lotWeight' | t }}</dt><dd>{{ kg() ? i18n.kg(kg()) : '—' }}</dd></div>
              <div class="total big"><dt>{{ 'common.costPerKg' | t }}</dt><dd>{{ perKg() === null ? '—' : i18n.money(perKg()) }}</dd></div>
              @if (byPiece()) { <div class="total big"><dt>{{ 'ws.lf.costPerPiece' | t }}</dt><dd>{{ perPiece() === null ? '—' : i18n.money(perPiece()) }}</dd></div> }
            </dl>
            @if (missing().length) {
              <div class="missing" role="status"><strong>{{ 'ws.cf.missing' | t }}</strong><ul>@for (m of missing(); track m) { <li>{{ m | t }}</li> }</ul></div>
            }
            <button type="submit" class="ws-btn primary block" [disabled]="missing().length > 0 || busy()">{{ (busy() ? 'common.saving' : (id() ? 'common.save' : 'receive.saveLot')) | t }}</button>
            <button type="button" class="ws-btn block" (click)="cancel()">{{ 'common.cancel' | t }}</button>
          </aside>
        </div>
        <datalist id="ws-lf-countries">@for (c of countries; track c) { <option [value]="c"></option> }</datalist>
      </form>
    }
  `,
  styles: [`
    :host { display:block; font-family:var(--ws-font); color:var(--ws-ink); }
    .page { max-width:1000px; margin-inline:auto; }
    .cols { display:grid; grid-template-columns:minmax(0, 1fr) 280px; gap:var(--ws-5); align-items:start; }
    .main { display:grid; gap:var(--ws-4); min-width:0; }
    .card { padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    h2 { margin:0 0 var(--ws-3); font-size:var(--ws-text-md); font-weight:600; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:var(--ws-3); }
    .span2 { grid-column:1 / -1; }
    label { display:grid; gap:4px; align-content:start; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .lbl { display:inline-flex; align-items:center; gap:6px; }
    input, select { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-size:var(--ws-text-md); }
    input:disabled, select:disabled { background:var(--ws-surface-2); color:var(--ws-ink-2); }
    small { color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
    .row { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .row select { flex:1 1 220px; width:auto; }
    .new-supplier { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)) auto; gap:var(--ws-3); align-items:end; padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
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
    .price { display:grid; gap:var(--ws-2); align-content:start; }
    .seg { display:inline-flex; width:max-content; padding:2px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
    .seg button { padding:4px var(--ws-3); border:0; border-radius:var(--ws-r-sm, 6px); background:transparent; color:var(--ws-ink-2); font:inherit; font-size:var(--ws-text-sm); cursor:pointer; }
    .seg button.on { background:var(--ws-surface); color:var(--ws-brand); font-weight:600; box-shadow:var(--ws-shadow-1); }
    .charges, .files { list-style:none; margin:0 0 var(--ws-3); padding:0; display:grid; gap:var(--ws-2); }
    .charges li { display:grid; grid-template-columns:160px 140px minmax(0, 1fr) auto; gap:var(--ws-2); align-items:center; }
    .files li { display:flex; align-items:center; gap:var(--ws-2); font-size:var(--ws-text-sm); }
    .files li span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pick { position:relative; display:inline-flex; width:max-content; cursor:pointer; }
    .pick input { position:absolute; inset:0; opacity:0; cursor:pointer; }
    @media (max-width: 640px) { .charges li { grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); } }
    .block { justify-content:center; width:100%; }
    @media (max-width: 1023px) { .cols { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
    @media (max-width: 640px) { .grid, .new-supplier { grid-template-columns:minmax(0, 1fr); } }
  `],
})
export class LotFormComponent implements OnInit, HasUnsavedChanges {
  protected readonly nav = inject(NavService);
  /** Something was typed or picked and not saved yet (leaving asks first). */
  protected touched = false;
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  /** Absent on "Buy a loose lot"; the lot's id on its edit page. */
  readonly id = input<string | undefined>();

  protected readonly countries = COUNTRIES;
  protected readonly maxDay = today();
  protected readonly suppliers = signal<Option[]>([]);
  protected readonly rawTypes = signal<Option[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  protected readonly locked = signal(false);
  protected readonly containerId = signal<string | null>(null);
  protected readonly kg = signal<number | null>(null);
  protected readonly cost = signal<number | null>(null);
  /** Price typed as a rate per kg (the price is kg × rate). */
  protected readonly byRate = signal(false);
  protected readonly rate = signal<number | null>(null);
  /** Bought by the piece (bedsheets, blankets…): the price is pieces × rate per piece. */
  protected readonly byPiece = signal(false);
  protected readonly pieces = signal<number | null>(null);
  protected readonly pieceRate = signal<number | null>(null);
  protected readonly charges = signal<Charge[]>([]);
  protected readonly files = signal<File[]>([]);
  protected readonly chargeKinds = CHARGE_KINDS;
  protected readonly docTypes = DOC_TYPES;

  protected code = '';
  protected vendorId = '';
  /** Supplier khata: money handed to the supplier on the spot (new lots only). */
  protected paidNow: number | null = null;
  protected paidMethod: string = 'CASH';
  protected readonly methods = PAYMENT_METHODS;
  protected rawCategoryId = '';
  protected date = today();
  protected notes = '';
  protected newSupplier = '';
  protected newSupplierCountry = '';

  /** The price paid: typed, or kg × rate (to the paisa, as the server works it out). */
  protected readonly price = computed(() => {
    if (this.byPiece()) {
      const n = Number(this.pieces()), rate = this.pieceRate();
      return n > 0 && Number.isInteger(n) && rate !== null && rate !== undefined && `${rate}` !== '' ? Math.round(n * Number(rate) * 100) / 100 : null;
    }
    if (this.byRate()) {
      const kg = Number(this.kg()), rate = this.rate();
      return kg > 0 && rate !== null && rate !== undefined && `${rate}` !== '' ? Math.round(kg * Number(rate) * 100) / 100 : null;
    }
    const c = this.cost();
    return c === null || c === undefined || `${c}` === '' ? null : Number(c);
  });
  protected readonly chargesTotal = computed(() => this.charges().reduce((s, c) => s + (Number(c.amount) > 0 ? Number(c.amount) : 0), 0));
  protected readonly lotCost = computed(() => (this.price() === null ? null : Math.round((this.price()! + this.chargesTotal()) * 100) / 100));
  protected readonly perKg = computed(() => {
    const kg = Number(this.kg());
    const cost = this.lotCost();
    return kg > 0 && cost !== null ? Math.round((cost / kg) * 100) / 100 : null;
  });
  protected readonly perPiece = computed(() => {
    const n = Number(this.pieces());
    const cost = this.lotCost();
    return this.byPiece() && n > 0 && cost !== null ? Math.round((cost / n) * 100) / 100 : null;
  });
  protected priceAs(how: 'TOTAL' | 'KG' | 'PIECE'): void {
    this.byRate.set(how === 'KG');
    this.byPiece.set(how === 'PIECE');
  }
  protected readonly missing = computed(() => {
    const m: string[] = [];
    // Bought by the piece: the weight may be left out (the lot is then counted in pieces only).
    if ((!this.kg() || Number(this.kg()) <= 0) && !this.byPiece()) m.push('ws.lf.needKg');
    if (this.byPiece() && !(Number(this.pieces()) >= 1 && Number.isInteger(Number(this.pieces())))) m.push('ws.lf.needPieces');
    else if (this.price() === null || this.price()! < 0) m.push(this.byPiece() ? 'ws.lf.needPieceRate' : this.byRate() ? 'ws.lf.needRate' : 'ws.lf.needPrice');
    if (this.charges().some((c) => !(Number(c.amount) > 0))) m.push('ws.lf.needChargeAmount');
    return m;
  });

  protected addCharge(kind: ChargeKind): void {
    this.charges.update((l) => [...l, { kind, amount: null, note: '' }]);
    this.touched = true;
  }
  protected setCharge(i: number, change: Partial<Charge>): void {
    this.charges.update((l) => l.map((c, j) => (j === i ? { ...c, ...change } : c)));
    this.touched = true;
  }
  protected removeCharge(i: number): void {
    this.charges.update((l) => l.filter((_, j) => j !== i));
    this.touched = true;
  }
  protected pickFiles(e: Event): void {
    const input = e.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    const tooBig = picked.filter((f) => f.size > 10 * 1024 * 1024);
    if (tooBig.length) this.toast.error(this.i18n.t('ws.lf.docTooBig', { name: tooBig[0].name }));
    this.files.update((l) => [...l, ...picked.filter((f) => f.size <= 10 * 1024 * 1024)].slice(0, 5));
    input.value = '';
    this.touched = true;
  }
  protected removeFile(i: number): void {
    this.files.update((l) => l.filter((_, j) => j !== i));
  }
  protected size(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  /** Papers go up after the lot is saved; one that fails does not undo the lot. */
  private async upload(id: string): Promise<void> {
    let failed = 0;
    for (const f of this.files()) {
      const form = new FormData();
      form.append('file', f);
      try { await firstValueFrom(this.http.post(`/api/records/lot/${id}/attachments`, form)); } catch { failed++; }
    }
    if (failed) this.toast.error(this.i18n.t('ws.lf.docFailed', { n: failed }));
    this.files.set([]);
  }

  ngOnInit(): void {
    // "Buy a loose lot" from a supplier's page arrives with ?supplier= already chosen.
    const from = this.route.snapshot.queryParamMap.get('supplier');
    this.http.get<Option[]>('/api/procurement/vendors').subscribe({
      next: (l) => {
        this.suppliers.set(l ?? []);
        if (from && !this.id() && (l ?? []).some((s) => s.id === from)) this.vendorId = from;
      },
    });
    this.http.get<Option[]>('/api/tenant/raw-categories').subscribe({
      next: (l) => {
        this.rawTypes.set(l ?? []);
        if (!this.id() && !this.rawCategoryId) this.rawCategoryId = (l ?? []).find((r) => r.rawType === 'BALE')?.id ?? l?.[0]?.id ?? '';
      },
    });
    if (this.id()) this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.http.get<LotRow>(`/api/procurement/rags/${this.id()}`).subscribe({
      next: (r) => {
        this.code = r.ragCode;
        this.nav.setName(r.id, r.ragCode);
        this.containerId.set(r.containerId);
        this.vendorId = r.vendorId ?? '';
        this.rawCategoryId = r.rawCategoryId ?? '';
        this.date = day(r.createdAt);
        this.kg.set(Number(r.weightKg));
        this.cost.set(r.purchaseCost === null ? null : Number(r.purchaseCost));
        this.byRate.set(r.ratePerKg !== null && r.ratePerKg !== undefined);
        this.rate.set(r.ratePerKg === null || r.ratePerKg === undefined ? null : Number(r.ratePerKg));
        this.byPiece.set(r.ratePerPiece !== null && r.ratePerPiece !== undefined);
        this.pieceRate.set(r.ratePerPiece === null || r.ratePerPiece === undefined ? null : Number(r.ratePerPiece));
        this.pieces.set(r.pieces ?? null);
        this.charges.set((r.charges ?? []).map((c) => ({ kind: c.kind, amount: Number(c.amount), note: c.note ?? '' })));
        this.notes = r.notes ?? '';
        this.locked.set(r.status !== 'NOT_STARTED');
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.loadFailed.set(true); },
    });
  }

  hasUnsavedChanges(): boolean {
    return this.touched;
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.touched);
  }
  protected cancel(): void {
    this.touched = false;
    this.nav.back(this.id() ? ['/sort/records', this.id()] : ['/receive/records/lots']);
  }

  protected async addSupplier(): Promise<void> {
    this.busy.set(true);
    const country = this.newSupplierCountry.trim();
    try {
      const s = await firstValueFrom(this.http.post<Option>('/api/procurement/vendors', { name: this.newSupplier.trim(), ...(country ? { originCountry: country, country } : {}) }));
      this.suppliers.update((l) => [s, ...l]);
      this.vendorId = s.id;
      this.adding.set(false);
      this.newSupplier = '';
      this.newSupplierCountry = '';
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.missing().length || this.busy()) return;
    const body = {
      ...(this.vendorId ? { vendorId: this.vendorId } : {}),
      ...(this.byPiece()
        ? { pieces: Number(this.pieces()), ratePerPiece: Number(this.pieceRate()) }
        : this.byRate()
          ? { ratePerKg: Number(this.rate()) }
          : { purchaseCost: Number(this.cost()) }),
      charges: this.charges().map((c) => ({ kind: c.kind, amount: Number(c.amount), ...(c.note.trim() ? { note: c.note.trim() } : {}) })),
      receivedAt: this.date,
      notes: this.notes.trim(),
      ...(this.locked() ? {} : { ...(Number(this.kg()) > 0 ? { weightKg: Number(this.kg()) } : {}), ...(this.rawCategoryId ? { rawCategoryId: this.rawCategoryId } : {}) }),
    };
    this.busy.set(true);
    try {
      let id = this.id();
      if (id) {
        await firstValueFrom(this.http.patch(`/api/procurement/rags/${id}`, body));
        await this.upload(id);
        this.toast.show(this.i18n.t('ws.lf.saved'));
        this.touched = false;
        this.nav.back(['/sort/records', id]);
        return;
      } else {
        const r = await firstValueFrom(this.http.post<{ id: string; ragCode: string }>('/api/procurement/rags', { ragBaleType: 'BALE', ...body, notes: body.notes || undefined, ...(this.vendorId && Number(this.paidNow) > 0 ? { paidNow: Number(this.paidNow), paidMethod: this.paidMethod } : {}) }));
        id = r.id;
        await this.upload(r.id);
        this.toast.show(this.i18n.t('receive.lotSaved', { code: r.ragCode }));
      }
      this.touched = false;
      void this.nav.replace(['/sort/records', id]);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
