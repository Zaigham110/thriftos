import { moduleOn } from '../../core/tenant/module-on';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Component, ElementRef, HostListener, computed, inject, signal, viewChildren } from '@angular/core';
import { NavService } from '../../core/nav/nav.service';
import { HasUnsavedChanges, warnBeforeUnload } from '../../core/nav/unsaved-changes.guard';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ListResult } from '../../core/list/list-client';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsSideSheetComponent } from '../../shared/ui/workspace';
import { PAYMENT_METHODS } from './lists';

interface CustomerOption { id: string; name: string; city: string | null; phone: string | null; priceGroup?: string | null }
interface StockOption { id: string; code: string | null; name: string | null; unit: 'KG' | 'BALE' | 'PIECE'; left: string; salePrice: string | null; value?: string | null; kg?: string | null; categoryId?: string | null; gradeId?: string | null; pieces?: number | null }
/**
 * One choice in "Add item": the bales of one kind (Jeans A, 4 bales) together, or one other item (kg, pieces).
 * `members` are the bales, oldest first; a sale of 2 takes the first 2 (or the ones scanned, which go first).
 */
interface Pick { key: string; label: string; unit: StockOption['unit']; members: StockOption[] }
interface Line { item: StockOption; unit: 'KG' | 'BALE' | 'PIECE'; quantity: number; unitPrice: number | null; from: string | null; members?: StockOption[] }
type Mode = 'CASH' | 'CREDIT' | 'PARTIAL';

const optionLabel = (s: StockOption) => [s.code, s.name].filter(Boolean).join(' · ');
/** Bales of the same category and grade are one kind; anything else stands alone. */
const kindKey = (s: StockOption) => (s.unit === 'BALE' && s.categoryId ? `${s.categoryId}|${s.gradeId ?? ''}` : `item|${s.id}`);
const byCode = (a: StockOption, b: StockOption) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true });
/**
 * Stock rows as the sale screen names them: the stored name ("Jeans A"), which is what people type and what the
 * choices are matched against. Inventory writes the same item "Jeans · A".
 */
function stockRows(rows: unknown): StockOption[] {
  return (rows as Array<StockOption & { plainName?: string | null }>).map((r) => ({ ...r, name: r.plainName ?? r.name }));
}

function toPicks(rows: StockOption[]): Pick[] {
  const map = new Map<string, Pick>();
  for (const r of rows) {
    const key = kindKey(r);
    const p = map.get(key) ?? { key, label: key.startsWith('item|') ? optionLabel(r) : r.name ?? optionLabel(r), unit: r.unit, members: [] };
    p.members.push(r);
    map.set(key, p);
  }
  return [...map.values()].map((p) => ({ ...p, members: p.members.sort(byCode) }));
}
/** Pieces sold from a kind's bales: the oldest bales first, each giving what it has left. */
function piecesOver(members: StockOption[], wanted: number): { id: string; n: number }[] {
  const out: { id: string; n: number }[] = [];
  for (const m of members) {
    if (wanted <= 0) break;
    const n = Math.min(wanted, m.pieces ?? 0);
    if (n > 0) out.push({ id: m.id, n });
    wanted -= n;
  }
  return out;
}
/** The line's item for a kind: what is left and its value add up over its bales. */
function kindItem(p: Pick): StockOption {
  if (p.members.length === 1 && p.key.startsWith('item|')) return p.members[0];
  const sum = (f: (m: StockOption) => string | null | undefined) => String(p.members.reduce((t, m) => t + Number(f(m) ?? 0), 0));
  const pieces = p.members.every((m) => m.pieces) ? p.members.reduce((t, m) => t + (m.pieces ?? 0), 0) : null;
  return { ...p.members[0], id: `kind:${p.key}`, code: null, name: p.label, left: sum((m) => m.left), value: sum((m) => m.value), kg: sum((m) => m.kg), pieces };
}

