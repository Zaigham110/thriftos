import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CheckCircle2, LucideAngularModule, MessageCircle, Plus, Search, Trash2, UserPlus } from 'lucide-angular';

import { InventoryItem } from '../../../modules/inventory/inventory.models';
import { InventoryService } from '../../../modules/inventory/inventory.service';
import { CustomersService } from '../../../modules/sales/customers.service';
import { KhataService } from '../../../modules/sales/khata.service';
import { Customer, PaymentMethod, PaymentMode, SaleDetail, StockUnit } from '../../../modules/sales/sales.models';
import { SalesService } from '../../../modules/sales/sales.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';

interface CartLine {
  item: InventoryItem;
  unit: StockUnit;
  quantity: number | null;
  unitPrice: number | null;
}

const MODES: { value: PaymentMode; label: string }[] = [
  { value: 'CASH', label: 'Cash now' },
  { value: 'CREDIT', label: 'Udhaar' },
  { value: 'PARTIAL', label: 'Part paid' },
];

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
  { value: 'RAAST', label: 'Raast' },
  { value: 'JAZZCASH', label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
];

/**
 * Journey 4: pick the customer (or add one with name + phone), add items (price defaults to the
 * last price), choose cash / udhaar / part paid, save. The sale is saved in one request.
 */
@Component({
  selector: 'app-flow-sale',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <section class="sale">
      <header><a routerLink="/sell" aria-label="Back"><lucide-icon [img]="icons.ArrowLeft" [size]="20" /></a><h1>New sale</h1></header>
      @if (message(); as text) { <p class="notice error">{{ text }}</p> }

      @if (done(); as sale) {
        <section class="card done">
          <lucide-icon [img]="icons.CheckCircle2" [size]="30" />
          <h2>{{ sale.saleNumber }} · Rs {{ +sale.totalAmount | number: '1.0-2' }}</h2>
          <p>{{ sale.customer?.name }} — paid Rs {{ +sale.paid | number: '1.0-2' }}, due Rs {{ +sale.due | number: '1.0-2' }}. Khata now Rs {{ +sale.customerBalance | number: '1.0-2' }}.</p>
          <button type="button" class="primary" (click)="share(sale)"><lucide-icon [img]="icons.MessageCircle" [size]="18" /> Share bill on WhatsApp</button>
          <a class="secondary" [routerLink]="['/sell/records', sale.id]">Open bill</a>
          <button type="button" class="secondary" (click)="reset()">New sale</button>
        </section>
      } @else {
        <section class="card">
          <h2>Customer</h2>
          @if (customer(); as c) {
            <div class="picked"><strong>{{ c.name }}</strong><small>{{ c.phone || c.city || '' }}</small><button type="button" class="link" (click)="customer.set(null)">Change</button></div>
          } @else if (adding()) {
            <label>Name<input name="newName" [(ngModel)]="newName" maxlength="200" /></label>
            <label>WhatsApp number<input name="newPhone" type="tel" inputmode="tel" [(ngModel)]="newPhone" placeholder="0300 1234567" required /></label>
            <div class="row"><button type="button" class="secondary" (click)="adding.set(false)">Cancel</button><button type="button" class="primary" [disabled]="!newName.trim() || !newPhone.trim() || saving()" (click)="addCustomer()">Add customer</button></div>
          } @else {
            <label class="search"><lucide-icon [img]="icons.Search" [size]="18" /><input name="customerSearch" [(ngModel)]="customerSearch" placeholder="Search name or phone" /></label>
            <div class="choices">
              @for (c of matchingCustomers(); track c.id) { <button type="button" (click)="pickCustomer(c)"><strong>{{ c.name }}</strong><small>{{ c.phone || c.city || '' }}</small></button> }
            </div>
            <button type="button" class="secondary" (click)="startAdding()"><lucide-icon [img]="icons.UserPlus" [size]="18" /> New customer</button>
          }
        </section>

        <section class="card">
          <h2>Items</h2>
          @for (line of cart(); track line.item.id) {
            <div class="line">
              <div class="line-head"><strong>{{ itemName(line.item) }}</strong><button type="button" aria-label="Remove" (click)="remove(line)"><lucide-icon [img]="icons.Trash2" [size]="18" /></button></div>
              <small>{{ +(line.item.remainingQuantity ?? 0) | number: '1.0-2' }} {{ unitName(line.item.unit) }} left</small>
              @if (line.item.unit === 'BALE' && line.item.weightKg) {
                <div class="units"><button type="button" [class.on]="line.unit === 'BALE'" (click)="setUnit(line, 'BALE')">Per bale</button><button type="button" [class.on]="line.unit === 'KG'" (click)="setUnit(line, 'KG')">Per kg</button></div>
              }
              <div class="row">
                <label>{{ unitName(line.unit) }}<input type="number" inputmode="decimal" min="0" [(ngModel)]="line.quantity" [name]="'q' + line.item.id" /></label>
                <label>Rs per {{ unitName(line.unit, 1) }}<input type="number" inputmode="decimal" min="0" [(ngModel)]="line.unitPrice" [name]="'p' + line.item.id" /></label>
              </div>
            </div>
          }
          <label class="search"><lucide-icon [img]="icons.Search" [size]="18" /><input name="itemSearch" [(ngModel)]="itemSearch" placeholder="Search stock" /></label>
          <div class="choices">
            @for (item of matchingStock(); track item.id) {
              <button type="button" (click)="addItem(item)"><strong>{{ itemName(item) }}</strong><small>{{ +(item.remainingQuantity ?? 0) | number: '1.0-2' }} {{ unitName(item.unit) }}</small><lucide-icon [img]="icons.Plus" [size]="18" /></button>
            } @empty { <p class="hint">No stock to sell.</p> }
          </div>
        </section>

        <section class="card">
          <h2>Payment</h2>
          <div class="tiles">@for (m of modes; track m.value) { <button type="button" [class.on]="mode() === m.value" (click)="mode.set(m.value)">{{ m.label }}</button> }</div>
          @if (mode() === 'PARTIAL') { <label>Paid now (Rs)<input name="paidAmount" type="number" inputmode="decimal" min="0" [(ngModel)]="paidAmount" /></label> }
          @if (mode() !== 'CREDIT') {
            <div class="tiles small">@for (m of methods; track m.value) { <button type="button" [class.on]="method() === m.value" (click)="method.set(m.value)">{{ m.label }}</button> }</div>
          }
        </section>

        <footer class="bar">
          <div><small>Total</small><strong>Rs {{ total() | number: '1.0-2' }}</strong></div>
          <button type="button" class="primary" [disabled]="!canSave() || saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save sale' }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`
    .sale { display:grid; grid-template-columns:minmax(0,1fr); gap:14px; max-width:600px; margin:0 auto; padding-bottom:96px; }
    header { display:flex; align-items:center; gap:8px; }
    header a { width:48px; height:48px; display:grid; place-items:center; color:var(--flow-ink); }
    h1 { margin:0; font-size:24px; }
    h2 { margin:0; font-size:17px; }
    .card { display:grid; grid-template-columns:minmax(0,1fr); min-width:0; gap:12px; padding:16px; border:1px solid var(--flow-line); border-radius:var(--flow-radius); background:#fff; }
    label { display:grid; gap:6px; font-size:14px; font-weight:700; }
    input { width:100%; min-width:0; min-height:48px; box-sizing:border-box; padding:0 12px; border:1px solid var(--flow-line); border-radius:10px; font:inherit; font-size:18px; }
    .search { display:flex; align-items:center; gap:8px; padding-left:12px; border:1px solid var(--flow-line); border-radius:10px; }
    .search input { flex:1; border:0; }
    .choices { display:grid; max-height:240px; overflow:auto; }
    .choices button { min-height:56px; display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:8px; padding:8px 4px; border:0; border-bottom:1px solid var(--flow-line); background:#fff; color:var(--flow-ink); font:inherit; text-align:left; }
    small { color:var(--flow-ink-soft); font-size:13px; font-weight:500; }
    .picked { display:flex; align-items:center; gap:10px; }
    .picked small { flex:1; }
    .link { min-height:44px; border:0; background:none; color:var(--flow-teal); font:inherit; font-weight:700; }
    .row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .line { display:grid; gap:8px; padding-bottom:12px; border-bottom:1px solid var(--flow-line); }
    .line-head { display:flex; justify-content:space-between; align-items:center; }
    .line-head button { width:48px; height:48px; border:0; background:none; color:var(--flow-clay); }
    .units, .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(0,1fr)); gap:8px; }
    .units button, .tiles button { min-height:52px; border:1px solid var(--flow-line); border-radius:12px; background:#fff; color:var(--flow-ink); font:inherit; font-size:16px; font-weight:700; }
    .tiles.small button { min-height:44px; font-size:14px; }
    .units .on, .tiles .on { border:2px solid var(--flow-teal); background:var(--flow-teal-soft); color:var(--flow-teal); }
    .primary, .secondary { min-height:52px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; font:inherit; font-size:16px; font-weight:800; text-decoration:none; }
    .primary { border:0; background:var(--flow-teal); color:#fff; }
    .primary:disabled { opacity:.5; }
    .secondary { border:1px solid var(--flow-line); background:#fff; color:var(--flow-ink); }
    .bar { position:fixed; inset:auto 0 64px 0; z-index:4; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; border-top:1px solid var(--flow-line); background:#fff; }
    .bar div { display:grid; }
    .bar strong { font-size:20px; }
    .bar .primary { min-width:160px; }
    @media (min-width:600px) { .bar { position:sticky; bottom:0; inset:auto; border:1px solid var(--flow-line); border-radius:var(--flow-radius); } }
    .done { justify-items:center; text-align:center; }
    .done lucide-icon { color:var(--flow-teal); }
    .done p { margin:0; color:var(--flow-ink-soft); }
    .done .primary, .done .secondary { width:100%; box-sizing:border-box; }
    .notice { margin:0; padding:12px; border-radius:10px; }
    .notice.error { background:var(--flow-clay-soft); color:var(--flow-clay); }
    .hint { margin:0; color:var(--flow-ink-soft); }
  `],
})
export class FlowSaleComponent implements OnInit {
  private readonly sales = inject(SalesService);
  private readonly customersService = inject(CustomersService);
  private readonly stock = inject(InventoryService);
  private readonly khata = inject(KhataService);
  private readonly queue = inject(OfflineQueueService);

  protected readonly icons = { ArrowLeft, CheckCircle2, MessageCircle, Plus, Search, Trash2, UserPlus };
  protected readonly modes = MODES;
  protected readonly methods = METHODS;
  protected readonly customers = signal<Customer[]>([]);
  protected readonly inventory = signal<InventoryItem[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly cart = signal<CartLine[]>([]);
  protected readonly mode = signal<PaymentMode>('CASH');
  protected readonly method = signal<PaymentMethod>('CASH');
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly done = signal<SaleDetail | null>(null);
  protected readonly message = signal('');
  protected customerSearch = '';
  protected itemSearch = '';
  protected newName = '';
  protected newPhone = '';
  protected paidAmount: number | null = null;
  /** A retry after a network error reuses the key, so the sale is not saved twice. */
  private idempotencyKey = crypto.randomUUID();

  /** Recomputed on every check: quantity and price are edited in place on the cart lines. */
  protected total(): number {
    return this.cart().reduce((sum, l) => sum + (l.quantity || 0) * (l.unitPrice || 0), 0);
  }

  ngOnInit(): void {
    this.customersService.list({ isActive: true }).subscribe((items) => this.customers.set(items));
    this.loadStock();
  }

  protected matchingCustomers(): Customer[] {
    const q = this.customerSearch.trim().toLowerCase();
    const list = q ? this.customers().filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)) : this.customers();
    return list.slice(0, 8);
  }

  protected matchingStock(): InventoryItem[] {
    const q = this.itemSearch.trim().toLowerCase();
    const inCart = new Set(this.cart().map((l) => l.item.id));
    return this.inventory()
      .filter((i) => !inCart.has(i.id) && (!q || this.itemName(i).toLowerCase().includes(q)))
      .slice(0, 12);
  }

  protected itemName(item: InventoryItem): string {
    const kind = item.name || [item.category?.name, item.grade?.name].filter(Boolean).join(' ') || 'Stock';
    const tier = item.priceTier ? ` (${item.priceTier})` : '';
    return item.unitCode ? `${kind}${tier} · ${item.unitCode}` : `${kind}${tier}`;
  }

  protected unitName(unit: StockUnit, count = 2): string {
    const one = { KG: 'kg', BALE: 'bale', PIECE: 'piece' }[unit];
    return count === 1 || unit === 'KG' ? one : `${one}s`;
  }

  protected startAdding(): void {
    this.newName = this.customerSearch.trim();
    this.newPhone = '';
    this.adding.set(true);
  }

  protected async addCustomer(): Promise<void> {
    this.saving.set(true);
    const body = { name: this.newName.trim(), phone: this.newPhone.trim() };
    try {
      const r = await this.queue.send<Customer>({ kind: 'customer', label: body.name, url: '/api/customers', body });
      // Offline: a stand-in customer; the sale refers to the queued customer and gets its id on sync.
      const c = r.saved ? r.response : ({ id: `local:${r.id}`, name: body.name, phone: body.phone } as Customer);
      this.saving.set(false);
      this.adding.set(false);
      this.customers.update((list) => [c, ...list]);
      this.pickCustomer(c);
    } catch (e) {
      this.fail(e);
    }
  }

  protected pickCustomer(c: Customer): void {
    this.customer.set(c);
    this.message.set('');
    for (const line of this.cart()) this.suggestPrice(line);
  }

  protected addItem(item: InventoryItem): void {
    const line: CartLine = { item, unit: item.unit, quantity: item.unit === 'KG' ? null : 1, unitPrice: null };
    this.cart.update((c) => [...c, line]);
    this.suggestPrice(line);
  }

  protected remove(line: CartLine): void {
    this.cart.update((c) => c.filter((l) => l !== line));
  }

  protected setUnit(line: CartLine, unit: StockUnit): void {
    line.unit = unit;
    line.quantity = unit === 'KG' ? Number(line.item.weightKg) / Number(line.item.quantity) : 1;
    line.unitPrice = null;
    this.cart.update((c) => [...c]);
    this.suggestPrice(line);
  }

  protected canSave(): boolean {
    const linesOk = this.cart().length > 0 && this.cart().every((l) => (l.quantity || 0) > 0 && (l.unitPrice ?? -1) >= 0);
    const paidOk = this.mode() !== 'PARTIAL' || ((this.paidAmount || 0) > 0 && (this.paidAmount || 0) < this.total());
    return !!this.customer() && linesOk && paidOk;
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.message.set('');
    const c = this.customer()!;
    const body = {
      customerId: c.id.startsWith('local:') ? this.queue.ref(c.id.slice(6)) : c.id,
      paymentMode: this.mode(),
      ...(this.mode() === 'PARTIAL' ? { paidAmount: this.paidAmount! } : {}),
      ...(this.mode() !== 'CREDIT' ? { paymentMethod: this.method() } : {}),
      lines: this.cart().map((l) => ({ inventoryItemId: l.item.id, unit: l.unit, quantity: l.quantity!, unitPrice: l.unitPrice! })),
    };
    try {
      const r = await this.queue.send<SaleDetail>({
        kind: 'sale',
        label: `${c.name} · Rs ${this.total().toLocaleString()}`,
        url: '/api/sales',
        id: this.idempotencyKey,
        body,
      });
      this.saving.set(false);
      if (r.saved) this.done.set(r.response);
      else {
        this.reset();
        this.message.set('Sale saved on phone. It will sync when you are online.');
      }
    } catch (e) {
      this.fail(e);
    }
  }

  protected share(sale: SaleDetail): void {
    this.khata.openWhatsapp(this.khata.billMessage(sale.id), (e) => this.fail(e));
  }

  protected reset(): void {
    this.done.set(null);
    this.customer.set(null);
    this.cart.set([]);
    this.mode.set('CASH');
    this.paidAmount = null;
    this.idempotencyKey = crypto.randomUUID();
    this.loadStock();
  }

  private suggestPrice(line: CartLine): void {
    const c = this.customer();
    if (!c) return;
    this.sales.lastPrice(c.id, line.item.id, line.unit).subscribe((price) => {
      if (line.unitPrice === null && price.unitPrice !== null) {
        line.unitPrice = Number(price.unitPrice);
        this.cart.update((list) => [...list]);
      }
    });
  }

  private loadStock(): void {
    this.stock.getAll({ status: 'AVAILABLE', limit: 200 }).subscribe({
      next: (page) => this.inventory.set(page.items || []),
      error: () => this.message.set('Stock could not be loaded.'),
    });
  }

  private fail(e: any): void {
    this.saving.set(false);
    this.message.set(e?.error?.message || 'Could not save. Please try again.');
  }
}
