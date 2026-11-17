import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, dayStart, methodLabel, MoneyPipe, Sale, today } from '../core';
import { CameraScan } from '../hardware/camera-scan';
import { Scanner } from '../hardware/scanner';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

interface Day {
  summary: { bills: number; total: string; returned: string; credit: string; profit?: string; byMethod: Record<string, string> };
  sales: Sale[];
}

interface Returned {
  summary: { returns: number; total: string; byRefund: Record<string, string> };
  returns: { id: string; code: string; total: string; refundTo: string; reason: string | null; createdAt: string; items: number; userName: string; sale: { id: string; code: string; customerName: string | null }; exchangeSale: { id: string; code: string } | null }[];
}
/** A bill line that sold the goods the customer brought back without a bill. */
interface Sold {
  id: string;
  kind: string;
  description: string;
  left: number;
  unitPrice: string;
  bale: { code: string; kindCode: string | null } | null;
  sale: { id: string; code: string; soldAt: string; customerName: string | null; customerPhone: string | null };
}

/** The day's bills, bills still waiting on this device, and offline bills the owner should look at. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon, Sheet, CameraScan],
  template: `
    <div class="screen">
      <div class="flex flex-wrap items-center justify-between gap-3">
 <h1>Bills</h1>
        <div class="flex flex-wrap items-center gap-2">
          @if (api.isManager()) { <button class="btn-primary min-h-[44px]" (click)="startFinder()"><pos-icon name="swap" /> Take a return</button> }
          <input class="input w-auto" type="date" [ngModel]="day()" (ngModelChange)="day.set($event); load(); tab() === 'returns' && loadReturns()" [max]="max" aria-label="Day" />
        </div>
      </div>
      @if (api.isManager()) {
        <div class="scroll-x mt-3" role="tablist">
          <button class="chip" [class.chip-on]="tab() === 'bills'" (click)="tab.set('bills')" role="tab" [attr.aria-selected]="tab() === 'bills'">Bills</button>
          <button class="chip" [class.chip-on]="tab() === 'returns'" (click)="tab.set('returns'); loadReturns()" role="tab" [attr.aria-selected]="tab() === 'returns'">Returns</button>
        </div>
      }
      @if (tab() === 'returns') {
        @if (returned(); as r) {
          <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="stat"><div class="stat-label">Returns</div><div class="stat-value">{{ r.summary.returns }}</div></div>
            <div class="stat"><div class="stat-label">Worth</div><div class="stat-value">{{ r.summary.total | money }}</div></div>
            <div class="stat"><div class="stat-label">Cash given back</div><div class="stat-value">{{ r.summary.byRefund['CASH'] | money }}</div></div>
            <div class="stat"><div class="stat-label">Exchanged</div><div class="stat-value">{{ r.summary.byRefund['EXCHANGE'] | money }}</div></div>
          </div>
          <div class="card mt-4 divide-y divide-stone-100">
            @for (x of r.returns; track x.id) {
              <a [routerLink]="['/bills', x.sale.id]" class="row">
                <span class="min-w-0 flex-1"><span class="num block font-semibold">{{ x.code }} <span class="font-normal text-stone-500">on {{ x.sale.code }}</span></span><span class="block truncate text-xs text-stone-500">{{ x.createdAt | date: 'h:mm a' }} · {{ x.items }} {{ x.items === 1 ? 'item' : 'items' }} · {{ x.refundTo === 'EXCHANGE' ? 'exchanged' + (x.exchangeSale ? ' for ' + x.exchangeSale.code : '') : 'back to ' + label(x.refundTo).toLowerCase() }} · {{ x.userName }}{{ x.reason ? ' · ' + x.reason : '' }}</span></span>
                <span class="num text-base font-bold">{{ x.total | money }}</span>
                <pos-icon name="right" class="text-stone-300" />
              </a>
            } @empty {
              <p class="px-4 py-10 text-center text-sm text-stone-500">No returns on this day.</p>
            }
          </div>
        }
      } @else {
      <input class="input mt-3" type="search" [ngModel]="search()" (ngModelChange)="search.set($event); later()" placeholder="Find a bill by number, customer or phone (any day)" aria-label="Search bills" />

      @if (waiting().length) {
        <h2 class="mb-2 mt-5 flex items-center gap-2 text-amber-900"><pos-icon name="cloudOff" /> Waiting on this device</h2>
        <div class="card divide-y divide-stone-100 border-amber-200">
          @for (w of waiting(); track w.key) {
            <div class="px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <a [routerLink]="['/bills', 'waiting:' + w.key]" class="min-w-0"><span class="num block font-semibold text-brand-700">{{ w.sale.code }}</span><span class="block text-xs text-stone-500">{{ w.sale.soldAt | date: 'd MMM, h:mm a' }} · not on the server yet</span></a>
                <span class="num font-bold">{{ w.sale.total | money }}</span>
              </div>
              @if (w.error) {
                <p class="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">The server would not save it: {{ w.error }}</p>
                <div class="mt-2 flex gap-2"><button class="btn-soft min-h-[40px]" (click)="shelf.retry(w.key)">Try again</button><button class="btn-danger min-h-[40px]" (click)="discard(w.key, w.sale.code)">Remove</button></div>
              }
            </div>
          }
        </div>
      }

      @if (review().length) {
        <h2 class="mb-2 mt-5 text-red-800">Offline bills to check</h2>
        <div class="card divide-y divide-stone-100 border-red-200">
          @for (s of review(); track s.id) {
            <a [routerLink]="['/bills', s.id]" class="row"><span class="min-w-0 flex-1"><span class="num block font-semibold text-brand-700">{{ s.code }}</span><span class="block truncate text-xs text-red-800">{{ s.reviewNote }}</span></span><span class="num font-bold">{{ s.total | money }}</span></a>
          }
        </div>
      }

      @if (data(); as d) {
        @if (!search()) {
          <div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="stat"><div class="stat-label">Bills</div><div class="stat-value">{{ d.summary.bills }}</div></div>
            <div class="stat"><div class="stat-label">Sales</div><div class="stat-value">{{ d.summary.total | money }}</div></div>
            <div class="stat"><div class="stat-label">Cash · Bank · Wallet</div><div class="num mt-1 text-sm font-semibold leading-relaxed">{{ d.summary.byMethod['CASH'] | money }}<br />{{ d.summary.byMethod['BANK'] | money }} · {{ d.summary.byMethod['WALLET'] | money }}</div></div>
            @if (d.summary.profit !== undefined) {
              <div class="stat"><div class="stat-label">Profit</div><div class="stat-value text-pay-700">{{ d.summary.profit | money }}</div></div>
            } @else {
              <div class="stat"><div class="stat-label">On khata</div><div class="stat-value">{{ d.summary.credit | money }}</div></div>
            }
          </div>
        }
        <div class="card mt-4 divide-y divide-stone-100">
          @for (s of d.sales; track s.id) {
            <a [routerLink]="['/bills', s.id]" class="row">
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-2"><span class="num font-semibold">{{ s.code }}</span>
                  @if (s.status === 'CANCELLED') { <span class="tag bg-red-50 text-red-800">Cancelled</span> }
                  @if (+s.returnedTotal > 0) { <span class="tag bg-amber-50 text-amber-800">Returned {{ s.returnedTotal | money }}</span> }
                  @if (+s.creditAmount > 0) { <span class="tag bg-amber-50 text-amber-800">Khata {{ s.creditAmount | money }}</span> }
                  @if (s.madeOffline) { <span class="tag bg-stone-100 text-stone-600">Offline</span> }
                </span>
                <span class="block truncate text-xs text-stone-500">{{ s.soldAt | date: (search() ? 'd MMM, h:mm a' : 'h:mm a') }} · {{ s.customerName || 'Walk-in' }} · {{ paidBy(s) }} · {{ s.user?.name }}</span>
              </span>
              <span class="num text-base font-bold" [class.line-through]="s.status === 'CANCELLED'">{{ s.total | money }}</span>
              <pos-icon name="right" class="text-stone-300" />
            </a>
          } @empty {
            <p class="px-4 py-10 text-center text-sm text-stone-500">{{ search() ? 'No bill matches "' + search() + '".' : 'No bills on this day.' }}</p>
          }
        </div>
      } @else if (error()) {
        <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p>
      }
      }
    </div>

    @if (finder()) {
      <pos-sheet heading="Take a return" (closed)="closeFinder()">
        <p class="-mt-1 text-sm text-stone-600">Scan the bill, or type its number. No bill? Scan the sticker on the goods instead.</p>
        <form class="mt-3 flex gap-2" (ngSubmit)="find(code)">
          <input class="input min-w-0 flex-1" name="code" [(ngModel)]="code" placeholder="T1-000123, or the code on the goods" aria-label="Bill number or code on the goods" autocomplete="off" autofocus data-scan-through />
          <button type="button" class="icon-btn h-[48px] w-[48px] shrink-0 border border-stone-300 bg-white" (click)="camera.set(true)" aria-label="Scan with the camera"><pos-icon name="camera" /></button>
          <button class="btn-primary min-h-[48px] shrink-0 px-4" [disabled]="finding()">{{ finding() ? '…' : 'Find' }}</button>
        </form>
        @if (problem()) { <p class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{{ problem() }}</p> }
        @if (sold().length) {
          <h2 class="mb-1 mt-4 text-sm">Bills that sold these goods</h2>
          <p class="text-xs text-stone-500">Choose the customer's bill. Ask when they bought it; the newest is first.</p>
          <div class="-mx-5 mt-2 max-h-[46vh] divide-y divide-stone-100 overflow-y-auto border-y border-stone-100">
            @for (l of sold(); track l.id) {
              <button class="flex min-h-[60px] w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-stone-50" (click)="choose(l)">
                <span class="min-w-0"><span class="block truncate font-semibold">{{ l.sale.soldAt | date: 'd MMM y, h:mm a' }} · {{ l.sale.customerName || 'Walk-in' }}</span><span class="num block truncate text-xs text-stone-500">{{ l.sale.code }} · {{ l.description }} · {{ l.left }} can come back{{ l.bale && l.bale.code !== l.bale.kindCode ? ' · bale ' + l.bale.code : '' }}</span></span>
                <span class="num shrink-0 font-bold">{{ l.unitPrice | money }}</span>
              </button>
            }
          </div>
        }
      </pos-sheet>
    }
    @if (camera()) {
      <pos-camera-scan (closed)="camera.set(false)" (scanned)="camera.set(false); find($event)" />
    }
  `,
})
export class BillsPage implements OnInit, OnDestroy {
  readonly api = inject(Api);
  readonly shelf = inject(Shelf);
  private readonly ask = inject(Ask);
  readonly max = today();
  readonly day = signal(today());
  readonly search = signal('');
  readonly data = signal<Day | null>(null);
  readonly review = signal<Sale[]>([]);
  readonly error = signal('');
  readonly waiting = computed(() => this.shelf.waiting().filter((w) => w.type === 'sale').map((w) => ({ key: w.key, error: w.error, sale: w.sale as Sale })));
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly router = inject(Router);
  private readonly scanner = inject(Scanner);
  private stop: (() => void) | undefined;
  readonly label = methodLabel;
  /** From the till's Return button: /bills?take=1 opens the finder at once. */
  readonly take = input<string>();
  readonly tab = signal<'bills' | 'returns'>('bills');
  readonly returned = signal<Returned | null>(null);
  readonly finder = signal(false);
  readonly finding = signal(false);
  readonly camera = signal(false);
  readonly problem = signal('');
  readonly sold = signal<Sold[]>([]);
  code = '';

  ngOnDestroy() {
    this.stop?.();
  }

  startFinder() {
    this.code = '';
    this.problem.set('');
    this.sold.set([]);
    this.finder.set(true);
    // A scanned bill or sticker goes straight to the search while this sheet is open.
    this.stop ??= this.scanner.listen((scanned) => void this.find(scanned));
  }
  closeFinder() {
    this.finder.set(false);
    this.stop?.();
    this.stop = undefined;
  }

  /** A bill number opens that bill's return sheet. Anything else is taken as the code on the goods. */
  async find(raw: string) {
    const code = raw.trim();
    if (!code || this.finding()) return;
    this.code = code;
    this.finding.set(true);
    this.problem.set('');
    this.sold.set([]);
    try {
      const bills = (await this.api.get<Day>('/sales', { search: code })).sales.filter((s) => s.code.toLowerCase() === code.toLowerCase());
      if (bills.length === 1) {
        if (bills[0].status === 'CANCELLED') return this.problem.set(`Bill ${bills[0].code} was cancelled.`);
        this.closeFinder();
        return void this.router.navigate(['/bills', bills[0].id], { queryParams: { take: 1 } });
      }
      const lines = await this.api.get<Sold[]>(`/sales/by-goods/${encodeURIComponent(code)}`);
      if (!lines.length) return this.problem.set(`No bill has the number "${code}", and no bill in this branch sold goods with that code (or they already came back).`);
      this.sold.set(lines);
    } catch (e) {
      this.problem.set(this.api.why(e));
    } finally {
      this.finding.set(false);
    }
  }
  choose(l: Sold) {
    this.closeFinder();
    void this.router.navigate(['/bills', l.sale.id], { queryParams: { take: 1, line: l.id } });
  }

  async loadReturns() {
    try {
      this.returned.set(await this.api.get<Returned>('/sales/returns', { from: dayStart(this.day()), to: dayStart(this.day(), 1) }));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  ngOnInit() {
    if (this.take() && this.api.isManager()) this.startFinder();
    void this.load();
    if (this.api.isManager()) void this.api.get<Day>('/sales', { review: '1' }).then((d) => this.review.set(d.sales)).catch(() => undefined);
  }

  later() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(), 250);
  }

  async load() {
    try {
      this.data.set(await this.api.get<Day>('/sales', { from: dayStart(this.day()), to: dayStart(this.day(), 1), search: this.search().trim() }));
      this.error.set('');
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }

  paidBy(s: Sale) {
    const ways = [...new Set((s.payments ?? []).map((p) => methodLabel(p.method)))];
    return ways.length ? ways.join(' + ') : +s.creditAmount > 0 ? 'Khata' : '—';
  }

  async discard(key: string, code: string) {
    if (await this.ask.confirm(`Remove bill ${code}?`, 'It was never saved on the shop server. Removing it from this device loses it for good.', 'Remove the bill', true)) void this.shelf.discard(key);
  }
}
