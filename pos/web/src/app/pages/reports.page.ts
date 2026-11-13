import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, dayStart, downloadCsv, methodLabel, MoneyPipe, today } from '../core';
import { Icon } from '../ui/icon';

interface Row {
  key: string;
  bills: number;
  quantity: number;
  sales: string;
  profit?: string;
}
interface Sales {
  totals: Record<string, string | number>;
  byMethod: { key: string; sales: string }[];
  byDay: Row[];
  byCashier: Row[];
  byCategory: Row[];
  byGrade: Row[];
  byKind: Row[];
  expenses: { key: string; amount: string }[];
}
interface StockRow {
  key: string;
  closed: number;
  opened: number;
  piecesLeft: number;
  worth: string;
  cost?: string;
}
interface Stock {
  totals: Omit<StockRow, 'key'>;
  byCategory: StockRow[];
  byAge: StockRow[];
  shipments: { id: string; code: string; supplier: string; arrivedOn: string; bales: number; balesLeft: number; landedCost: string; sold: string; profit: string; recovered: string | null }[];
}
interface Shift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedByName: string;
  expectedCash: string | null;
  countedCash: string | null;
  difference: string | null;
  till?: { name: string };
}
const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Other dates' },
];

/** Numbers for the owner and managers: sales, stock and shifts. Bars, not spreadsheets; CSV for the accountant. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, DatePipe, Icon],
  template: `
    <div class="screen">
      <a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>
      <h1>Reports</h1>
      <div class="scroll-x mt-3" role="tablist">
        @for (t of tabs; track t.key) { <button class="chip" [class.chip-on]="tab() === t.key" (click)="tab.set(t.key); load()" role="tab" [attr.aria-selected]="tab() === t.key">{{ t.label }}</button> }
        @if (api.isOwner() && (api.session()?.branches?.length ?? 0) > 1) {
          <button class="chip ml-auto" [class.chip-on]="allBranches()" (click)="allBranches.set(!allBranches()); load()">{{ allBranches() ? 'All branches' : api.branch()?.name + ' only' }}</button>
        }
      </div>

      @if (tab() === 'sales') {
        <div class="scroll-x mt-2">
          @for (r of ranges; track r.key) { <button class="chip" [class.chip-on]="range() === r.key" (click)="pick(r.key)">{{ r.label }}</button> }
        </div>
        @if (range() === 'custom') {
          <div class="mt-2 flex flex-wrap items-center gap-2"><input class="input w-auto" type="date" [(ngModel)]="from" (ngModelChange)="load()" [max]="to" aria-label="From" /><span class="text-sm text-stone-500">to</span><input class="input w-auto" type="date" [(ngModel)]="to" (ngModelChange)="load()" [min]="from" aria-label="To" /></div>
        }
        @if (sales(); as s) {
          <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="stat"><div class="stat-label">Sales after returns</div><div class="stat-value">{{ s.totals['net'] | money }}</div><div class="hint">{{ s.totals['bills'] }} bills{{ +s.totals['returned'] ? ' · ' + (s.totals['returned'] | money) + ' returned' : '' }}</div></div>
            @if (s.totals['profit'] !== undefined) {
              <div class="stat"><div class="stat-label">Profit on goods</div><div class="stat-value text-pay-700">{{ s.totals['profit'] | money }}</div><div class="hint">after expenses {{ s.totals['netProfit'] | money }}</div></div>
            }
            <div class="stat"><div class="stat-label">Expenses</div><div class="stat-value">{{ s.totals['expenses'] | money }}</div></div>
            <div class="stat"><div class="stat-label">Sold on khata</div><div class="stat-value">{{ s.totals['credit'] | money }}</div><div class="hint">received {{ s.totals['khataReceived'] | money }}</div></div>
            <div class="stat"><div class="stat-label">Discounts given</div><div class="stat-value">{{ s.totals['discount'] | money }}</div></div>
            @if (+s.totals['tax']) { <div class="stat"><div class="stat-label">Tax collected</div><div class="stat-value">{{ s.totals['tax'] | money }}</div></div> }
            <div class="stat"><div class="stat-label">Cancelled bills</div><div class="stat-value">{{ s.totals['cancelled'] }}</div></div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section class="card min-w-0 p-4"><h2>Money received</h2>
              @for (m of s.byMethod; track m.key) { <div class="mt-3"><div class="flex justify-between text-sm"><span>{{ label(m.key) }}</span><span class="num font-semibold">{{ m.sales | money }}</span></div><div class="mt-1 h-2 rounded-full bg-stone-100"><div class="h-full rounded-full bg-brand-600" [style.width.%]="pct(m.sales, s.byMethod)"></div></div></div> }
            </section>
            @for (g of groups(s); track g.title) {
              <section class="card min-w-0 p-4"><h2>{{ g.title }}</h2>
                @for (r of g.rows; track r.key) {
                  <div class="mt-3"><div class="flex justify-between gap-3 text-sm"><span class="truncate">{{ r.key }} <span class="text-stone-400">· {{ g.count(r) }}</span></span><span class="num shrink-0 font-semibold">{{ r.sales | money }}@if (r.profit !== undefined) { <span class="ml-2 font-normal text-pay-700">{{ r.profit | money }}</span> }</span></div><div class="mt-1 h-2 rounded-full bg-stone-100"><div class="h-full rounded-full bg-brand-600" [style.width.%]="pct(r.sales, g.rows)"></div></div></div>
                } @empty { <p class="mt-3 text-sm text-stone-500">Nothing in these days.</p> }
              </section>
            }
            @if (s.expenses.length) {
              <section class="card min-w-0 p-4"><h2>Expenses</h2>@for (e of s.expenses; track e.key) { <div class="mt-2 flex justify-between text-sm"><span>{{ e.key }}</span><span class="num font-semibold">{{ e.amount | money }}</span></div> }</section>
            }
          </div>
          <button class="btn-soft mt-4" (click)="csvSales(s)">Save as Excel file (CSV)</button>
        }
      } @else if (tab() === 'stock') {
        @if (stock(); as k) {
          <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="stat"><div class="stat-label">Whole bales</div><div class="stat-value">{{ k.totals.closed }}</div></div>
            <div class="stat"><div class="stat-label">Opened bales</div><div class="stat-value">{{ k.totals.opened }}</div><div class="hint">{{ k.totals.piecesLeft }} pieces left</div></div>
            <div class="stat"><div class="stat-label">Worth at sale prices</div><div class="stat-value">{{ k.totals.worth | money }}</div></div>
            @if (k.totals.cost !== undefined) { <div class="stat"><div class="stat-label">Stock at cost</div><div class="stat-value">{{ k.totals.cost | money }}</div></div> }
          </div>
          <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            @for (g of [{ title: 'How long on the shelf', rows: k.byAge }, { title: 'By category', rows: k.byCategory }]; track g.title) {
              <section class="card min-w-0 p-4"><h2>{{ g.title }}</h2>
                @for (r of g.rows; track r.key) { <div class="mt-3"><div class="flex justify-between gap-3 text-sm"><span class="truncate">{{ r.key }} <span class="text-stone-400">· {{ r.closed }} bales{{ r.opened ? ', ' + r.piecesLeft + ' pcs' : '' }}</span></span><span class="num shrink-0 font-semibold">{{ (r.cost ?? r.worth) | money }}</span></div><div class="mt-1 h-2 rounded-full bg-stone-100"><div class="h-full rounded-full" [class]="r.key === 'Over 90 days' ? 'bg-red-500' : r.key === '61 to 90 days' ? 'bg-amber-500' : 'bg-brand-600'" [style.width.%]="pctStock(r, g.rows)"></div></div></div> }
              </section>
            }
          </div>
          @if (k.shipments.length) {
            <h2 class="mb-2 mt-6">How each shipment is doing</h2>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              @for (h of k.shipments; track h.id) {
                <a [routerLink]="['/shipments', h.id]" class="card p-4">
                  <div class="flex items-baseline justify-between gap-2"><span class="font-semibold">{{ h.code }} · {{ h.supplier }}</span><span class="text-xs text-stone-500">{{ h.arrivedOn | date: 'd MMM y' : 'UTC' }}</span></div>
                  <div class="mt-2 h-2.5 rounded-full bg-stone-100"><div class="h-full rounded-full" [class]="+(h.recovered ?? 0) >= 100 ? 'bg-pay-600' : 'bg-brand-600'" [style.width.%]="min(+(h.recovered ?? 0), 100)"></div></div>
                  <div class="mt-2 grid grid-cols-3 gap-2 text-xs"><div><div class="text-stone-500">Cost</div><div class="num font-semibold">{{ h.landedCost | money }}</div></div><div><div class="text-stone-500">Sold ({{ h.recovered ?? 0 }}%)</div><div class="num font-semibold">{{ h.sold | money }}</div></div><div><div class="text-stone-500">{{ h.balesLeft }} of {{ h.bales }} left</div><div class="num font-semibold text-pay-700">{{ h.profit | money }}</div></div></div>
                </a>
              }
            </div>
          }
        }
      } @else {
        <div class="card mt-4 divide-y divide-stone-100">
          @for (h of shifts(); track h.id) {
            <div class="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div><div class="font-semibold">{{ h.till?.name }} · {{ h.openedByName }}</div><div class="text-xs text-stone-500">{{ h.openedAt | date: 'd MMM, h:mm a' }} {{ h.closedAt ? 'to ' + (h.closedAt | date: 'h:mm a') : '· still open' }}</div></div>
              <div class="text-right">@if (h.closedAt) { <div class="num font-bold">{{ h.countedCash | money }}</div><div class="num text-xs font-semibold" [class]="+h.difference! < 0 ? 'text-red-700' : +h.difference! > 0 ? 'text-amber-700' : 'text-pay-700'">{{ +h.difference! === 0 ? 'Exactly right' : (+h.difference! < 0 ? 'Short ' : 'Over ') + (abs(h.difference!) | money) }}</div> } @else { <span class="tag bg-emerald-50 text-emerald-800">Open</span> }</div></div>
          } @empty { <p class="px-4 py-10 text-center text-sm text-stone-500">No shifts yet.</p> }
        </div>
      }
      @if (error()) { <p class="card mt-4 p-5 text-sm text-red-800" role="alert">{{ error() }}</p> }
    </div>
  `,
})
export class ReportsPage implements OnInit {
  readonly api = inject(Api);
  readonly tabs = [{ key: 'sales', label: 'Sales' }, { key: 'stock', label: 'Stock' }, { key: 'shifts', label: 'Shifts' }];
  readonly ranges = RANGES;
  readonly tab = signal('sales');
  readonly range = signal('today');
  readonly allBranches = signal(false);
  readonly sales = signal<Sales | null>(null);
  readonly stock = signal<Stock | null>(null);
  readonly shifts = signal<Shift[]>([]);
  readonly error = signal('');
  readonly label = methodLabel;
  readonly abs = (v: string) => Math.abs(+v);
  readonly min = Math.min;
  from = today();
  to = today();

  ngOnInit() {
    void this.load();
  }

  pick(key: string) {
    this.range.set(key);
    const day = (back: number) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    if (key === 'today') [this.from, this.to] = [today(), today()];
    else if (key === 'yesterday') [this.from, this.to] = [day(1), day(1)];
    else if (key === '7') [this.from, this.to] = [day(6), today()];
    else if (key === 'month') [this.from, this.to] = [today().slice(0, 8) + '01', today()];
    void this.load();
  }

  async load() {
    this.error.set('');
    const branch: Record<string, string> = this.allBranches() ? { branch: 'all' } : {};
    try {
      if (this.tab() === 'sales') this.sales.set(await this.api.get<Sales>('/reports/sales', { from: dayStart(this.from), to: dayStart(this.to, 1), tz: String(-new Date().getTimezoneOffset()), ...branch }));
      else if (this.tab() === 'stock') this.stock.set(await this.api.get<Stock>('/reports/stock', branch));
      else this.shifts.set(await this.api.get<Shift[]>('/shifts'));
    } catch (e) {
      this.error.set(this.api.why(e));
    }
  }

  groups(s: Sales) {
    const bills = (r: Row) => `${r.bills} ${r.bills === 1 ? 'bill' : 'bills'}`;
    const qty = (r: Row) => `${r.quantity} sold`;
    return [
      { title: 'By day', rows: s.byDay, count: bills },
      { title: 'Bales and pieces', rows: s.byKind, count: qty },
      { title: 'By category', rows: s.byCategory, count: qty },
      { title: 'By grade', rows: s.byGrade, count: qty },
      { title: 'By cashier', rows: s.byCashier, count: bills },
    ];
  }
  pct(value: string, rows: { sales: string }[]) {
    const top = Math.max(...rows.map((r) => +r.sales), 1);
    return Math.max(0, (+value / top) * 100);
  }
  pctStock(row: StockRow, rows: StockRow[]) {
    const of = (r: StockRow) => +(r.cost ?? r.worth);
    return (of(row) / Math.max(...rows.map(of), 1)) * 100;
  }

  csvSales(s: Sales) {
    const profit = s.totals['profit'] !== undefined;
    const rows: (string | number)[][] = [['Sales report', `${this.from} to ${this.to}`], []];
    rows.push(['Totals'], ...Object.entries(s.totals).map(([k, v]) => [k, v]), []);
    rows.push(['Money received'], ...s.byMethod.map((m) => [methodLabel(m.key), m.sales]), []);
    for (const g of this.groups(s)) rows.push([g.title, 'Bills', 'Quantity', 'Sales', ...(profit ? ['Profit'] : [])], ...g.rows.map((r) => [r.key, r.bills, r.quantity, r.sales, ...(profit ? [r.profit ?? ''] : [])]), []);
    rows.push(['Expenses'], ...s.expenses.map((e) => [e.key, e.amount]));
    downloadCsv(`sales-${this.from}-to-${this.to}.csv`, rows);
  }
}
