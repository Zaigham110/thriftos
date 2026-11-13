import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Bale, Branch, money, MoneyPipe, STATUS_LABEL, STATUS_TONE, typed } from '../core';
import { Printer } from '../hardware/printer';
import { Shelf } from '../offline/shelf';
import { Icon } from '../ui/icon';
import { Sheet } from '../ui/sheet';

const SHELVES = [
  { key: 'shelf', label: 'On the shelf' },
  { key: 'IN_STOCK', label: 'Whole bales' },
  { key: 'OPENED', label: 'Opened' },
  { key: 'SOLD', label: 'Sold' },
  { key: 'FINISHED', label: 'Finished' },
  { key: 'IN_TRANSIT', label: 'On the way' },
  { key: 'WRITTEN_OFF', label: 'Written off' },
];

/** Everything this branch has: find a bale, pick several to print stickers, change prices or send to another branch. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, Icon, Sheet],
  template: `
    <div class="screen">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div><h1>Stock</h1><p class="text-sm text-stone-500">{{ total() }} {{ total() === 1 ? 'bale' : 'bales' }} · {{ api.branch()?.name }}</p></div>
        <div class="flex gap-2">
          @if (api.isManager()) { <a routerLink="/stock-check" class="btn-soft"><pos-icon name="count" /> Stock check</a> }
          <button class="btn-soft" (click)="picking.set(!picking()); picked.set({})">{{ picking() ? 'Done choosing' : 'Choose bales' }}</button>
        </div>
      </div>

      <input class="input mt-3" type="search" [ngModel]="search()" (ngModelChange)="search.set($event); later()" placeholder="Search item, bale no., category, grade, brand" aria-label="Search stock" />
      <div class="scroll-x mt-2.5">
        @for (s of shelves; track s.key) {
          <button class="chip" [class.chip-on]="status() === s.key" (click)="status.set(s.key); load()">{{ s.label }}</button>
        }
      </div>
      @if (categories().length) {
        <div class="scroll-x mt-2">
          <button class="chip" [class.chip-on]="!category()" (click)="category.set(''); load()">Every category</button>
          @for (c of categories(); track c) {
            <button class="chip" [class.chip-on]="category() === c" (click)="category.set(c); load()">{{ c }}</button>
          }
        </div>
      }

      <div class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        @for (b of bales(); track b.id) {
          @if (picking()) {
            <button class="card flex items-start gap-3 p-3.5 text-left" [class]="picked()[b.id] ? 'border-brand-600 ring-2 ring-brand-200' : ''" (click)="toggle(b)" [attr.aria-pressed]="!!picked()[b.id]">
              <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2" [class]="picked()[b.id] ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300'">@if (picked()[b.id]) { <pos-icon name="check" size="h-4 w-4" /> }</span>
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ b.item }}</span><span class="num block text-xs text-stone-500">{{ b.code }}{{ b.grade ? ' · Grade ' + b.grade : '' }}</span></span>
              <span class="num text-sm font-bold">{{ b.salePrice | money }}</span>
            </button>
          } @else {
            <a [routerLink]="['/stock', b.id]" class="card flex flex-col p-3.5 transition hover:border-stone-300">
              <span class="flex items-center justify-between gap-2"><span class="num text-xs font-semibold text-stone-500">{{ b.code }}{{ b.baleNo ? ' · ' + b.baleNo : '' }}</span><span class="tag" [class]="tone[b.status]">{{ b.status === 'OPENED' ? b.piecesLeft + ' pcs left' : label[b.status] }}</span></span>
              <span class="mt-1 truncate text-[15px] font-semibold">{{ b.item }}</span>
              <span class="truncate text-xs text-stone-500">{{ meta(b) }}</span>
              <span class="mt-2 flex items-baseline justify-between gap-2">
                <span class="num text-lg font-bold">{{ b.status === 'OPENED' ? (b.piecePrice | money) : (b.salePrice | money) }} <span class="text-xs font-normal text-stone-500">{{ b.status === 'OPENED' ? 'a piece' : 'bale' }}</span></span>
                @if (b.landedCost !== undefined) { <span class="num text-xs text-stone-500">cost {{ b.landedCost | money }}</span> }
              </span>
            </a>
          }
        } @empty {
          <p class="col-span-full py-12 text-center text-sm text-stone-500">{{ loaded() ? 'Nothing here.' : 'Loading…' }}</p>
        }
      </div>
      @if (bales().length < total()) {
        <p class="py-4 text-center text-sm text-stone-500">Showing {{ bales().length }} of {{ total() }}. Search to narrow it down.</p>
      }
    </div>

    @if (picking()) {
      <div class="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 border-t border-stone-200 bg-white px-3 py-2.5 shadow-lift md:bottom-0 md:left-[84px]">
        <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <span class="mr-auto text-sm font-semibold">{{ count() }} chosen <button class="ml-2 font-semibold text-brand-700 underline" (click)="all()">Choose all {{ bales().length }}</button></span>
          <button class="btn-soft min-h-[44px]" [disabled]="!count()" (click)="stickers()"><pos-icon name="tag" /> Stickers</button>
          @if (api.isManager()) {
            <button class="btn-soft min-h-[44px]" [disabled]="!count()" (click)="pricing.set(true); bale = ''; piece = ''"><pos-icon name="wallet" /> Prices</button>
            @if (others().length) { <button class="btn-soft min-h-[44px]" [disabled]="!count()" (click)="sending.set(true); to = others()[0].id"><pos-icon name="truck" /> Send</button> }
          }
        </div>
      </div>
    }

    @if (pricing()) {
      <pos-sheet [heading]="'New prices for ' + count() + ' bales'" (closed)="pricing.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="prices()">
          <div><label class="label" for="nb">Bale price</label><input id="nb" class="input num" name="bale" inputmode="decimal" [(ngModel)]="bale" placeholder="Leave empty to keep" /></div>
          <div><label class="label" for="np">Piece price</label><input id="np" class="input num" name="piece" inputmode="decimal" [(ngModel)]="piece" placeholder="Leave empty to keep" /></div>
          <button class="btn-big" [disabled]="busy()">Change prices</button>
        </form>
      </pos-sheet>
    }
    @if (sending()) {
      <pos-sheet [heading]="'Send ' + count() + ' bales to another branch'" (closed)="sending.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="send()">
          <div><label class="label" for="tb">To branch</label><select id="tb" class="input" name="to" [(ngModel)]="to">@for (b of others(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }</select></div>
          <input class="input" name="note" [(ngModel)]="note" placeholder="Note: vehicle, driver (optional)" aria-label="Note" />
          <p class="hint">The bales leave this shelf now and show as "On the way" until the other branch receives them.</p>
          <button class="btn-big" [disabled]="busy()">Send bales</button>
        </form>
      </pos-sheet>
    }
  `,
})
export class StockPage implements OnInit {
  readonly api = inject(Api);
  private readonly printer = inject(Printer);
  private readonly shelf = inject(Shelf);
  readonly shelves = SHELVES;
  readonly label = STATUS_LABEL;
  readonly tone = STATUS_TONE;
  readonly fmt = money;
  readonly bales = signal<Bale[]>([]);
  readonly total = signal(0);
  readonly categories = signal<string[]>([]);
  readonly loaded = signal(false);
  readonly search = signal('');
  readonly status = signal('shelf');
  readonly category = signal('');
  readonly picking = signal(false);
  readonly picked = signal<Record<string, Bale>>({});
  readonly count = computed(() => Object.keys(this.picked()).length);
  readonly pricing = signal(false);
  readonly sending = signal(false);
  readonly busy = signal(false);
  readonly others = computed<Branch[]>(() => (this.api.session()?.branches ?? []).filter((b) => b.id !== this.api.branch()?.id));
  bale = '';
  piece = '';
  to = '';
  note = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  ngOnInit() {
    void this.load();
  }
  later() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(), 250);
  }
  meta(b: Bale) {
    return [b.category, b.grade ? `Grade ${b.grade}` : '', b.weightKg ? `${+b.weightKg} kg` : '', b.shipment?.code].filter(Boolean).join(' · ');
  }

  async load() {
    try {
      const res = await this.api.get<{ total: number; categories: string[]; bales: Bale[] }>('/bales', { status: this.status(), search: this.search().trim(), category: this.category(), take: '300' });
      this.bales.set(res.bales);
      this.total.set(res.total);
      this.categories.set(res.categories);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }

  toggle(b: Bale) {
    this.picked.update((p) => {
      const next = { ...p };
      if (next[b.id]) delete next[b.id];
      else next[b.id] = b;
      return next;
    });
  }
  all() {
    this.picked.set(Object.fromEntries(this.bales().map((b) => [b.id, b])));
  }

  async stickers() {
    try {
      await this.printer.labels(Object.values(this.picked()));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  private async done(text: string) {
    this.api.say(text);
    this.picked.set({});
    this.picking.set(false);
    await this.load();
    void this.shelf.refresh();
  }

  async prices() {
    if (!this.bale && !this.piece) return this.api.say('Type at least one new price.', true);
    this.busy.set(true);
    try {
      const res = await this.api.post<{ changed: number }>('/bales/prices', { ids: Object.keys(this.picked()), ...(this.bale ? { salePrice: typed(this.bale) } : {}), ...(this.piece ? { piecePrice: typed(this.piece) } : {}) });
      this.pricing.set(false);
      await this.done(`Prices changed on ${res.changed} bales.`);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  async send() {
    this.busy.set(true);
    try {
      const res = await this.api.post<{ code: string; bales: number }>('/transfers', { toBranchId: this.to, baleIds: Object.keys(this.picked()), note: this.note });
      this.sending.set(false);
      await this.done(`${res.bales} bales sent (${res.code}).`);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }
}
