import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Customer, Method, METHODS, money, MoneyPipe, typed, whatsapp } from '../core';
import { Printer } from '../hardware/printer';
import { when } from '../hardware/receipt';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

interface Entry {
  id: string;
  kind: 'OPENING' | 'SALE' | 'PAYMENT' | 'RETURN' | 'CANCEL' | 'ADJUST';
  amount: string;
  balanceAfter: string;
  method: Method | null;
  saleId: string | null;
  note: string | null;
  createdAt: string;
}
type Detail = Customer & { entries: Entry[] };
const KIND: Record<Entry['kind'], string> = { OPENING: 'Old balance', SALE: 'Bought on credit', PAYMENT: 'Paid', RETURN: 'Return', CANCEL: 'Bill cancelled', ADJUST: 'Corrected' };

/** One customer's khata: what they owe, every line that changed it, and taking a payment. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/customers" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Khata</a>
      @if (data(); as c) {
        <h1>{{ c.name }}</h1>
        <p class="text-sm text-stone-500">{{ c.phone || 'No phone' }}{{ c.creditLimit ? ' · limit ' + fmt(c.creditLimit) : '' }}</p>

        <div class="mt-4 rounded-3xl p-5 text-white" [class]="+c.balance > 0 ? 'bg-brand-950' : 'bg-pay-700'">
          <div class="text-xs font-semibold uppercase tracking-widest opacity-70">{{ +c.balance > 0 ? 'Owes the shop' : +c.balance < 0 ? 'The shop owes' : 'Khata is clear' }}</div>
          <div class="num text-4xl font-extrabold tracking-tight">{{ abs(c.balance) | money }}</div>
          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button class="btn bg-white text-stone-900" (click)="start(c)"><pos-icon name="wallet" /> Receive payment</button>
            <a class="btn bg-white/15 text-white" [href]="wa(c)" target="_blank" rel="noopener">Remind on WhatsApp</a>
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="btn-soft flex-1" (click)="print(c)"><pos-icon name="print" /> Print statement</button>
          @if (api.isManager()) { <button class="btn-soft flex-1" (click)="adjust(c)">Correct the balance</button> }
        </div>

        <h2 class="mb-2 mt-6">Khata lines</h2>
        <div class="card divide-y divide-stone-100">
          @for (e of c.entries; track e.id) {
            <div class="flex items-center justify-between gap-3 px-4 py-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold">{{ kind[e.kind] }}{{ e.method ? ' · ' + method(e.method) : '' }}</div>
                <div class="truncate text-xs text-stone-500">{{ e.createdAt | date: 'd MMM y, h:mm a' }}{{ e.note ? ' · ' + e.note : '' }}</div>
              </div>
              <div class="text-right">
                <div class="num font-bold" [class]="+e.amount > 0 ? 'text-amber-800' : 'text-pay-700'">{{ +e.amount > 0 ? '+' : '-' }}{{ abs(e.amount) | money }}</div>
                <div class="num text-xs text-stone-500">Balance {{ e.balanceAfter | money }}</div>
              </div>
            </div>
          } @empty {
            <p class="px-4 py-8 text-center text-sm text-stone-500">Nothing on this khata yet.</p>
          }
        </div>
      } @else if (error()) {
        <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p>
      }
    </div>

    @if (paying()) {
      <pos-sheet heading="Receive payment" (closed)="paying.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="pay()">
          <div><label class="label" for="a">Amount received</label><input id="a" class="input num text-2xl font-bold" name="amount" inputmode="decimal" [(ngModel)]="amount" autofocus /></div>
          <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Received by">
            @for (m of methods; track m.key) {
              <button type="button" class="chip justify-center" [class.chip-on]="by === m.key" (click)="by = m.key" role="radio" [attr.aria-checked]="by === m.key">{{ m.short }}</button>
            }
          </div>
          <input class="input" name="note" [(ngModel)]="note" placeholder="Note (optional)" aria-label="Note" />
          <button class="btn-pay" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save payment' }}</button>
        </form>
      </pos-sheet>
    }
  `,
})
export class CustomerPage implements OnInit {
  readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  private readonly printer = inject(Printer);
  private readonly ask = inject(Ask);
  readonly id = input.required<string>();
  readonly data = signal<Detail | null>(null);
  readonly error = signal('');
  readonly paying = signal(false);
  readonly busy = signal(false);
  readonly methods = METHODS;
  readonly kind = KIND;
  readonly fmt = money;
  readonly abs = (v: string) => Math.abs(+v);
  readonly method = (m: Method) => METHODS.find((x) => x.key === m)?.short ?? m;
  amount = '';
  by: Method = 'CASH';
  note = '';

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.data.set(await this.api.get<Detail>(`/customers/${this.id()}`));
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }

  start(c: Detail) {
    this.amount = +c.balance > 0 ? String(+c.balance) : '';
    this.by = 'CASH';
    this.note = '';
    this.paying.set(true);
  }

  async pay() {
    if (typed(this.amount) <= 0) return this.api.say('Type the amount received.', true);
    this.busy.set(true);
    try {
      await this.api.post(`/customers/${this.id()}/payments`, { amount: typed(this.amount), method: this.by, note: this.note, tillId: this.api.till()?.id });
      this.paying.set(false);
      this.api.say('Payment saved.');
      if (this.by === 'CASH') void this.printer.drawer().catch(() => undefined);
      await this.load();
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  async adjust(c: Detail) {
    const answer = await this.ask.fields('Correct the balance', `The khata says ${c.name} owes ${money(c.balance)}. Type what is really owed now; the reason is kept on the khata.`, [
      { key: 'balance', label: 'Really owes now', value: String(+c.balance), numeric: true },
      { key: 'note', label: 'Why it is being corrected', placeholder: 'Old payment was not written' },
    ]);
    if (!answer) return;
    const { balance, note } = answer;
    try {
      await this.api.post(`/customers/${this.id()}/adjust`, { balance, note });
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  wa(c: Detail): string {
    const shop = this.api.shop()?.name ?? '';
    return whatsapp(c.phone, +c.balance > 0 ? `Assalam o alaikum ${c.name}. Your balance at ${shop} is ${money(c.balance)}. Thank you.` : `Assalam o alaikum ${c.name}. Your khata at ${shop} is clear. Thank you.`);
  }

  async print(c: Detail) {
    const rows: ([string, string] | null)[] = [...c.entries].reverse().map((e) => [`${when(e.createdAt).slice(0, 10)} ${KIND[e.kind]}`, `${+e.amount > 0 ? '+' : '-'}${Math.abs(+e.amount).toLocaleString('en-US')}`]);
    try {
      await this.printer.report(this.api.shop()?.name ?? 'Khata', [`Khata of ${c.name}`, c.phone ?? '', when(new Date().toISOString())].filter(Boolean), [...rows, null, ['Balance', money(c.balance)]]);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
}
