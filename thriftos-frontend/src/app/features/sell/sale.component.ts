import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, MessageCircle, ScanLine, Trash2 } from 'lucide-angular';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/config/api.config';
import { ScanSheetComponent } from '../../shared/floor/scan-sheet.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { InventoryItem } from '../../modules/inventory/inventory.models';
import { InventoryService } from '../../modules/inventory/inventory.service';
import { CustomersService } from '../../modules/sales/customers.service';
import { KhataService } from '../../modules/sales/khata.service';
import { Customer, PaymentMethod, PaymentMode, SaleDetail, StockUnit } from '../../modules/sales/sales.models';
import { SalesService } from '../../modules/sales/sales.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';
import { stockName } from '../stock/stock-home.component';

interface CartLine {
  item: InventoryItem;
  unit: StockUnit;
  quantity: number | null;
  unitPrice: number | null;
}

export const METHODS: PaymentMethod[] = ['CASH', 'JAZZCASH', 'EASYPAISA', 'BANK', 'RAAST'];
const MODES: PaymentMode[] = ['CASH', 'CREDIT', 'PARTIAL'];

/**
 * Journey 4 — sell (< 30 s): customer (tiles or "+ new" with name + WhatsApp), items (tiles + search;
 * price defaults to this customer's last price), Cash now / Udhaar / Part paid, Save →
 * "Share bill on WhatsApp". Saved through the offline queue with one idempotency key per sale.
 */
