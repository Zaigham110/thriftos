import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, billRows, methodLabel, money, MoneyPipe, round2, Sale, SaleLine, shownCode, whatsapp } from '../core';
import { keepExchange } from '../exchange';
import { Printer } from '../hardware/printer';
import { receiptModel, receiptText } from '../hardware/receipt';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

/** One bill: see it, print it again, send it on WhatsApp, take a return, or cancel it. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/bills" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Bills</a>
      @if (sale(); as s) {
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="num">{{ s.code }}</h1>
          @if (s.status === 'CANCELLED') { <span class="tag bg-red-50 text-red-800">Cancelled</span> }
          @if (s.waiting) { <span class="tag bg-amber-50 text-amber-800">Waiting to be sent</span> }
          @if (s.madeOffline && !s.waiting) { <span class="tag bg-stone-100 text-stone-600">Made offline</span> }
        </div>
        <p class="text-sm text-stone-500">{{ s.soldAt | date: 'd MMM y, h:mm a' }} · {{ s.user?.name }} · {{ s.customerName || 'Walk-in customer' }}</p>

        @if (s.needsReview) {
          <div class="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <div class="font-semibold">This bill was made offline and did not fit when it reached the server.</div>
            <p class="mt-1">{{ s.reviewNote }}</p>
            @if (api.isManager()) {
              <button class="btn-soft mt-3 min-h-[40px]" (click)="reviewed(s)">I have checked it</button>
            }
          </div>
        }
        @if (s.status === 'CANCELLED' && s.cancelReason) {
          <p class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Cancelled: {{ s.cancelReason }}</p>
        }

        <div class="card mt-4 overflow-hidden">
          <div class="divide-y divide-stone-100">
            <!-- Whole bales of one kind at one price are one row with a quantity; the bales behind it are named below. -->
            @for (r of rows(s); track $index) {
              <div class="flex items-start justify-between gap-3 px-4 py-3">
                <div class="min-w-0">
                  <div class="font-semibold">{{ r.name }}</div>
                  <div class="text-xs text-stone-500">{{ r.code ? r.code + ' · ' : '' }}{{ r.kind === 'BALE' && !r.key ? 'whole bale' : r.kind === 'BALE' ? '× ' + r.quantity + ' at ' + fmt(r.unitPrice) : r.quantity + ' × ' + fmt(r.unitPrice) }}{{ r.discount ? ' · less ' + fmt(r.discount) : '' }}</div>
                  @if (r.key && own(r.lines)) { <div class="num mt-0.5 truncate text-xs text-stone-400">{{ own(r.lines) }}</div> }
                  @if (returned(r.lines); as n) { <div class="mt-0.5 text-xs font-semibold text-amber-800">{{ r.kind === 'BALE' && r.quantity === 1 ? 'Returned' : n + ' returned' }}</div> }
                  @if (missing(r.lines); as n) { <div class="mt-0.5 text-xs font-semibold text-red-700">{{ r.lines.length === 1 ? 'Stock was already gone: nothing was taken off the shelf' : n + ' were not in stock: nothing was taken off the shelf for them' }}</div> }
                </div>
                <div class="num font-semibold">{{ r.total | money }}</div>
              </div>
            }
          </div>
          <div class="space-y-1 border-t border-stone-200 bg-stone-50 px-4 py-3 text-sm">
            @if (+s.discount || +s.taxAmount) { <div class="flex justify-between"><span class="text-stone-500">Subtotal</span><span class="num">{{ s.subtotal | money }}</span></div> }
            @if (+s.discount) { <div class="flex justify-between"><span class="text-stone-500">Discount</span><span class="num">-{{ s.discount | money }}</span></div> }
            @if (+s.taxAmount) { <div class="flex justify-between"><span class="text-stone-500">{{ s.taxName }} {{ +s.taxRate }}%{{ s.taxInclusive ? ' (included)' : '' }}</span><span class="num">{{ s.taxAmount | money }}</span></div> }
            <div class="flex items-baseline justify-between pt-1"><span class="text-base font-semibold">Total</span><span class="num text-2xl font-extrabold">{{ s.total | money }}</span></div>
            @for (p of s.payments; track $index) {
              <div class="flex justify-between"><span class="text-stone-500">{{ label(p.method) }}{{ p.reference ? ' · ' + p.reference : '' }}</span><span class="num">{{ p.amount | money }}</span></div>
            }
            @if (+(s.exchangeAmount ?? 0)) { <div class="flex justify-between"><span class="text-stone-500">Paid by goods brought back{{ s.exchangeOf ? ' (' + s.exchangeOf.code + ' on ' + s.exchangeOf.sale.code + ')' : '' }}</span><span class="num">{{ s.exchangeAmount | money }}</span></div> }
          @if (+s.changeGiven) { <div class="flex justify-between"><span class="text-stone-500">Change given back</span><span class="num">{{ s.changeGiven | money }}</span></div> }
            @if (+s.creditAmount) { <div class="flex justify-between font-semibold text-amber-800"><span>On khata</span><span class="num">{{ s.creditAmount | money }}</span></div> }
            @if (+s.returnedTotal) { <div class="flex justify-between font-semibold text-amber-800"><span>Returned</span><span class="num">-{{ s.returnedTotal | money }}</span></div> }
            @if (s.profit !== undefined && s.status === 'COMPLETED') { <div class="flex justify-between border-t border-stone-200 pt-1 font-semibold text-pay-700"><span>Profit</span><span class="num">{{ s.profit | money }}</span></div> }
          </div>
        </div>
        @if (s.note) { <p class="mt-3 text-sm text-stone-600">Note: {{ s.note }}</p> }

        @for (r of s.returns; track r.id) {
          <div class="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><span class="num font-semibold">{{ r.code }}</span> · {{ r.createdAt | date: 'd MMM, h:mm a' }} · {{ r.total | money }} {{ r.refundTo === 'EXCHANGE' ? 'exchanged for other goods' : 'back to ' + label(r.refundTo).toLowerCase() }}{{ r.reason ? ' · ' + r.reason : '' }} <button class="ml-1 font-semibold underline" (click)="slip(s, r)">Print slip</button></div>
        }

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn-primary" (click)="print(s)"><pos-icon name="print" /> Print</button>
          <a class="btn-soft" [href]="wa(s)" target="_blank" rel="noopener"><pos-icon name="receipt" /> WhatsApp</a>
          @if (api.isManager() && s.status === 'COMPLETED' && !s.waiting) {
            @if (canReturn(s)) { <button class="btn-soft" (click)="startReturn(s)"><pos-icon name="swap" /> Return</button> }
            @if (!+s.returnedTotal) { <button class="btn-danger" (click)="cancel(s)">Cancel bill</button> }
          }
        </div>
      } @else if (error()) {
        <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p>
      }
    </div>

    @if (returning(); as s) {
      <pos-sheet heading="What is coming back?" (closed)="returning.set(null)">
        <div class="-mx-5 divide-y divide-stone-100">
          @for (l of returnable(s); track l.id) {
            <div class="px-5 py-3">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0"><div class="truncate font-semibold">{{ l.description }}</div><div class="num text-xs text-stone-500">{{ l.bale ? code(l.bale) + (l.bale.kindCode ? ' · bale ' + l.bale.code : '') + ' · ' : '' }}{{ l.quantity - l.returnedQty }} can come back</div></div>
                <div class="flex shrink-0 items-center rounded-xl bg-stone-100">
                  <button class="flex h-11 w-10 items-center justify-center" (click)="qty(l, -1)" [attr.aria-label]="'One less of ' + l.description"><pos-icon name="minus" size="h-4 w-4" /></button>
                  <span class="num w-8 text-center font-bold">{{ back()[l.id] || 0 }}</span>
                  <button class="flex h-11 w-10 items-center justify-center" (click)="qty(l, 1)" [attr.aria-label]="'One more of ' + l.description"><pos-icon name="plus" size="h-4 w-4" /></button>
                </div>
              </div>
              @if (back()[l.id] && l.kind !== 'ITEM') {
                <label class="mt-2 flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5 accent-brand-600" [checked]="!damaged()[l.id]" (change)="damage(l.id, !$any($event.target).checked)" /> Good to sell again: put it back on the shelf</label>
              }
            </div>
          }
        </div>
        <label class="label mt-3" for="rt">Give the money back as</label>
        <select id="rt" class="input" [(ngModel)]="refundTo">
          <option value="CASH">Cash</option><option value="BANK">Bank</option><option value="WALLET">Easypaisa / JazzCash</option>
          @if (s.customerId) { <option value="KHATA">Take it off {{ s.customerName }}'s khata</option> }
          <option value="EXCHANGE">No money back: exchange for other goods</option>
        </select>
        @if (refundTo === 'EXCHANGE') { <p class="hint">Next you choose the new goods on the till. The customer pays only the difference, or gets it back. Nothing is taken back until that bill is completed.</p> }
        <label class="label mt-3" for="rr">Reason</label>
        <input id="rr" class="input" [(ngModel)]="reason" placeholder="Wrong size, damaged…" />
        <div class="mt-3 flex items-baseline justify-between rounded-2xl bg-stone-100 px-4 py-3"><span class="font-semibold">{{ refundTo === 'EXCHANGE' ? 'Worth' : 'Give back' }}</span><span class="num text-2xl font-extrabold">{{ refund(s) | money }}</span></div>
        <button class="btn-big mt-3" [disabled]="busy() || !refund(s)" (click)="doReturn(s)">{{ busy() ? 'Saving…' : refundTo === 'EXCHANGE' ? 'Choose the new goods on the till' : 'Save the return' }}</button>
      </pos-sheet>
    }
  `,
})
export class BillPage implements OnInit {
  readonly code = shownCode;
  rows(s: Sale) {
    return billRows(s.lines ?? []);
  }
  /** The bales behind a row, by their own numbers. */
  own(lines: SaleLine[]) {
    return lines.map((l) => (l.bale && l.bale.code !== l.bale.kindCode ? l.bale.code : '')).filter(Boolean).join(', ');
  }
  returned(lines: SaleLine[]) {
    return lines.reduce((n, l) => n + l.returnedQty, 0);
  }
  missing(lines: SaleLine[]) {
    return lines.filter((l) => l.conflict).length;
  }
  readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  private readonly printer = inject(Printer);
  private readonly ask = inject(Ask);
  private readonly router = inject(Router);
  readonly id = input.required<string>();
  /** Opened from "Take a return": go straight to the return sheet, with this line already chosen. */
  readonly take = input<string>();
  readonly line = input<string>();
  readonly sale = signal<Sale | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly fmt = money;
  readonly label = methodLabel;

  readonly returning = signal<Sale | null>(null);
  readonly back = signal<Record<string, number>>({});
  readonly damaged = signal<Record<string, boolean>>({});
  refundTo = 'CASH';
  reason = '';

  readonly waitingSale = computed(() => this.shelf.waiting().find((w) => `waiting:${w.key}` === this.id())?.sale as Sale | undefined);

  async ngOnInit() {
    if (this.id().startsWith('waiting:')) {
      await this.shelf.start();
      const s = this.waitingSale();
      if (s) return this.sale.set(s);
      return void this.router.navigateByUrl('/bills'); // it has been sent meanwhile
    }
    try {
      const sale = await this.api.get<Sale>(`/sales/${this.id()}`);
      this.sale.set(sale);
      if (this.take() && this.api.isManager() && sale.status === 'COMPLETED' && this.canReturn(sale)) {
        this.startReturn(sale);
        const chosen = this.returnable(sale).find((l) => l.id === this.line());
        if (chosen) this.back.set({ [chosen.id]: 1 });
      }
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }

  returnable(s: Sale): SaleLine[] {
    return (s.lines ?? []).filter((l) => l.quantity - l.returnedQty > 0);
  }
  canReturn(s: Sale) {
    return this.returnable(s).length > 0;
  }
  startReturn(s: Sale) {
    this.back.set({});
    this.damaged.set({});
    this.reason = '';
    this.refundTo = +s.creditAmount > 0 && s.customerId ? 'KHATA' : 'CASH';
    this.returning.set(s);
  }
  qty(l: SaleLine, by: number) {
    const next = Math.min(Math.max((this.back()[l.id] ?? 0) + by, 0), l.quantity - l.returnedQty);
    this.back.update((b) => ({ ...b, [l.id]: next }));
  }
  damage(id: string, value: boolean) {
    this.damaged.update((d) => ({ ...d, [id]: value }));
  }
  /** Each piece carries its share of the bill's discount and tax, as on the server. */
  refund(s: Sale): number {
    const factor = +s.subtotal ? +s.total / +s.subtotal : 0;
    const sum = this.returnable(s).reduce((a, l) => a + ((+l.lineTotal * factor * (this.back()[l.id] ?? 0)) / l.quantity), 0);
    return Math.min(round2(sum), round2(+s.total - +s.returnedTotal));
  }

  async doReturn(s: Sale) {
    const lines = Object.entries(this.back()).filter(([, q]) => q > 0).map(([saleLineId, quantity]) => ({ saleLineId, quantity, restock: !this.damaged()[saleLineId] }));
    if (this.refundTo === 'EXCHANGE') {
      // Nothing is saved yet: the till makes the new bill and the server takes the goods back with it.
      const what = this.returnable(s).filter((l) => this.back()[l.id]).map((l) => `${this.back()[l.id]} × ${l.description}`).join(', ');
      keepExchange({ saleId: s.id, saleCode: s.code, lines, reason: this.reason, worth: this.refund(s), what });
      return void this.router.navigateByUrl('/');
    }
    this.busy.set(true);
    try {
      const res = await this.api.post<{ sale: Sale; code: string }>(`/sales/${s.id}/returns`, { lines, refundTo: this.refundTo, reason: this.reason, tillId: this.api.till()?.id });
      this.sale.set(res.sale);
      this.returning.set(null);
      this.api.say(`Return ${res.code} saved.`);
      const made = res.sale.returns?.find((r) => r.code === res.code);
      if (made && this.printer.config().receipt.auto) void this.slip(res.sale, made);
      if (this.refundTo === 'CASH') void this.printer.drawer().catch(() => undefined);
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(s: Sale) {
    const answer = await this.ask.fields(`Cancel bill ${s.code}?`, 'Everything on it goes back on the shelf, and its khata line is undone. This is kept in the owner\'s record.', [{ key: 'reason', label: 'Why it is being cancelled', placeholder: 'Wrong bill, customer changed mind…' }], 'Cancel the bill', true);
    if (!answer) return;
    const reason = answer['reason'];
    try {
      this.sale.set(await this.api.post<Sale>(`/sales/${s.id}/cancel`, { reason }));
      this.api.say('Bill cancelled. The stock is back on the shelf.');
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async reviewed(s: Sale) {
    try {
      this.sale.set(await this.api.post<Sale>(`/sales/${s.id}/reviewed`));
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  /** A slip for the customer (and the drawer): what came back and what was given for it. */
  async slip(s: Sale, r: NonNullable<Sale['returns']>[number]) {
    const lines = (r.lines ?? []).map((rl): [string, string] => {
      const line = s.lines?.find((l) => l.id === rl.saleLineId);
      return [`${rl.quantity} x ${line?.description ?? 'Item'}${line?.bale ? ' (' + shownCode(line.bale) + ')' : ''}`, money(rl.amount)];
    });
    try {
      await this.printer.report(
        this.api.shop()?.name ?? 'Return',
        [`Return ${r.code}`, `On bill ${s.code}`, new Date(r.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }), s.customerName ?? ''].filter(Boolean),
        [...lines, null, [r.refundTo === 'EXCHANGE' ? 'Exchanged for other goods' : `Given back: ${methodLabel(r.refundTo)}`, money(r.total)], ...(r.reason ? [['Reason', r.reason] as [string, string]] : [])],
      );
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async print(s: Sale) {
    try {
      await this.printer.receipt(s);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  wa(s: Sale): string {
    const shop = this.api.shop();
    return shop ? whatsapp(s.customerPhone, receiptText(receiptModel(s, shop, this.api.branch()))) : '#';
  }
}
