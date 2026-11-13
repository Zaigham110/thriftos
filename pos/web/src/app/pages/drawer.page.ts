import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, money, MoneyPipe, typed } from '../core';
import { Printer } from '../hardware/printer';
import { when } from '../hardware/receipt';
import { Shelf } from '../offline/shelf';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

interface Summary {
  bills: number;
  salesTotal: string;
  discount: string;
  tax: string;
  credit: string;
  cashSales: string;
  bankSales: string;
  walletSales: string;
  khataCash: string;
  khataOther: string;
  cashIn: string;
  cashOut: string;
  drops: string;
  cashRefunds: string;
  otherRefunds: string;
  cashExpenses: string;
  expectedCash: string;
  moves: { id: string; kind: 'IN' | 'OUT' | 'DROP'; amount: string; reason: string; userName: string; createdAt: string }[];
}
interface Shift {
  id: string;
  openedAt: string;
  openedByName: string;
  openingFloat: string;
  closedAt: string | null;
  closedByName: string | null;
  countedCash: string | null;
  expectedCash: string | null;
  difference: string | null;
  note: string | null;
  till?: { code: string; name: string };
  summary?: Summary;
}
const MOVE = { IN: 'Cash put in', OUT: 'Cash taken out', DROP: 'Taken to bank / owner' };

