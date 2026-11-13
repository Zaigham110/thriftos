import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, dayStart, methodLabel, MoneyPipe, Sale, today } from '../core';
import { Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';

interface Day {
  summary: { bills: number; total: string; returned: string; credit: string; profit?: string; byMethod: Record<string, string> };
  sales: Sale[];
}

/** The day's bills, bills still waiting on this device, and offline bills the owner should look at. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon],
  template: `
    <div class="screen">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1>Bills</h1>
        <input class="input w-auto" type="date" [ngModel]="day()" (ngModelChange)="day.set($event); load()" [max]="max" aria-label="Day" />
      </div>
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
    </div>
  `,
})
export class BillsPage implements OnInit {
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

  ngOnInit() {
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