/**
 * New sale on the laptop (enterprise plan E3.4), keyboard first: type the customer, then scan or type items
 * (Enter adds a line and jumps to its quantity), Tab through quantity and price, Ctrl/⌘ Enter saves. Prices are
 * suggested from the customer's price list, then their last price, then anyone's, then the item's own.
 */
@Component({
  selector: 'app-sale-entry',
  standalone: true,
  imports: [WsSideSheetComponent, FormsModule, LucideAngularModule, TPipe, WsPageHeaderComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.saleEntry.title' | t" [subtitle]="'ws.saleEntry.subtitle' | t" />
      <form class="sheet" (ngSubmit)="save()" (keydown)="keys($event)">
        <div class="row">
          <label class="grow">{{ 'ws.col.customer' | t }}
            <input #customerInput name="customer" list="ws-customers" autocomplete="off" [ngModel]="customerText()" (ngModelChange)="pickCustomer($event)" (keydown.enter)="$event.preventDefault(); pickFirst()" [placeholder]="'ws.saleEntry.customerHint' | t" autofocus />
            <datalist id="ws-customers">@for (c of customers(); track c.id) { <option [value]="c.name">{{ [c.city, c.phone].filter(isText).join(' · ') }}</option> }</datalist>
          </label>
          @if (customer(); as c) {
            <p class="chip">{{ c.priceGroup ? ('ws.saleEntry.list' | t: { group: c.priceGroup }) : ('ws.saleEntry.noList' | t) }}</p>
            @if (account(); as a) {
              <!-- What they owe and their limit, before selling more on credit (v2 review). -->
              <p class="chip" [class.warn]="overLimit()">{{ (+a.balance < 0 ? 'ws.sp2.advance' : 'ws.sp2.owes') | t: { balance: i18n.money(abs(round(a.balance))) } }}@if (a.creditLimit && +a.creditLimit > 0) { · {{ 'ws.sp2.limit' | t: { limit: i18n.money(round(a.creditLimit)) } }} }</p>
            }
          } @else {
            <button type="button" class="ws-btn" (click)="openNewCustomer()">+ {{ 'sell.newCustomer' | t }}</button>
          }
        </div>
        @if (customerMiss()) { <p class="warn-line" role="status">{{ 'ws.sp2.noMatch' | t: { text: customerText() } }}</p> }
        @if (overLimit()) { <p class="warn-line" role="alert">{{ 'ws.sp2.overLimit' | t }}</p> }

        <label>{{ 'ws.saleEntry.addItem' | t }}
          <input #itemInput name="item" list="ws-stock" autocomplete="off" [ngModel]="itemText()" (ngModelChange)="itemText.set($event)" (keydown.enter)="$event.preventDefault(); addItem()" [placeholder]="'ws.saleEntry.itemHint' | t" [disabled]="!customer()" />
          <datalist id="ws-stock">@for (p of picks(); track p.key) { <option [value]="p.label">{{ 'ws.saleEntry.left' | t: { n: qty(kindLeft(p), p.unit) } }}</option> }</datalist>
        </label>

        <table>
          <caption class="sr-only">{{ 'ws.sale.lines' | t }}</caption>
          <thead><tr><th scope="col">{{ 'ws.sale.item' | t }}</th><th scope="col">{{ 'ws.sale.unit' | t }}</th><th scope="col" class="num">{{ 'ws.sale.quantity' | t }}</th><th scope="col" class="num">{{ 'ws.sale.unitPrice' | t }}</th><th scope="col" class="num">{{ 'ws.col.total' | t }}</th><th scope="col"><span class="sr-only">{{ 'ws.saleEntry.remove' | t }}</span></th></tr></thead>
          <tbody>
            @for (l of lines(); track l.item.id; let i = $index) {
              <tr>
                <td>{{ label(l.item) }}<small>{{ 'ws.saleEntry.left' | t: { n: qty(l.item.left, l.item.unit) } }}@if (l.item.pieces) { · {{ 'ws.lf.piecesN' | t: { n: i18n.num(l.item.pieces) } }} }</small></td>
                <td>
                  <select [name]="'unit' + i" [ngModel]="l.unit" (ngModelChange)="setUnit(i, $event)" [attr.aria-label]="'ws.sale.unit' | t">
                    <option [value]="l.item.unit">{{ 'ws.stock.unit.' + l.item.unit | t }}</option>
                    @if (l.item.unit === 'BALE' && (l.members?.length ?? 1) === 1) { <option value="KG">{{ 'ws.stock.unit.KG' | t }}</option> }
                    @if (l.item.unit === 'BALE' && l.item.pieces) { <option value="PIECE">{{ 'ws.stock.unit.PIECE' | t }}</option> }
                  </select>
                </td>
                <td class="num"><input #qtyInput [name]="'qty' + i" type="number" min="0.01" [max]="maxQty(l)" [step]="l.unit === 'KG' ? '0.01' : '1'" [ngModel]="l.quantity" (ngModelChange)="setQty(i, +$event)" [attr.aria-label]="'ws.sale.quantity' | t" /></td>
                <td class="num">
                  <input [name]="'price' + i" type="number" min="0" step="1" [ngModel]="l.unitPrice" (ngModelChange)="patch(i, { unitPrice: $event === null || $event === '' ? null : +$event })" [attr.aria-label]="'ws.sale.unitPrice' | t" />
                  @if (l.from) { <small>{{ 'ws.saleEntry.from.' + l.from | t }}</small> }
                  @if (belowCost(l); as cost) { <small class="bad" role="alert">{{ 'ws.sp2.belowCost' | t: { cost: i18n.money(cost) } }}</small> }
                </td>
                <td class="num">{{ i18n.money(l.quantity * (l.unitPrice ?? 0)) }}</td>
                <td><button type="button" class="icon" (click)="remove(i)" [attr.aria-label]="'ws.saleEntry.remove' | t"><lucide-icon [img]="icons.Trash2" [size]="16" aria-hidden="true" /></button></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty">{{ (customer() ? 'ws.saleEntry.noLines' : 'ws.saleEntry.pickCustomer') | t }}</td></tr>
            }
          </tbody>
          <tfoot><tr><td colspan="4">{{ 'ws.col.total' | t }}</td><td class="num">{{ i18n.money(total()) }}</td><td></td></tr></tfoot>
        </table>

        @if (on('EXPORT')) {
          <!-- Phase 9.2: an export sale and its shipment (all can be filled in later on the sale). -->
          <div class="export">
            <label class="check"><input type="checkbox" name="isExport" [(ngModel)]="isExport" /> {{ 'xp.isExport' | t }}</label>
            @if (isExport) {
              <div class="ship">
                @for (f of shipFields; track f) { <label>{{ ('xp.f.' + f) | t }}<input [name]="'ship-' + f" maxlength="120" [(ngModel)]="ship[f]" /></label> }
              </div>
            }
          </div>
        }
        <div class="row pay">
          @if (modes().length > 1) {
          <div class="modes" role="group" [attr.aria-label]="'ws.col.paymentMode' | t">
            @for (m of modes(); track m) {
              <button type="button" class="ws-btn" [class.on]="mode() === m" [attr.aria-pressed]="mode() === m" (click)="mode.set(m)">{{ 'ws.mode.' + m | t }}</button>
            }
          </div>
          }
          @if (mode() === 'PARTIAL') {
            <label>{{ 'ws.sale.paid' | t }}<input name="paid" type="number" min="1" step="1" [(ngModel)]="paid" /></label>
          }
          @if (mode() !== 'CREDIT') {
            <label>{{ 'ws.sale.method' | t }}
              <select name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
            </label>
          }
          <span class="grow"></span>
          <button type="submit" class="ws-btn primary" [disabled]="!canSave()">{{ 'ws.saleEntry.save' | t }} <kbd>{{ 'ws.saleEntry.shortcut' | t }}</kbd></button>
        </div>
      </form>
    </div>

    <ws-side-sheet [open]="newCustomer()" [heading]="'sell.newCustomer' | t" (close)="newCustomer.set(false)">
      <form class="nc" id="ws-new-customer" (ngSubmit)="addCustomer()">
        <label>{{ 'common.name' | t }}<input name="ncName" required maxlength="120" [(ngModel)]="ncName" /></label>
        <label>{{ 'common.phone' | t }}<input name="ncPhone" type="tel" required maxlength="30" [(ngModel)]="ncPhone" [placeholder]="'common.phonePlaceholder' | t" /></label>
        <label>{{ 'common.city' | t }}<input name="ncCity" maxlength="80" [(ngModel)]="ncCity" /></label>
      </form>
      <ng-container footer>
        <button type="button" class="ws-btn" (click)="newCustomer.set(false)">{{ 'common.cancel' | t }}</button>
        <button type="submit" form="ws-new-customer" class="ws-btn primary" [disabled]="busy() || !ncName.trim() || !ncPhone.trim()">{{ 'common.save' | t }}</button>
      </ng-container>
    </ws-side-sheet>
  `,
  styles: [`
    .export { display:grid; gap:8px; }
    .export .check { display:flex; gap:8px; align-items:center; font-weight:600; }
    .export .ship { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:8px; }
    .export .ship label { display:grid; gap:4px; font-size:13px; }
    .page { display:grid; gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .sheet { display:grid; gap:var(--ws-4); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    input, select { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .row { display:flex; flex-wrap:wrap; align-items:end; gap:var(--ws-3); }
    .grow { flex:1 1 280px; }
    .chip { margin:0; padding:6px 10px; border-radius:999px; background:var(--ws-brand-soft); color:var(--ws-brand); font-size:var(--ws-text-sm); }
    table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
    th, td { padding:var(--ws-2); border-bottom:1px solid var(--ws-line); text-align:start; vertical-align:top; }
    th { color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
    td small { display:block; color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .num { text-align:end; }
    .chip.warn, .warn-line { background:var(--ws-bad-soft); color:var(--ws-bad); }
    .warn-line { margin:0; padding:var(--ws-2) var(--ws-3); border-radius:var(--ws-r-md); font-size:var(--ws-text-sm); }
    td small.bad { color:var(--ws-bad); font-weight:600; }
    .nc { display:grid; gap:var(--ws-3); }
    td.num input { width:120px; text-align:end; }
    tfoot td { font-weight:700; }
    .empty { color:var(--ws-ink-2); text-align:center; }
    .icon { display:inline-grid; place-items:center; width:32px; height:32px; border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink-2); cursor:pointer; }
    .icon:hover { background:var(--ws-surface-hover); color:var(--ws-bad); }
    .modes { display:flex; gap:var(--ws-2); }
    .modes .on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); }
    kbd { padding:0 4px; border:1px solid currentColor; border-radius:4px; font:inherit; font-size:11px; opacity:.8; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  `],
})
export class SaleEntryComponent implements HasUnsavedChanges {
  private readonly nav = inject(NavService);
  private saved = false;
  /** A customer or a line was entered and the sale is not saved yet (leaving asks first). */
  hasUnsavedChanges(): boolean {
    return !this.saved && (this.lines().length > 0 || !!this.customer());
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.hasUnsavedChanges());
  }
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly qtyInputs = viewChildren<ElementRef<HTMLInputElement>>('qtyInput');
  protected readonly icons = { Trash2 };
  protected readonly on = moduleOn();
  /** Udhaar (all or part) is khata: without it, cash only (v2 modules). */
  protected readonly modes = computed<Mode[]>(() => (this.on('KHATA') ? ['CASH', 'CREDIT', 'PARTIAL'] : ['CASH']));
  protected readonly methods = PAYMENT_METHODS;
  protected readonly isText = (x: string | null): x is string => !!x;
  protected readonly label = optionLabel;

  protected readonly customerText = signal('');
  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly customer = signal<CustomerOption | null>(null);
  protected readonly itemText = signal('');
  protected readonly stock = signal<StockOption[]>([]);
  /** The choices in "Add item": bales grouped by kind. Each one seen is remembered, so picking it never searches again. */
  protected readonly picks = computed(() => toPicks(this.stock()));
  private readonly seen = new Map<string, Pick>();
  protected readonly lines = signal<Line[]>([]);
  protected readonly mode = signal<Mode>('CASH');
  protected readonly busy = signal(false);
  protected paid: number | null = null;
  /** Phase 9.2: an export sale and its shipment. */
  protected isExport = false;
  protected readonly shipFields = ['destinationCountry', 'portOfLoading', 'portOfDischarge', 'vesselName', 'billOfLadingNumber', 'containerSealNumber', 'freightForwarder'] as const;
  protected ship: Record<string, string> = {};
  protected method = 'CASH';
  /** One key per sale being entered: a double submit or retry records it once. */
  private idempotencyKey = crypto.randomUUID();

  protected readonly total = computed(() => this.lines().reduce((t, l) => t + l.quantity * (l.unitPrice ?? 0), 0));
  protected readonly canSave = computed(
    () => !this.busy() && !!this.customer() && this.lines().length > 0 && this.lines().every((l) => l.quantity > 0 && l.unitPrice !== null && l.unitPrice >= 0),
  );

  constructor() {
    toObservable(this.customerText)
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((q) => this.http.get<CustomerOption[]>('/api/customers', { params: new HttpParams().set('search', q) }).pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.customers.set(list.slice(0, 50));
        // The name may have been typed in full before the matches arrived.
        if (!this.customer()) this.pickCustomer(this.customerText());
      });
    toObservable(this.itemText)
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        // A choice picked from the list ("Jeans A") is not something to search for: keep the list as it is.
        filter((q) => !this.seen.has(q.trim())),
        switchMap((q) =>
          this.http
            .get<ListResult>('/api/lists/stock', { params: new HttpParams().set('q', q).set('pageSize', '50').append('f', 'status:ne:SOLD') })
            .pipe(catchError(() => of({ rows: [] } as unknown as ListResult))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.stock.set(stockRows(r.rows));
        for (const p of this.picks()) this.seen.set(p.label, p);
      });
  }

  protected kindLeft(p: Pick): number {
    return p.members.reduce((t, m) => t + Number(m.left), 0);
  }

  /** The most this line can sell: the bales of its kind, or what is left of the item (in kg when sold by kg). */
  protected maxQty(l: Line): number {
    if (l.unit === 'KG' && l.item.unit === 'BALE') return Number(l.item.kg ?? 0);
    if (l.unit === 'PIECE' && l.item.unit === 'BALE') return l.item.pieces ?? 0;
    return Number(l.item.left);
  }

  protected setQty(i: number, q: number): void {
    const l = this.lines()[i];
    if (!l) return;
    const max = this.maxQty(l);
    if (max > 0 && q > max) {
      this.toast.show(this.i18n.t('ws.saleEntry.onlyLeft', { n: this.qty(max, l.unit) }));
      q = max;
      // The box shows what was typed until the model changes: put the limit back in it.
      setTimeout(() => { const el = this.qtyInputs()[i]?.nativeElement; if (el) el.value = String(max); });
    }
    this.patch(i, { quantity: q });
  }

  protected qty(v: string | number, unit: string): string {
    return unit === 'KG' ? this.i18n.kg(v) : this.i18n.num(v);
  }

  /** What the picked customer owes and their credit limit (GET /api/khata/customers/:id). */
  protected readonly account = signal<{ balance: string; creditLimit: string | null } | null>(null);
  protected readonly newCustomer = signal(false);
  protected ncName = '';
  protected ncPhone = '';
  protected ncCity = '';
  /** Typed a name that matches nobody: say so (Enter picked nothing before, silently). */
  protected readonly customerMiss = signal(false);
  protected readonly overLimit = computed(() => {
    const a = this.account();
    if (!a?.creditLimit || Number(a.creditLimit) <= 0) return false;
    const credit = this.mode() === 'CREDIT' ? this.total() : this.mode() === 'PARTIAL' ? Math.max(0, this.total() - Number(this.paid ?? 0)) : 0;
    return Number(a.balance) + credit > Number(a.creditLimit);
  });

  protected abs(v: number): number {
    return Math.abs(v);
  }
  protected round(v: string | number | null | undefined): number {
    return Math.round(Number(v ?? 0));
  }

  /**
   * Enter in the customer box: the exact name, else the first match; nobody: say so and offer New customer. A fast
   * Enter can come before the search has answered, so a miss asks the server once before saying "no customer".
   */
  protected pickFirst(): void {
    const text = this.customerText().trim();
    if (!text) return;
    const match = (list: CustomerOption[]) =>
      list.find((x) => x.name.toLowerCase() === text.toLowerCase()) ?? list.find((x) => x.name.toLowerCase().includes(text.toLowerCase()));
    const take = (c: CustomerOption) => {
      this.pickCustomer(c.name);
      this.focusItemWhenReady();
    };
    const c = match(this.customers());
    if (c) return take(c);
    this.http.get<CustomerOption[]>('/api/customers', { params: new HttpParams().set('search', text) }).pipe(catchError(() => of([]))).subscribe((list) => {
      if (this.customerText().trim() !== text) return;
      const found = match(list);
      if (found) {
        this.customers.set([found, ...this.customers().filter((x) => x.id !== found.id)]);
        take(found);
      } else {
        this.customerMiss.set(true);
      }
    });
  }

  protected openNewCustomer(): void {
    this.ncName = this.customerText().trim();
    this.ncPhone = '';
    this.ncCity = '';
    this.newCustomer.set(true);
  }

  protected addCustomer(): void {
    if (!this.ncName.trim() || !this.ncPhone.trim()) return;
    this.busy.set(true);
    this.http.post<CustomerOption>('/api/customers', { name: this.ncName.trim(), phone: this.ncPhone.trim(), ...(this.ncCity.trim() ? { city: this.ncCity.trim() } : {}) }).subscribe({
      next: (c) => {
        this.busy.set(false);
        this.newCustomer.set(false);
        this.customers.set([c, ...this.customers()]);
        this.pickCustomer(c.name);
      },
      error: (e: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.toast.show(e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }

  /** A price below what the item cost (cost per unit from its value left), for the warning under the price. */
  protected belowCost(l: Line): number | null {
    const left = Number(l.item.left);
    if (!l.item.value || !left || l.unitPrice === null) return null;
    let perUnit = Number(l.item.value) / left;
    if (l.unit === 'KG' && l.item.unit === 'BALE') {
      const kgPerBale = Number(l.item.kg ?? 0) / left;
      if (!kgPerBale) return null;
      perUnit = perUnit / kgPerBale;
    }
    return l.unitPrice < perUnit ? Math.round(perUnit) : null;
  }

  /**
   * The cursor to "Add item" once a customer is picked. The box is enabled a moment after (forms apply "disabled"
   * later), and focusing it while still disabled does nothing: wait for it, a few frames at most.
   */
  private focusItemWhenReady(tries = 0): void {
    const el = document.querySelector<HTMLInputElement>('input[name=item]');
    if (el && !el.disabled) return el.focus();
    if (tries < 20) requestAnimationFrame(() => this.focusItemWhenReady(tries + 1));
  }

  protected pickCustomer(text: string): void {
    this.customerMiss.set(false);
    this.customerText.set(text);
    const c = this.customers().find((x) => x.name === text) ?? null;
    if (c?.id !== this.customer()?.id) {
      this.customer.set(c);
      this.account.set(null);
      if (c) this.http.get<{ balance: string; creditLimit: string | null; customer?: { creditLimit: string | null } }>(`/api/khata/customers/${c.id}`).subscribe({
        next: (a) => this.account.set({ balance: a.balance, creditLimit: a.creditLimit ?? a.customer?.creditLimit ?? null }),
        error: () => this.account.set(null),
      });
      // Prices depend on the customer: suggest again.
      this.lines().forEach((_, i) => this.suggest(i));
    }
  }

  protected addItem(): void {
    const text = this.itemText().trim();
    if (!text) return;
    const p = this.seen.get(text) ?? this.picks().find((x) => x.label.toLowerCase() === text.toLowerCase());
    if (p) return this.addKind(p);
    const s = this.stock().find((x) => optionLabel(x) === text) ?? this.stock().find((x) => x.code?.toLowerCase() === text.toLowerCase());
    if (s) return this.addStock(s);
    // A scanner (or fast typing) presses Enter before the search answers: look the code up now.
    this.http
      .get<ListResult>('/api/lists/stock', { params: new HttpParams().set('q', text).set('pageSize', '50').append('f', 'status:ne:SOLD') })
      .subscribe({
        next: (r) => {
          const rows = stockRows(r.rows);
          const hit = rows.find((x) => x.code?.toLowerCase() === text.toLowerCase() || optionLabel(x) === text) ?? (rows.length === 1 ? rows[0] : undefined);
          if (hit) this.addStock(hit);
          else this.toast.show(this.i18n.t('ws.saleEntry.notFound'));
        },
        error: () => this.toast.show(this.i18n.t('ws.saleEntry.notFound')),
      });
  }

  /** A kind picked from the list: every bale of it (not only those on this page), oldest first, as one line. */
  private addKind(p: Pick): void {
    this.itemText.set('');
    if (p.key.startsWith('item|')) return this.addStock(p.members[0]);
    const existing = this.lines().findIndex((l) => l.item.id === `kind:${p.key}`);
    if (existing >= 0) return this.setQty(existing, this.lines()[existing].quantity + 1);
    const [categoryId, gradeId] = p.key.split('|');
    let params = new HttpParams().set('pageSize', '200').append('f', 'status:ne:SOLD').append('f', `categoryId:eq:${categoryId}`);
    if (gradeId) params = params.append('f', `gradeId:eq:${gradeId}`);
    this.http.get<ListResult>('/api/lists/stock', { params }).pipe(catchError(() => of({ rows: [] } as unknown as ListResult))).subscribe((r) => {
      const all = stockRows(r.rows).filter((x) => kindKey(x) === p.key && Number(x.left) > 0);
      // Bales already on another line (scanned one by one) are not taken twice.
      const taken = new Set(this.lines().filter((l) => !l.members).map((l) => l.item.id));
      const members = (all.length ? all : p.members).filter((m) => !taken.has(m.id)).sort(byCode);
      if (!members.length) return this.toast.show(this.i18n.t('ws.saleEntry.notFound'));
      this.lines.set([...this.lines(), { item: kindItem({ ...p, members }), unit: 'BALE', quantity: 1, unitPrice: null, from: null, members }]);
      this.suggest(this.lines().length - 1);
      setTimeout(() => this.qtyInputs()[this.lines().length - 1]?.nativeElement.select());
    });
  }

  private addStock(s: StockOption): void {
    // A bale scanned whose kind is already a line: that bale goes first in it, one more.
    const kind = this.lines().findIndex((l) => l.members?.some((m) => m.id === s.id));
    if (kind >= 0) {
      const l = this.lines()[kind];
      this.patch(kind, { members: [s, ...l.members!.filter((m) => m.id !== s.id)] });
      this.itemText.set('');
      return this.setQty(kind, l.quantity + 1);
    }
    const existing = this.lines().findIndex((l) => l.item.id === s.id);
    if (existing >= 0) this.setQty(existing, this.lines()[existing].quantity + 1);
    else {
      this.lines.set([...this.lines(), { item: s, unit: s.unit, quantity: 1, unitPrice: null, from: null }]);
      this.suggest(this.lines().length - 1);
    }
    this.itemText.set('');
    setTimeout(() => this.qtyInputs()[existing >= 0 ? existing : this.lines().length - 1]?.nativeElement.select());
  }

  private suggest(i: number): void {
    const c = this.customer();
    const l = this.lines()[i];
    if (!c || !l) return;
    const params = new HttpParams().set('customerId', c.id).set('inventoryItemId', l.members?.[0]?.id ?? l.item.id).set('unit', l.unit);
    this.http.get<{ unitPrice: string | null; from: string | null }>('/api/sales/last-price', { params }).subscribe({
      next: (p) => {
        const cur = this.lines()[i];
        if (cur?.item.id === l.item.id && cur.unit === l.unit) this.patch(i, { unitPrice: p.unitPrice === null ? cur.unitPrice : +p.unitPrice, from: p.from });
      },
      error: () => undefined,
    });
  }

  protected patch(i: number, p: Partial<Line>): void {
    this.lines.set(this.lines().map((l, j) => (j === i ? { ...l, ...p } : l)));
  }

  protected setUnit(i: number, unit: Line['unit']): void {
    this.patch(i, { unit, unitPrice: null, from: null });
    this.suggest(i);
  }

  protected remove(i: number): void {
    this.lines.set(this.lines().filter((_, j) => j !== i));
  }

  protected keys(e: KeyboardEvent): void {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.save();
    }
  }

  @HostListener('document:keydown.alt.n', ['$event'])
  protected focusItem(e: Event): void {
    e.preventDefault();
    (document.querySelector('input[name=item]') as HTMLInputElement | null)?.focus();
  }

  protected save(): void {
    const c = this.customer();
    if (!this.canSave() || !c) return;
    if (this.mode() === 'PARTIAL' && (!this.paid || this.paid >= this.total())) {
      this.toast.show(this.i18n.t('ws.saleEntry.partialHint'));
      return;
    }
    this.busy.set(true);
    const body = {
      customerId: c.id,
      // A kind line sells its first bales, one sale line per bale.
      lines: this.lines().flatMap((l) =>
        l.members && l.unit === 'PIECE'
          ? piecesOver(l.members, l.quantity).map(({ id, n }) => ({ inventoryItemId: id, unit: 'PIECE' as const, quantity: n, unitPrice: l.unitPrice }))
          : l.members
            ? l.members.slice(0, l.quantity).map((m) => ({ inventoryItemId: m.id, unit: 'BALE' as const, quantity: 1, unitPrice: l.unitPrice }))
            : [{ inventoryItemId: l.item.id, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice }],
      ),
      paymentMode: this.mode(),
      ...(this.isExport && this.on('EXPORT') ? { type: 'EXPORT', shipment: Object.fromEntries(Object.entries(this.ship).filter(([, v]) => v.trim())) } : {}),
      ...(this.mode() === 'CASH' ? { paidAmount: this.total(), paymentMethod: this.method } : {}),
      ...(this.mode() === 'PARTIAL' ? { paidAmount: this.paid, paymentMethod: this.method } : {}),
    };
    this.http.post<{ id: string; saleNumber: string }>('/api/sales', body, { headers: new HttpHeaders({ 'Idempotency-Key': this.idempotencyKey }) }).subscribe({
      next: (s) => {
        this.busy.set(false);
        this.idempotencyKey = crypto.randomUUID();
        this.toast.show(this.i18n.t('ws.saleEntry.saved', { number: s.saleNumber }));
        this.saved = true;
        // The sale replaces the entry form in history: Back goes to the sales list, not to an empty form.
        void this.nav.replace(['/sell/records', s.id]);
      },
      error: (e: { status?: number; error?: { message?: string | string[] } }) => {
        this.busy.set(false);
        const m = e.error?.message;
        this.toast.show(e.status === 400 || e.status === 409 ? (Array.isArray(m) ? m.join(', ') : m ?? this.i18n.t('common.couldNotSave')) : this.i18n.t('common.couldNotSave'));
      },
    });
  }
}