/** The cash drawer of this till: open it with the cash inside, record cash in and out, count and close. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>
      <h1>Cash drawer · {{ api.till()?.name }}</h1>

      @if (!loaded()) {
        <p class="mt-6 text-sm text-stone-500">Loading…</p>
      } @else if (shift(); as s) {
        <p class="text-sm text-stone-500">Opened {{ s.openedAt | date: 'd MMM, h:mm a' }} by {{ s.openedByName }} with {{ s.openingFloat | money }}</p>
        <div class="mt-4 rounded-3xl bg-brand-950 p-5 text-white">
          <div class="text-xs font-semibold uppercase tracking-widest text-brand-300">Cash that should be in the drawer</div>
          <div class="num text-4xl font-extrabold tracking-tight">{{ s.summary!.expectedCash | money }}</div>
          <div class="mt-4 grid grid-cols-3 gap-2">
            <button class="btn bg-white/15 px-2 text-white" (click)="move('IN')">Cash in</button>
            <button class="btn bg-white/15 px-2 text-white" (click)="move('OUT')">Cash out</button>
            <button class="btn bg-white/15 px-2 text-white" (click)="move('DROP')">To bank</button>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="btn-soft" (click)="noSale()"><pos-icon name="drawer" /> Open drawer</button>
          <button class="btn-primary" (click)="counted = ''; closing.set(true)">Count and close</button>
        </div>

        <div class="card mt-5 divide-y divide-stone-100 text-sm">
          @for (r of rows(s); track $index) {
            @if (r) {
              <div class="flex justify-between gap-3 px-4 py-2.5"><span class="text-stone-600">{{ r[0] }}</span><span class="num font-semibold">{{ r[1] }}</span></div>
            }
          }
        </div>
        @if (s.summary!.moves.length) {
          <h2 class="mb-2 mt-5">Cash in and out</h2>
          <div class="card divide-y divide-stone-100">
            @for (m of s.summary!.moves; track m.id) {
              <div class="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div><div class="font-semibold">{{ moveLabel[m.kind] }} · {{ m.reason }}</div><div class="text-xs text-stone-500">{{ m.createdAt | date: 'h:mm a' }} · {{ m.userName }}</div></div><div class="num font-bold">{{ m.kind === 'IN' ? '+' : '-' }}{{ m.amount | money }}</div></div>
            }
          </div>
        }
      } @else {
        <div class="card mt-4 p-5">
          <h2>Open the drawer for this shift</h2>
          <p class="mt-1 text-sm text-stone-600">Count the cash that is in the drawer now. Sales, cash in and out are added to it, so at closing you know what should be there.</p>
          <form class="mt-4 flex gap-2" (ngSubmit)="open()">
            <input class="input num text-xl font-bold" name="float" inputmode="decimal" [(ngModel)]="float" placeholder="Rs 0" aria-label="Cash in the drawer now" />
            <button class="btn-primary shrink-0" [disabled]="busy()">Open drawer</button>
          </form>
        </div>
        @if (last(); as l) {
          <h2 class="mb-2 mt-6">Last shift</h2>
          <div class="card p-4 text-sm">
            <div class="flex justify-between"><span class="text-stone-600">Closed {{ l.closedAt | date: 'd MMM, h:mm a' }} by {{ l.closedByName }}</span></div>
            <div class="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><div class="stat-label">Should be</div><div class="num font-bold">{{ l.expectedCash | money }}</div></div>
              <div><div class="stat-label">Counted</div><div class="num font-bold">{{ l.countedCash | money }}</div></div>
              <div><div class="stat-label">Difference</div><div class="num font-bold" [class]="+l.difference! < 0 ? 'text-red-700' : +l.difference! > 0 ? 'text-amber-700' : 'text-pay-700'">{{ l.difference | money }}</div></div>
            </div>
            <button class="btn-soft mt-3 w-full" (click)="print(l)"><pos-icon name="print" /> Print shift report</button>
          </div>
        }
      }
    </div>

    @if (moving(); as k) {
      <pos-sheet [heading]="moveLabel[k]" (closed)="moving.set(null)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="saveMove(k)">
          <div><label class="label" for="ma">Amount</label><input id="ma" class="input num text-2xl font-bold" name="amount" inputmode="decimal" [(ngModel)]="moveAmount" autofocus /></div>
          <div><label class="label" for="mr">What for</label><input id="mr" class="input" name="reason" [(ngModel)]="moveReason" [placeholder]="k === 'IN' ? 'Change brought from home' : k === 'OUT' ? 'Tea, loader, rickshaw' : 'Bank deposit'" /></div>
          <button class="btn-big" [disabled]="busy()">Save</button>
        </form>
      </pos-sheet>
    }

    @if (closing()) {
      <pos-sheet heading="Count and close" (closed)="closing.set(false)">
        <p class="-mt-1 text-sm text-stone-600">Count the cash in the drawer and type what you counted. The shop keeps the difference on record.</p>
        <form class="mt-3 grid grid-cols-1 gap-3" (ngSubmit)="close()">
          <div><label class="label" for="cc">Cash counted</label><input id="cc" class="input num text-2xl font-bold" name="counted" inputmode="decimal" [(ngModel)]="counted" autofocus /></div>
          @if (counted !== '') {
            <div class="flex items-baseline justify-between rounded-2xl px-4 py-3" [class]="diff() === 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'"><span class="font-semibold">{{ diff() === 0 ? 'Exactly right' : diff() < 0 ? 'Short by' : 'Over by' }}</span><span class="num text-2xl font-extrabold">{{ abs(diff()) | money }}</span></div>
          }
          <input class="input" name="note" [(ngModel)]="closeNote" placeholder="Note (optional)" aria-label="Note" />
          <button class="btn-big" [disabled]="busy() || counted === ''">{{ busy() ? 'Closing…' : 'Close the drawer' }}</button>
        </form>
      </pos-sheet>
    }
  `,
})
export class DrawerPage implements OnInit {
  readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  private readonly printer = inject(Printer);
  readonly shift = signal<Shift | null>(null);
  readonly last = signal<Shift | null>(null);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly moving = signal<'IN' | 'OUT' | 'DROP' | null>(null);
  readonly closing = signal(false);
  readonly moveLabel = MOVE;
  readonly abs = Math.abs;
  float = '';
  moveAmount = '';
  moveReason = '';
  counted = '';
  closeNote = '';

  diff(): number {
    return Math.round((typed(this.counted) - Number(this.shift()?.summary?.expectedCash ?? 0)) * 100) / 100;
  }

  ngOnInit() {
    void this.load();
  }

  private get till() {
    return this.api.till()?.id ?? '';
  }

  async load() {
    try {
      const s = await this.api.get<Shift | null>('/shifts/current', { tillId: this.till });
      this.shift.set(s && s.id ? s : null);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }

  rows(s: Shift): ([string, string] | null)[] {
    const m = s.summary!;
    const line = (label: string, v: string, sign = ''): [string, string] | null => (+v ? [label, `${sign}${money(v)}`] : null);
    return [
      ['Opening cash', money(s.openingFloat)],
      [`Sales (${m.bills} bills)`, money(m.salesTotal)],
      ['Cash sales', `+${money(m.cashSales)}`],
      line('Bank / card sales', m.bankSales),
      line('Easypaisa / JazzCash sales', m.walletSales),
      line('Sold on khata', m.credit),
      line('Khata received in cash', m.khataCash, '+'),
      line('Khata received by bank / wallet', m.khataOther),
      line('Cash put in', m.cashIn, '+'),
      line('Cash taken out', m.cashOut, '-'),
      line('Taken to bank / owner', m.drops, '-'),
      line('Expenses from the drawer', m.cashExpenses, '-'),
      line('Cash refunds', m.cashRefunds, '-'),
      line('Discounts given', m.discount),
      line('Tax collected', m.tax),
      ['Cash that should be in the drawer', money(m.expectedCash)],
    ];
  }

  async open() {
    this.busy.set(true);
    try {
      await this.api.post('/shifts/open', { tillId: this.till, openingFloat: typed(this.float) });
      this.float = '';
      await this.load();
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  move(kind: 'IN' | 'OUT' | 'DROP') {
    this.moveAmount = '';
    this.moveReason = '';
    this.moving.set(kind);
  }

  async saveMove(kind: 'IN' | 'OUT' | 'DROP') {
    if (typed(this.moveAmount) <= 0 || !this.moveReason.trim()) return this.api.say('Type the amount and what it is for.', true);
    this.busy.set(true);
    try {
      const sent = await this.shelf.cash(kind, typed(this.moveAmount), this.moveReason.trim());
      this.moving.set(null);
      this.api.say(sent ? 'Saved.' : 'Saved on this device. It will be sent when the shop server is back.');
      void this.printer.drawer().catch(() => undefined);
      if (sent) await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  async noSale() {
    try {
      const opened = await this.printer.drawer();
      await this.api.post('/shifts/no-sale', { reason: 'Opened from the drawer screen' });
      this.api.say(opened ? 'Drawer opened. This is kept in the owner\'s record.' : 'This device has no drawer connected. Set it up in Manage, Hardware.', !opened);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async close() {
    this.busy.set(true);
    try {
      const closed = await this.api.post<Shift>('/shifts/close', { tillId: this.till, countedCash: typed(this.counted), note: this.closeNote });
      this.closing.set(false);
      this.shift.set(null);
      this.last.set(closed);
      this.api.say('Drawer closed.');
      void this.shelf.refresh();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  async print(s: Shift) {
    const rows = this.rows(s).filter((r): r is [string, string] => !!r);
    try {
      await this.printer.report(this.api.shop()?.name ?? 'Shift report', [`Shift report · ${s.till?.name ?? ''}`, `${when(s.openedAt)} to ${s.closedAt ? when(s.closedAt) : 'now'}`, `Opened by ${s.openedByName}${s.closedByName ? `, closed by ${s.closedByName}` : ''}`], [
        ...rows,
        null,
        ['Counted', money(s.countedCash)],
        ['Difference', money(s.difference)],
      ]);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
}
