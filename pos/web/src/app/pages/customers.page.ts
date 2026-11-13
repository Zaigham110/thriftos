import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Customer, MoneyPipe } from '../core';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

/** Customers and what each one owes (the khata). */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, Icon, Sheet],
  template: `
    <div class="screen max-w-3xl">
      <div class="flex items-center justify-between gap-3">
        <h1>Khata</h1>
        <button class="btn-primary" (click)="start()"><pos-icon name="plus" /> New customer</button>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="stat"><div class="stat-label">Customers owe the shop</div><div class="stat-value text-amber-800">{{ owed() | money }}</div></div>
        <div class="stat"><div class="stat-label">Customers who owe</div><div class="stat-value">{{ owing() }}</div></div>
      </div>
      <div class="mt-4 flex gap-2">
        <input class="input" type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search name or phone" aria-label="Search customers" />
        <button class="chip shrink-0" [class.chip-on]="onlyOwing()" (click)="onlyOwing.set(!onlyOwing())">Owing only</button>
      </div>
      <div class="card mt-3 divide-y divide-stone-100">
        @for (c of shown(); track c.id) {
          <a [routerLink]="['/customers', c.id]" class="row">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">{{ c.name.slice(0, 1).toUpperCase() }}</span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ c.name }}</span><span class="block text-xs text-stone-500">{{ c.phone || 'No phone' }}</span></span>
            <span class="num text-right font-bold" [class]="+c.balance > 0 ? 'text-amber-800' : +c.balance < 0 ? 'text-pay-700' : 'text-stone-400'">{{ +c.balance > 0 ? 'Owes ' : +c.balance < 0 ? 'Shop owes ' : '' }}{{ +c.balance ? (abs(c.balance) | money) : 'Clear' }}</span>
            <pos-icon name="right" class="text-stone-300" />
          </a>
        } @empty {
          <p class="px-4 py-10 text-center text-sm text-stone-500">{{ loaded() ? (search() ? 'No customer matches.' : 'No customers yet. Add the people who buy on credit.') : 'Loading…' }}</p>
        }
      </div>
    </div>

    @if (adding()) {
      <pos-sheet heading="New customer" (closed)="adding.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="add()">
          <div><label class="label" for="n">Name</label><input id="n" class="input" name="name" [(ngModel)]="form.name" autofocus /></div>
          <div><label class="label" for="p">Phone</label><input id="p" class="input" name="phone" inputmode="tel" [(ngModel)]="form.phone" placeholder="0300 1234567" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="o">Already owes (old khata)</label><input id="o" class="input num" name="opening" inputmode="decimal" [(ngModel)]="form.openingBalance" placeholder="Rs 0" /></div>
            <div><label class="label" for="l">Credit limit</label><input id="l" class="input num" name="limit" inputmode="decimal" [(ngModel)]="form.creditLimit" placeholder="No limit" /></div>
          </div>
          <button class="btn-big" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save customer' }}</button>
        </form>
      </pos-sheet>
    }
  `,
})
export class CustomersPage implements OnInit {
  private readonly api = inject(Api);
  readonly list = signal<Customer[]>([]);
  readonly owed = signal('0');
  readonly owing = signal(0);
  readonly loaded = signal(false);
  readonly search = signal('');
  readonly onlyOwing = signal(false);
  readonly adding = signal(false);
  readonly busy = signal(false);
  form = { name: '', phone: '', openingBalance: '', creditLimit: '' };
  readonly abs = (v: string) => Math.abs(+v);

  readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.list().filter((c) => (!this.onlyOwing() || +c.balance > 0) && (!q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)));
  });

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      const res = await this.api.get<{ customers: Customer[]; owed: string; owing: number }>('/customers');
      this.list.set(res.customers);
      this.owed.set(res.owed);
      this.owing.set(res.owing);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }

  start() {
    this.form = { name: '', phone: '', openingBalance: '', creditLimit: '' };
    this.adding.set(true);
  }

  async add() {
    this.busy.set(true);
    try {
      await this.api.post('/customers', this.form);
      this.adding.set(false);
      await this.load();
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}
