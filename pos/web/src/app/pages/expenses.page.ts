import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, dayStart, Method, METHODS, MoneyPipe, today, typed } from '../core';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

interface Expense {
  id: string;
  category: string;
  amount: string;
  method: Method;
  note: string | null;
  shiftId: string | null;
  userName: string;
  createdAt: string;
}
const COMMON = ['Rent', 'Salary', 'Electricity', 'Tea and food', 'Loader', 'Transport', 'Bags', 'Repair'];

/** What the shop spent. Cash expenses come out of this till's open drawer. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon, Sheet],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>
      <div class="flex items-center justify-between gap-3"><h1>Expenses</h1><button class="btn-primary" (click)="start()"><pos-icon name="plus" /> Add expense</button></div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <input class="input w-auto" type="date" [(ngModel)]="from" (ngModelChange)="load()" [max]="to" aria-label="From" />
        <span class="text-sm text-stone-500">to</span>
        <input class="input w-auto" type="date" [(ngModel)]="to" (ngModelChange)="load()" [min]="from" aria-label="To" />
      </div>
      <div class="stat mt-3"><div class="stat-label">Spent in these days</div><div class="stat-value">{{ total() | money }}</div></div>
      <div class="card mt-3 divide-y divide-stone-100">
        @for (e of list(); track e.id) {
          <div class="flex items-center justify-between gap-3 px-4 py-3"><div class="min-w-0"><div class="font-semibold">{{ e.category }}</div><div class="truncate text-xs text-stone-500">{{ e.createdAt | date: 'd MMM, h:mm a' }} · {{ method(e.method) }}{{ e.shiftId ? ' from the drawer' : '' }} · {{ e.userName }}{{ e.note ? ' · ' + e.note : '' }}</div></div><div class="num font-bold">{{ e.amount | money }}</div></div>
        } @empty {
          <p class="px-4 py-10 text-center text-sm text-stone-500">{{ loaded() ? 'No expenses in these days.' : 'Loading…' }}</p>
        }
      </div>
    </div>
    @if (adding()) {
      <pos-sheet heading="Add expense" (closed)="adding.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="add()">
          <div><label class="label" for="ea">Amount</label><input id="ea" class="input num text-2xl font-bold" name="amount" inputmode="decimal" [(ngModel)]="amount" autofocus /></div>
          <div>
            <label class="label" for="ec">What for</label>
            <input id="ec" class="input" name="category" [(ngModel)]="category" />
            <div class="scroll-x mt-2">@for (c of common(); track c) { <button type="button" class="chip min-h-[36px]" [class.chip-on]="category === c" (click)="category = c">{{ c }}</button> }</div>
          </div>
          <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Paid by">
            @for (m of methods; track m.key) { <button type="button" class="chip justify-center" [class.chip-on]="by === m.key" (click)="by = m.key" role="radio" [attr.aria-checked]="by === m.key">{{ m.short }}</button> }
          </div>
          @if (by === 'CASH') { <label class="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5 accent-brand-600" name="drawer" [(ngModel)]="fromDrawer" /> Taken from this till's drawer</label> }
          <input class="input" name="note" [(ngModel)]="note" placeholder="Note (optional)" aria-label="Note" />
          <button class="btn-big" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save expense' }}</button>
        </form>
      </pos-sheet>
    }
  `,
})
export class ExpensesPage implements OnInit {
  private readonly api = inject(Api);
  readonly list = signal<Expense[]>([]);
  readonly total = signal('0');
  readonly common = signal(COMMON);
  readonly loaded = signal(false);
  readonly adding = signal(false);
  readonly busy = signal(false);
  readonly methods = METHODS;
  readonly method = (m: Method) => METHODS.find((x) => x.key === m)?.short ?? m;
  from = today().slice(0, 8) + '01';
  to = today();
  amount = '';
  category = '';
  by: Method = 'CASH';
  fromDrawer = true;
  note = '';

  ngOnInit() {
    void this.load();
  }
  async load() {
    try {
      const res = await this.api.get<{ expenses: Expense[]; total: string; categories: string[] }>('/expenses', { from: dayStart(this.from), to: dayStart(this.to, 1) });
      this.list.set(res.expenses);
      this.total.set(res.total);
      this.common.set([...new Set([...res.categories, ...COMMON])].slice(0, 12));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }
  start() {
    this.amount = '';
    this.category = '';
    this.note = '';
    this.by = 'CASH';
    this.fromDrawer = true;
    this.adding.set(true);
  }
  async add() {
    if (typed(this.amount) <= 0 || !this.category.trim()) return this.api.say('Type the amount and what it was for.', true);
    this.busy.set(true);
    try {
      await this.api.post('/expenses', { amount: typed(this.amount), category: this.category, method: this.by, note: this.note, fromDrawer: this.fromDrawer, tillId: this.api.till()?.id });
      this.adding.set(false);
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}