@Component({
  selector: 'app-sale',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N, NumberFieldComponent, TilesComponent, ScanSheetComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/sell" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'sell.new' | t }}</h1>
      </header>

      @if (done(); as sale) {
        <section class="card done">
          <lucide-icon [img]="icons.CheckCircle2" [size]="34" class="good" />
          <h2>{{ 'sell.saved' | t: { no: sale.saleNumber, rs: (sale.totalAmount | rs) } }}</h2>
          <p class="hint">{{ 'sell.savedLine' | t: { name: customer()?.name ?? '', paid: (sale.paid | rs), due: (sale.due | rs), balance: (sale.customerBalance | rs) } }}</p>
          <button type="button" class="btn primary block" (click)="share(sale)"><lucide-icon [img]="icons.MessageCircle" [size]="20" /> {{ 'sell.share' | t }}</button>
          <a class="btn block" [routerLink]="['/sell/records', sale.id]">{{ 'sell.openBill' | t }}</a>
          <button type="button" class="btn block" (click)="reset()">{{ 'sell.another' | t }}</button>
        </section>
      } @else {
        <section class="card">
          <h2>{{ 'sell.customer' | t }}</h2>
          @if (customer(); as c) {
            <div class="picked"><span><strong>{{ c.name }}</strong><small class="ltr">{{ c.phone || '' }}</small></span><button type="button" class="link-btn" (click)="customer.set(null)">{{ 'common.change' | t }}</button></div>
          } @else if (adding()) {
            <label class="field">{{ 'common.name' | t }}<input name="newName" [(ngModel)]="newName" maxlength="200" autocomplete="off" /></label>
            <label class="field">{{ 'common.phone' | t }}<input name="newPhone" type="tel" inputmode="tel" [(ngModel)]="newPhone" [placeholder]="'common.phonePlaceholder' | t" /></label>
            <div class="row2">
              <button type="button" class="btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
              <button type="button" class="btn primary" [disabled]="!newName.trim() || !newPhone.trim() || saving()" (click)="addCustomer()">{{ 'sell.addCustomer' | t }}</button>
            </div>
          } @else {
            <tos-tiles [items]="customerTiles()" searchPlaceholder="sell.searchCustomer" newLabel="sell.newCustomer" (pick)="pickCustomer($event)" (addNew)="startAdding($event)" />
          }
        </section>

        <section class="card">
          <h2>{{ 'sell.items' | t }}</h2>
          @for (line of cart(); track line.item.id) {
            <div class="line">
              <div class="line-head"><span><strong>{{ name(line.item) }}</strong>@if (line.item.unitCode) { <small class="ltr code"> {{ line.item.unitCode }}</small> }</span><button type="button" class="icon-btn" [attr.aria-label]="'common.remove' | t" (click)="remove(line)"><lucide-icon [img]="icons.Trash2" [size]="18" /></button></div>
              <small class="hint">{{ 'sell.left' | t: { n: (line.item.remainingQuantity | num) } }} {{ unitKey(line.item.unit) | t }}</small>
              @if (line.item.unit === 'BALE' && line.item.weightKg) {
                <div class="chips"><button type="button" class="chip" [class.on]="line.unit === 'BALE'" (click)="setUnit(line, 'BALE')">{{ 'sell.perBale' | t }}</button><button type="button" class="chip" [class.on]="line.unit === 'KG'" (click)="setUnit(line, 'KG')">{{ 'sell.perKg' | t }}</button></div>
              }
              <div class="row2">
                <tos-number label="sell.quantity" [unit]="unitKey(line.unit)" [decimals]="line.unit === 'KG' ? 2 : 0" [value]="line.quantity" (valueChange)="setLine(line, 'quantity', $event)" />
                <tos-number label="common.price" unit="Rs" [value]="line.unitPrice" (valueChange)="setLine(line, 'unitPrice', $event)" />
              </div>
            </div>
          }
          <button type="button" class="btn" (click)="scanning.set(true)"><lucide-icon [img]="icons.ScanLine" [size]="20" /> {{ 'sell.scanBale' | t }}</button>
          <tos-tiles [items]="stockTiles()" searchPlaceholder="sell.searchStock" emptyText="sell.noStock" (pick)="addItem($event)" />
        </section>

        <section class="card">
          <h2>{{ 'sell.payment' | t }}</h2>
          <div class="chips">@for (m of modes; track m) { <button type="button" class="chip" [class.on]="mode() === m" (click)="mode.set(m)">{{ 'sell.mode.' + m | t }}</button> }</div>
          @if (mode() === 'PARTIAL') { <tos-number label="sell.paidNow" unit="Rs" [(value)]="paidAmount" /> }
          @if (mode() !== 'CREDIT') {
            <div class="chips">@for (m of methods; track m) { <button type="button" class="chip" [class.on]="method() === m" (click)="method.set(m)">{{ 'method.' + m | t }}</button> }</div>
          }
        </section>

        @if (scanning()) { <tos-scan-sheet (scanned)="scanned($event)" (closed)="scanning.set(false)" /> }
        <footer class="action-bar">
          <div class="summary"><small>{{ 'common.total' | t }}</small><strong>{{ total() | rs }}</strong></div>
          <button type="button" class="btn primary" [disabled]="!canSave() || saving()" (click)="save()">{{ (saving() ? 'common.saving' : 'sell.save') | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`
    .done { justify-items:center; text-align:center; }
    .picked { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .picked span { display:grid; }
    .picked small { color:var(--tos-ink-soft); }
    .line { display:grid; gap:8px; padding-block-end:12px; border-block-end:1px solid var(--tos-line); }
    .line-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .line-head .code { color:var(--tos-ink-soft); font-weight:700; }
  `],
})
export class SaleComponent implements OnInit {
  private readonly sales = inject(SalesService);
  private readonly customersService = inject(CustomersService);
  private readonly stock = inject(InventoryService);
  private readonly khata = inject(KhataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, CheckCircle2, MessageCircle, ScanLine, Trash2 };
  private readonly http = inject(HttpClient);
  protected readonly scanning = signal(false);
  protected readonly modes = MODES;
  protected readonly methods = METHODS;
  protected readonly name = (i: InventoryItem) => stockName(i as never);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly inventory = signal<InventoryItem[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly cart = signal<CartLine[]>([]);
  protected readonly mode = signal<PaymentMode>('CASH');
  protected readonly method = signal<PaymentMethod>('CASH');
  protected readonly paidAmount = signal<number | null>(null);
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly done = signal<SaleDetail | null>(null);
  protected newName = '';
  protected newPhone = '';
  /** One key per sale: a retry after a network error never saves it twice. */
  private idempotencyKey = crypto.randomUUID();

  protected readonly customerTiles = computed<Tile[]>(() => this.customers().map((c) => ({ id: c.id, label: c.name, sub: c.city || c.phone || '', keywords: c.phone || '' })));
  protected readonly stockTiles = computed<Tile[]>(() => {
    const inCart = new Set(this.cart().map((l) => l.item.id));
    return this.inventory()
      .filter((i) => !inCart.has(i.id))
      .map((i) => ({ id: i.id, label: this.name(i), sub: [i.unitCode, `${this.i18n.num(i.remainingQuantity)} ${this.i18n.t(this.unitKey(i.unit))}`].filter(Boolean).join(' · '), keywords: i.unitCode || '' }));
  });
  protected readonly total = computed(() => this.cart().reduce((sum, l) => sum + (l.quantity || 0) * (l.unitPrice || 0), 0));
  protected readonly canSave = computed(() => {
    const linesOk = this.cart().length > 0 && this.cart().every((l) => (l.quantity || 0) > 0 && (l.unitPrice ?? -1) >= 0);
    const paid = this.paidAmount() || 0;
    return !!this.customer() && linesOk && (this.mode() !== 'PARTIAL' || (paid > 0 && paid < this.total()));
  });

  ngOnInit(): void {
    this.customersService.list({ isActive: true }).subscribe({ next: (items) => this.customers.set(items), error: () => undefined });
    this.loadStock();
  }

  protected unitKey(unit: StockUnit): string {
    return { KG: 'unit.kgShort', BALE: 'unit.bales', PIECE: 'unit.pcs' }[unit];
  }

  protected startAdding(query: string): void {
    this.newName = /\d{4}/.test(query) ? '' : query;
    this.newPhone = /\d{4}/.test(query) ? query : '';
    this.adding.set(true);
  }

  protected async addCustomer(): Promise<void> {
    this.saving.set(true);
    const body = { name: this.newName.trim(), phone: this.newPhone.trim() };
    try {
      const r = await this.queue.send<Customer>({ kind: 'customer', label: body.name, url: '/api/customers', body });
      // Offline: a stand-in customer; the sale refers to the queued customer and gets its id on sync.
      const c = r.saved ? r.response : ({ id: `local:${r.id}`, name: body.name, phone: body.phone } as Customer);
      this.customers.update((list) => [c, ...list]);
      this.adding.set(false);
      this.setCustomer(c);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }

  protected pickCustomer(tile: Tile): void {
    const c = this.customers().find((x) => x.id === tile.id);
    if (c) this.setCustomer(c);
  }

  protected addItem(tile: Tile): void {
    const item = this.inventory().find((i) => i.id === tile.id);
    if (!item) return;
    const line: CartLine = { item, unit: item.unit, quantity: item.unit === 'KG' ? null : 1, unitPrice: null };
    this.cart.update((c) => [...c, line]);
    this.suggestPrice(line);
  }

  /** Scan a bale's QR (or type its code) → it goes into the sale. */
  protected scanned(code: string): void {
    this.scanning.set(false);
    this.http.get<InventoryItem>(`${API_BASE_URL}/sales/scan/qr/${encodeURIComponent(code)}`).subscribe({
      next: (item) => {
        if (this.cart().some((l) => l.item.id === item.id)) return;
        if (!this.inventory().some((i) => i.id === item.id)) this.inventory.update((list) => [item, ...list]);
        this.addItem({ id: item.id, label: this.name(item) });
      },
      error: () => {
        // Offline: match the code against the stock already on the phone.
        const local = this.inventory().find((i) => i.unitCode && (code === i.unitCode || code.endsWith(`:${i.unitCode}`)));
        if (local) this.addItem({ id: local.id, label: this.name(local) });
        else this.toast.error(this.i18n.t('stock.notFound'));
      },
    });
  }

  protected remove(line: CartLine): void {
    this.cart.update((c) => c.filter((l) => l !== line));
  }

  protected setUnit(line: CartLine, unit: StockUnit): void {
    this.cart.update((c) => c.map((l) => (l === line ? { ...l, unit, quantity: unit === 'KG' ? Number(l.item.weightKg) / Number(l.item.quantity) : 1, unitPrice: null } : l)));
    const updated = this.cart().find((l) => l.item.id === line.item.id);
    if (updated) this.suggestPrice(updated);
  }

  protected setLine(line: CartLine, field: 'quantity' | 'unitPrice', value: number | null): void {
    this.cart.update((c) => c.map((l) => (l.item.id === line.item.id ? { ...l, [field]: value } : l)));
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    const c = this.customer()!;
    const body = {
      customerId: c.id.startsWith('local:') ? this.queue.ref(c.id.slice(6)) : c.id,
      paymentMode: this.mode(),
      ...(this.mode() === 'PARTIAL' ? { paidAmount: this.paidAmount() } : {}),
      ...(this.mode() !== 'CREDIT' ? { paymentMethod: this.method() } : {}),
      lines: this.cart().map((l) => ({ inventoryItemId: l.item.id, unit: l.unit, quantity: l.quantity!, unitPrice: l.unitPrice! })),
    };
    this.saving.set(true);
    try {
      const r = await this.queue.send<SaleDetail>({ kind: 'sale', label: `${c.name} · ${this.i18n.money(this.total())}`, url: '/api/sales', id: this.idempotencyKey, body });
      if (r.saved) this.done.set(r.response);
      else {
        this.toast.show(this.i18n.t('sell.savedOffline'));
        this.reset();
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }

  protected share(sale: SaleDetail): void {
    this.khata.openWhatsapp(this.khata.billMessage(sale.id, this.i18n.lang()), (e: any) => this.toast.error(e?.error?.message || this.i18n.t('common.couldNotLoad')));
  }

  protected reset(): void {
    this.done.set(null);
    this.customer.set(null);
    this.cart.set([]);
    this.mode.set('CASH');
    this.paidAmount.set(null);
    this.idempotencyKey = crypto.randomUUID();
    this.loadStock();
  }

  private setCustomer(c: Customer): void {
    this.customer.set(c);
    for (const line of this.cart()) this.suggestPrice(line);
  }

  /** Price defaults to this customer's last price for the same kind of stock (rule 5). */
  private suggestPrice(line: CartLine): void {
    const c = this.customer();
    if (!c || c.id.startsWith('local:')) return;
    this.sales.lastPrice(c.id, line.item.id, line.unit).subscribe({
      next: (price) => {
        if (price.unitPrice === null) return;
        this.cart.update((list) => list.map((l) => (l.item.id === line.item.id && l.unitPrice === null ? { ...l, unitPrice: Number(price.unitPrice) } : l)));
      },
      error: () => undefined,
    });
  }

  private loadStock(): void {
    this.stock.getAll({ status: 'AVAILABLE', limit: 200 }).subscribe({ next: (page) => this.inventory.set(page.items || []), error: () => undefined });
  }
}
