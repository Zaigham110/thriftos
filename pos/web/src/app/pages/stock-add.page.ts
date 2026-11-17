import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, money, today, typed } from '../core';
import { Icon } from '../ui/icon';
import { RateBox } from '../ui/rate-box';

interface Row {
  item: string;
  category: string;
  grade: string;
  weightKg: string;
  pieces: string;
  cost: string;
  salePrice: string;
  piecePrice: string;
  quantity: string;
}
const blank = (): Row => ({ item: '', category: '', grade: '', weightKg: '', pieces: '', cost: '', salePrice: '', piecePrice: '', quantity: '1' });

/**
 * Stock typed by hand, without a file: a local purchase, opening stock, a few bales. One row is one kind of bale
 * and how many of it. Bales of the same kind get the same shared code, as with an imported list.
 */
@Component({
  imports: [FormsModule, RouterLink, Icon, RateBox],
  template: `
    <div class="screen max-w-3xl !pb-44 md:!pb-28">
      <a routerLink="/stock" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Stock</a>
      <h1>Add stock by hand</h1>
      <p class="text-sm text-stone-600">For a few bales without a list. One row is one kind of bale and how many of it.</p>

      <section class="card mt-4 grid grid-cols-1 gap-3 p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="min-w-0">
            <label class="label" for="as">Bought from</label>
            <input id="as" class="input" [(ngModel)]="supplier" list="add-suppliers" placeholder="Supplier (optional)" autocomplete="off" />
            <datalist id="add-suppliers">@for (s of suppliers(); track s) { <option [value]="s"></option> }</datalist>
          </div>
          <div class="min-w-0"><label class="label" for="ad">Date</label><input id="ad" class="input" type="date" [(ngModel)]="arrivedOn" /></div>
        </div>
        <pos-rate-box [(currency)]="currency" [(rate)]="rate" />
      </section>

      @for (r of rows(); track $index; let i = $index) {
        <section class="card mt-3 grid grid-cols-1 gap-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-stone-500">Row {{ i + 1 }}</h2>
            @if (rows().length > 1) { <button type="button" class="icon-btn text-stone-400 hover:text-red-700" (click)="remove(i)" [attr.aria-label]="'Remove row ' + (i + 1)"><pos-icon name="trash" /></button> }
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="min-w-0"><label class="label" [for]="'i' + i">Item</label><input [id]="'i' + i" class="input" [(ngModel)]="r.item" placeholder="Mens jeans" /></div>
            <div class="min-w-0"><label class="label" [for]="'c' + i">Category</label><input [id]="'c' + i" class="input" [(ngModel)]="r.category" placeholder="Jeans" list="add-categories" autocomplete="off" /></div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="min-w-0"><label class="label" [for]="'g' + i">Grade</label><input [id]="'g' + i" class="input" [(ngModel)]="r.grade" placeholder="A" /></div>
            <div class="min-w-0"><label class="label" [for]="'w' + i">Weight kg</label><input [id]="'w' + i" class="input num" inputmode="decimal" [(ngModel)]="r.weightKg" placeholder="45" /></div>
            <div class="min-w-0"><label class="label" [for]="'p' + i">Pieces</label><input [id]="'p' + i" class="input num" inputmode="numeric" [(ngModel)]="r.pieces" placeholder="—" /></div>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="min-w-0"><label class="label" [for]="'k' + i">Cost of one{{ currency() !== local ? ' (' + currency() + ')' : '' }}</label><input [id]="'k' + i" class="input num" inputmode="decimal" [(ngModel)]="r.cost" placeholder="0" /></div>
            <div class="min-w-0"><label class="label" [for]="'s' + i">Bale price</label><input [id]="'s' + i" class="input num" inputmode="decimal" [(ngModel)]="r.salePrice" placeholder="0" /></div>
            <div class="min-w-0"><label class="label" [for]="'e' + i">Piece price</label><input [id]="'e' + i" class="input num" inputmode="decimal" [(ngModel)]="r.piecePrice" placeholder="0" /></div>
            <div class="min-w-0"><label class="label" [for]="'q' + i">How many bales</label><input [id]="'q' + i" class="input num font-bold" inputmode="numeric" [(ngModel)]="r.quantity" /></div>
          </div>
        </section>
      }
      <datalist id="add-categories">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist>
      <button type="button" class="btn-soft mt-3 w-full" (click)="add()"><pos-icon name="plus" /> Another kind of bale</button>
    </div>

    <div class="no-print fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-10 border-t border-stone-200 bg-white px-4 py-3 shadow-lift md:bottom-0 md:left-[84px]">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p class="hidden text-sm text-stone-600 sm:block">{{ count() }} {{ count() === 1 ? 'bale' : 'bales' }}{{ worth() ? ' · cost ' + worth() : '' }}</p>
        <button class="btn-primary min-h-[52px] w-full sm:w-auto sm:px-8" [disabled]="saving() || !count()" (click)="save()">{{ saving() ? 'Saving…' : 'Save ' + count() + (count() === 1 ? ' bale' : ' bales') + ' to stock' }}</button>
      </div>
    </div>
  `,
})
export class StockAddPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly local = this.api.shop()?.currency ?? 'PKR';
  readonly rows = signal<Row[]>([blank()]);
  readonly suppliers = signal<string[]>([]);
  readonly categories = signal<string[]>([]);
  readonly saving = signal(false);
  readonly currency = signal(this.local);
  readonly rate = signal('');
  supplier = '';
  arrivedOn = today();

  // The fields are plain objects edited in place, so these are worked out on every look, not remembered.
  count() {
    return this.rows().reduce((n, r) => n + (r.item.trim() ? Math.max(0, Math.floor(typed(r.quantity))) : 0), 0);
  }
  worth() {
    const total = this.rows().reduce((n, r) => n + (r.item.trim() ? typed(r.cost) * Math.floor(typed(r.quantity)) : 0), 0);
    if (!total) return '';
    if (this.currency() === this.local) return money(total);
    const rate = typed(this.rate());
    return `${this.currency()} ${total.toLocaleString('en-US')}${rate ? ' = ' + money(Math.round(total * rate * 100) / 100) : ''}`;
  }
  readonly foreign = computed(() => this.currency() !== this.local);

  async ngOnInit() {
    try {
      this.suppliers.set((await this.api.get<{ name: string }[]>('/shipments/suppliers')).map((s) => s.name));
      this.categories.set((await this.api.get<{ categories: string[] }>('/bales', { take: '1' })).categories);
    } catch {
      /* only helps while typing */
    }
  }

  add() {
    this.rows.update((r) => [...r, blank()]);
  }
  remove(i: number) {
    this.rows.update((r) => r.filter((_, at) => at !== i));
  }

  async save() {
    const rows = this.rows().filter((r) => r.item.trim());
    if (!rows.length) return this.api.say('Type the item of at least one row.', true);
    if (this.foreign() && !(typed(this.rate()) > 0)) return this.api.say(`Give the ${this.currency()} rate first.`, true);
    this.saving.set(true);
    try {
      const num = (v: string) => (v.trim() ? typed(v) : '');
      const saved = await this.api.post<{ id: string; code: string; bales: number }>('/shipments/manual', {
        supplierName: this.supplier.trim(),
        arrivedOn: this.arrivedOn,
        currency: this.currency(),
        ...(this.foreign() ? { rate: typed(this.rate()) } : {}),
        rows: rows.map((r) => ({ item: r.item.trim(), category: r.category.trim(), grade: r.grade.trim(), weightKg: num(r.weightKg), pieces: num(r.pieces), cost: num(r.cost), salePrice: num(r.salePrice), piecePrice: num(r.piecePrice), quantity: Math.max(1, Math.floor(typed(r.quantity))) })),
      });
      this.api.say(`${saved.bales} ${saved.bales === 1 ? 'bale' : 'bales'} added to stock (${saved.code}).`);
      await this.router.navigateByUrl('/stock');
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.saving.set(false);
    }
  }
}
