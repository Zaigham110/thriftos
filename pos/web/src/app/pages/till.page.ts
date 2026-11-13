import { Component, computed, effect, ElementRef, HostListener, inject, input, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Bale, billMath, Customer, money, MoneyPipe, round2, typed, uid } from '../core';
import { CameraScan } from '../hardware/camera-scan';
import { Scanner } from '../hardware/scanner';
import { CartLine, Shelf } from '../offline/shelf';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';
import { Numpad, press } from '../ui/numpad';
import { Sheet } from '../ui/sheet';
import { OpenBale } from './open-bale';
import { PaySheet } from './pay-sheet';

interface Held {
  id: string;
  label: string;
  total: string;
  userName: string;
  createdAt: string;
  payload: Parked;
  local?: boolean;
}
interface Parked {
  lines: { baleId: string | null; kind: CartLine['kind']; name: string; quantity: number; price: number; discount: number }[];
  discount: { mode: 'amount' | 'percent'; value: number };
  customerId: string | null;
  note: string;
}
const CART = 'thriftos-pos-cart';
const HELD = 'thriftos-pos-held';
const SHOWN = 120;

/**
 * The counter. Tiles of what is on the shelf on one side, the bill on the other, one Pay button. Scan a sticker
 * anywhere, tap a tile, or type. A closed bale goes on the bill whole; an opened bale goes on as pieces.
 */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe, Icon, Sheet, Numpad, OpenBale, PaySheet, CameraScan],
  template: `
    <div class="flex h-full flex-col md:flex-row">
      <!-- The shelf -->
      <section class="flex min-h-0 min-w-0 flex-1 flex-col">
        <header class="shrink-0 px-3 pt-3 md:px-4">
          <div class="flex items-center justify-between gap-2 pb-2 text-xs">
            <div class="min-w-0 truncate font-semibold text-stone-600">{{ api.branch()?.name }} · {{ api.till()?.name }} · <span class="num">{{ shelf.snap()?.today?.bills ?? 0 }} bills, {{ shelf.snap()?.today?.total | money }}</span></div>
            <a routerLink="/drawer" class="-my-1 inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 font-semibold" [class]="shelf.shift() ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'">
              <span class="h-2 w-2 rounded-full" [class]="shelf.shift() ? 'bg-emerald-500' : 'bg-amber-500'"></span>{{ shelf.shift() ? 'Drawer open' : 'Open the drawer' }}
            </a>
          </div>
          <form class="flex gap-2" (ngSubmit)="enter()">
            <div class="relative min-w-0 flex-1">
              <pos-icon name="scan" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input #box class="input h-[52px] pl-11 text-base" name="q" type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Scan, or search item or bale no." aria-label="Find a bale" autocomplete="off" enterkeyhint="search" />
            </div>
            <button type="button" class="icon-btn h-[52px] w-[52px] border border-stone-300 bg-white" (click)="camera.set(true)" aria-label="Scan with the camera"><pos-icon name="camera" size="h-6 w-6" /></button>
            <button type="button" class="relative icon-btn h-[52px] w-[52px] border border-stone-300 bg-white" (click)="openHeld()" aria-label="Bills on hold">
              <pos-icon name="hold" size="h-6 w-6" />
              @if (heldCount()) {
                <span class="num absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{{ heldCount() }}</span>
              }
            </button>
          </form>
          <div class="scroll-x mt-2.5" role="tablist" aria-label="Show">
            @for (f of filters(); track f.key) {
              <button class="chip" [class.chip-on]="filter() === f.key" (click)="filter.set(f.key)" role="tab" [attr.aria-selected]="filter() === f.key">{{ f.label }}</button>
            }
            <button class="chip border-dashed" (click)="startItem()"><pos-icon name="plus" size="h-4 w-4" /> Other item</button>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-28 pt-3 md:px-4 md:pb-4">
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            @for (b of shown(); track b.id) {
              <div class="relative">
                <button class="flex h-full min-h-[128px] w-full flex-col rounded-2xl border-2 bg-white p-3 text-left shadow-tile transition active:scale-[.97]" [class]="inCart(b) ? 'border-brand-600 ring-2 ring-brand-200' : 'border-transparent hover:border-stone-300'" (click)="add(b)">
                  <span class="flex min-h-[20px] items-center justify-between gap-2 text-[11px] font-semibold">
                    <span class="num truncate text-stone-500">{{ b.code }}</span>
                    @if (b.status === 'OPENED') {
                      <span class="whitespace-nowrap rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-900">{{ b.piecesLeft }} pcs left</span>
                    } @else if (inCart(b)) {
                      <span class="whitespace-nowrap rounded-md bg-brand-600 px-1.5 py-0.5 text-white">On bill</span>
                    }
                  </span>
                  <span class="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug">{{ b.item }}</span>
                  <span class="mt-0.5 truncate text-xs text-stone-500">{{ meta(b) }}</span>
                  <span class="mt-auto flex items-baseline gap-1 pt-2">
                    <span class="num text-[17px] font-bold tracking-tight sm:text-lg">{{ price(b) ? fmt(price(b)) : 'Set price' }}</span>
                    @if (b.status === 'OPENED') {
                      <span class="text-xs text-stone-500">a piece</span>
                    }
                  </span>
                </button>
                @if (b.status === 'IN_STOCK' && !inCart(b)) {
                  <button class="absolute right-1.5 top-1.5 flex min-h-[36px] items-center rounded-lg bg-stone-100 px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-200" (click)="opening.set(b)">Open</button>
                }
              </div>
            }
          </div>
          @if (!shown().length) {
            <div class="flex flex-col items-center px-6 py-16 text-center">
              <pos-icon name="stock" size="h-10 w-10" class="text-stone-300" />
              <p class="mt-3 text-base font-semibold">{{ !shelf.loaded() ? 'Loading the shelf…' : query() ? 'Nothing on the shelf matches "' + query() + '"' : 'The shelf is empty' }}</p>
              @if (shelf.loaded() && !query() && api.isOwner()) {
                <a routerLink="/shipments/new" class="btn-primary mt-4">Import a shipment</a>
              }
            </div>
          } @else if (matches().length > shown().length) {
            <p class="py-4 text-center text-sm text-stone-500">Showing {{ shown().length }} of {{ matches().length }}. Type or scan to find the rest.</p>
          }
        </div>
      </section>

      <!-- The bill: a side panel on tablets and laptops, a sheet on phones -->
      <aside class="z-30 flex-col border-stone-200 bg-white md:static md:flex md:w-[300px] md:shrink-0 md:border-l lg:w-[360px] xl:w-[390px]" [class]="ticket() ? 'fixed inset-0 flex' : 'hidden'">
        <div class="flex shrink-0 items-center gap-2 border-b border-stone-100 px-3 py-2.5">
          <button class="icon-btn md:hidden" (click)="ticket.set(false)" aria-label="Back to the shelf"><pos-icon name="back" /></button>
          <button class="flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left hover:bg-stone-50" (click)="customers.set(true)">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" [class]="customer() ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500'"><pos-icon name="user" /></span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{{ customer()?.name ?? 'Walk-in customer' }}</span>
              <span class="block truncate text-xs text-stone-500">{{ customer() ? (+customer()!.balance > 0 ? 'Owes ' + fmt(customer()!.balance) : 'Nothing owed') : 'Tap to choose a customer' }}</span>
            </span>
          </button>
          @if (cart().length) {
            <button class="icon-btn text-stone-400 hover:text-red-700" (click)="clear(true)" aria-label="Clear the bill"><pos-icon name="trash" /></button>
          }
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          @for (l of cart(); track l.key) {
            <div class="flex items-center gap-2 border-b border-stone-100 py-2 pl-4 pr-2">
              <button class="min-w-0 flex-1 text-left" (click)="edit(l)">
                <span class="block truncate text-sm font-semibold">{{ l.name }}</span>
                <span class="block truncate text-xs text-stone-500">{{ l.bale ? l.bale.code + ' · ' : '' }}{{ l.kind === 'BALE' ? 'whole bale' : l.quantity + ' × ' + fmt(l.price) }}{{ l.discount ? ' · less ' + fmt(l.discount) : '' }}</span>
              </button>
              @if (l.kind !== 'BALE') {
                <div class="flex shrink-0 items-center rounded-xl bg-stone-100">
                  <button class="flex h-11 w-10 items-center justify-center" (click)="step(l, -1)" [attr.aria-label]="'One less of ' + l.name"><pos-icon name="minus" size="h-4 w-4" /></button>
                  <span class="num w-7 text-center text-sm font-bold">{{ l.quantity }}</span>
                  <button class="flex h-11 w-10 items-center justify-center" (click)="step(l, 1)" [attr.aria-label]="'One more of ' + l.name"><pos-icon name="plus" size="h-4 w-4" /></button>
                </div>
              }
              <button class="num w-[88px] shrink-0 rounded-lg py-2 pr-2 text-right text-sm font-bold hover:bg-stone-50" [class.text-red-600]="!l.price" (click)="edit(l)">{{ l.price ? fmt(lineTotal(l)) : 'Set price' }}</button>
            </div>
          } @empty {
            <div class="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
              <pos-icon name="scan" size="h-10 w-10" class="text-stone-300" />
              <p class="mt-3 text-sm font-medium text-stone-500">Scan a sticker or tap a bale to start a bill.</p>
            </div>
          }
        </div>

        <div class="shrink-0 border-t border-stone-200 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          @if (cart().length) {
            <div class="space-y-1 text-sm">
              <div class="flex justify-between"><span class="text-stone-500">Subtotal</span><span class="num font-medium">{{ math().subtotal | money }}</span></div>
              <button class="-my-1 flex min-h-[40px] w-full items-center justify-between rounded-lg text-left" (click)="startDiscount()">
                <span class="font-semibold text-brand-700 underline decoration-dotted underline-offset-4">{{ math().discount ? 'Discount' + (discount().mode === 'percent' ? ' ' + discount().value + '%' : '') : 'Add discount' }}</span>
                <span class="num font-medium">{{ math().discount ? '-' + fmt(math().discount) : '' }}</span>
              </button>
              @if (math().tax) {
                <div class="flex justify-between"><span class="text-stone-500">{{ api.shop()?.taxName }} {{ +api.shop()!.taxRate }}%{{ api.shop()?.taxInclusive ? ' (included)' : '' }}</span><span class="num font-medium">{{ math().tax | money }}</span></div>
              }
            </div>
          }
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-base font-semibold">Total</span>
            <span class="num text-3xl font-extrabold tracking-tight">{{ math().total | money }}</span>
          </div>
          <div class="mt-3 flex gap-2">
            <button class="btn-quiet min-h-[60px] px-5" [disabled]="!cart().length" (click)="hold()" aria-label="Hold this bill"><pos-icon name="hold" /> Hold</button>
            <button class="btn-pay flex-1" [disabled]="!cart().length" (click)="pay()">Pay {{ cart().length ? fmt(math().total) : '' }}</button>
          </div>
        </div>
      </aside>
    </div>

    <!-- Phone: the bill waits behind this bar -->
    @if (cart().length && !ticket()) {
      <button class="fixed inset-x-3 bottom-[calc(70px+env(safe-area-inset-bottom))] z-20 flex min-h-[60px] items-center justify-between rounded-2xl bg-pay-600 px-5 text-white shadow-lift md:hidden" (click)="ticket.set(true)">
        <span class="text-base font-semibold">View bill · {{ pieces() }} {{ pieces() === 1 ? 'item' : 'items' }}</span>
        <span class="num text-xl font-extrabold">{{ math().total | money }}</span>
      </button>
    }

    <!-- One line: price, quantity, discount -->
    @if (line(); as l) {
      <pos-sheet [heading]="l.name" (closed)="line.set(null)">
        <p class="-mt-1 mb-3 text-sm text-stone-500">{{ l.bale ? l.bale.code + ' · ' : '' }}{{ l.kind === 'BALE' ? 'Whole bale' : l.kind === 'PIECE' ? l.bale!.piecesLeft + ' pieces in the bale' : 'Other item' }}</p>
        <div class="grid grid-cols-1 gap-2" [class]="l.kind === 'BALE' ? 'grid-cols-2' : 'grid-cols-3'">
          @for (f of fields(l); track f.key) {
            <button class="rounded-2xl border-2 px-3 py-2 text-left" [class]="field() === f.key ? 'border-brand-600 bg-brand-50' : 'border-stone-200'" (click)="pickField(f.key)">
              <span class="block text-xs font-medium text-stone-500">{{ f.label }}</span>
              <span class="num block truncate text-xl font-bold">{{ draft()[f.key] || '0' }}</span>
            </button>
          }
        </div>
        <div class="mt-3"><pos-numpad (key)="lineKey($event)" /></div>
        <div class="mt-3 flex gap-2">
          <button class="btn-danger" (click)="remove(l)"><pos-icon name="trash" /> Remove</button>
          <button class="btn-primary flex-1" (click)="saveLine(l)">Done</button>
        </div>
      </pos-sheet>
    }

    @if (discounting()) {
      <pos-sheet heading="Discount on the bill" (closed)="discounting.set(false)">
        <div class="grid grid-cols-2 gap-2">
          <button class="chip justify-center" [class.chip-on]="draftDiscount().mode === 'amount'" (click)="draftDiscount.set({ mode: 'amount', value: '' })">Rupees</button>
          <button class="chip justify-center" [class.chip-on]="draftDiscount().mode === 'percent'" (click)="draftDiscount.set({ mode: 'percent', value: '' })">Percent</button>
        </div>
        <div class="num my-3 rounded-2xl bg-stone-100 px-4 py-3 text-right text-3xl font-extrabold">{{ draftDiscount().mode === 'amount' ? 'Rs ' : '' }}{{ draftDiscount().value || '0' }}{{ draftDiscount().mode === 'percent' ? '%' : '' }}</div>
        @if (api.role() === 'CASHIER') {
          <p class="hint mb-2">A cashier can give {{ api.shop()?.cashierMaxDiscountPct }}% at most. A manager can give more.</p>
        }
        <pos-numpad (key)="discountKey($event)" />
        <div class="mt-3 flex gap-2">
          <button class="btn-soft" (click)="discount.set({ mode: 'amount', value: 0 }); discounting.set(false)">No discount</button>
          <button class="btn-primary flex-1" (click)="saveDiscount()">Done</button>
        </div>
      </pos-sheet>
    }

    @if (customers()) {
      <pos-sheet heading="Customer" (closed)="customers.set(false)">
        @if (!adding()) {
          <input class="input" type="search" [ngModel]="who()" (ngModelChange)="who.set($event)" placeholder="Search name or phone" aria-label="Search customers" />
          <div class="-mx-5 mt-2 max-h-[46dvh] divide-y divide-stone-100 overflow-y-auto">
            <button class="row" (click)="choose(null)"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-500"><pos-icon name="user" /></span><span class="font-semibold">Walk-in customer</span></button>
            @for (c of people(); track c.id) {
              <button class="row" (click)="choose(c)">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">{{ c.name.slice(0, 1).toUpperCase() }}</span>
                <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ c.name }}</span><span class="block text-xs text-stone-500">{{ c.phone || 'No phone' }}</span></span>
                @if (+c.balance > 0) {
                  <span class="num text-sm font-semibold text-amber-800">Owes {{ c.balance | money }}</span>
                }
              </button>
            }
          </div>
          <button class="btn-soft mt-3 w-full" (click)="adding.set(true); newName = who(); newPhone = ''"><pos-icon name="plus" /> New customer</button>
        } @else {
          <form class="grid grid-cols-1 gap-3" (ngSubmit)="addCustomer()">
            <div><label class="label" for="cn">Name</label><input id="cn" class="input" name="name" [(ngModel)]="newName" autofocus /></div>
            <div><label class="label" for="cp">Phone</label><input id="cp" class="input" name="phone" inputmode="tel" [(ngModel)]="newPhone" placeholder="0300 1234567" /></div>
            <div class="flex gap-2"><button type="button" class="btn-soft" (click)="adding.set(false)">Back</button><button class="btn-primary flex-1" [disabled]="busy()">Save customer</button></div>
          </form>
        }
      </pos-sheet>
    }

    @if (itemOpen()) {
      <pos-sheet heading="Other item" (closed)="itemOpen.set(false)">
        <form class="grid grid-cols-1 gap-3" (ngSubmit)="addItem()">
          <div><label class="label" for="in">What is it</label><input id="in" class="input" name="name" [(ngModel)]="itemName" placeholder="Bag, delivery, hanger…" autofocus /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="ip">Price</label><input id="ip" class="input num" name="price" inputmode="decimal" [(ngModel)]="itemPrice" placeholder="Rs" /></div>
            <div><label class="label" for="iq">How many</label><input id="iq" class="input num" name="qty" inputmode="numeric" [(ngModel)]="itemQty" /></div>
          </div>
          <button class="btn-primary">Add to bill</button>
        </form>
      </pos-sheet>
    }

    @if (heldOpen()) {
      <pos-sheet heading="Bills on hold" (closed)="heldOpen.set(false)">
        <div class="-mx-5 divide-y divide-stone-100">
          @for (h of held(); track h.id) {
            <button class="row" (click)="take(h)">
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ h.label }}</span><span class="block text-xs text-stone-500">{{ h.payload.lines.length }} lines · {{ h.userName }}{{ h.local ? ' · on this device' : '' }}</span></span>
              <span class="num font-bold">{{ h.total | money }}</span>
            </button>
          } @empty {
            <p class="px-5 py-8 text-center text-sm text-stone-500">No bill is on hold. Use Hold when a customer steps away, and serve the next one.</p>
          }
        </div>
      </pos-sheet>
    }

    @if (opening(); as b) {
      <pos-open-bale [bale]="b" (closed)="opening.set(null)" (opened)="opened($event)" />
    }
    @if (camera()) {
      <pos-camera-scan (closed)="camera.set(false)" (scanned)="camera.set(false); code($event)" />
    }
    @if (paying()) {
      <pos-pay-sheet [lines]="cart()" [discount]="math().discount" [total]="math().total" [customer]="customer()" [note]="note()" (closed)="paying.set(false)" (finished)="paying.set(false); clear(false)" (pickCustomer)="customers.set(true)" />
    }
  `,
})
export class TillPage implements OnInit, OnDestroy {
  readonly api = inject(Api);
  readonly shelf = inject(Shelf);
  private readonly scanner = inject(Scanner);
  private readonly ask = inject(Ask);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  /** From a bale's "Sell" button: /?bale=B-00012 */
  readonly bale = input<string>();

  readonly fmt = money;
  readonly query = signal('');
  readonly filter = signal('all');
  readonly cart = signal<CartLine[]>([]);
  readonly discount = signal<{ mode: 'amount' | 'percent'; value: number }>({ mode: 'amount', value: 0 });
  readonly customer = signal<Customer | null>(null);
  readonly note = signal('');

  readonly ticket = signal(false);
  readonly paying = signal(false);
  readonly customers = signal(false);
  readonly discounting = signal(false);
  readonly itemOpen = signal(false);
  readonly heldOpen = signal(false);
  readonly camera = signal(false);
  readonly opening = signal<Bale | null>(null);
  readonly busy = signal(false);

  readonly line = signal<CartLine | null>(null);
  readonly field = signal<'price' | 'quantity' | 'discount'>('price');
  readonly draft = signal<Record<'price' | 'quantity' | 'discount', string>>({ price: '', quantity: '', discount: '' });
  readonly draftDiscount = signal<{ mode: 'amount' | 'percent'; value: string }>({ mode: 'amount', value: '' });

  readonly who = signal('');
  readonly adding = signal(false);
  newName = '';
  newPhone = '';
  itemName = '';
  itemPrice = '';
  itemQty = '1';

  readonly held = signal<Held[]>([]);
  readonly heldCount = computed(() => Math.max(this.held().length, (this.shelf.snap()?.held ?? 0) + this.localHeld().length));
  private readonly localHeld = signal<Held[]>(this.readLocalHeld());
  private readonly restored = signal(false);
  private stop: (() => void) | undefined;

  readonly filters = computed(() => [{ key: 'all', label: 'All' }, { key: 'closed', label: 'Whole bales' }, { key: 'opened', label: 'Pieces' }, ...this.shelf.categories().map((c) => ({ key: `cat:${c}`, label: c }))]);
  readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.shelf.bales().filter((b) => {
      if (f === 'closed' && b.status !== 'IN_STOCK') return false;
      if (f === 'opened' && b.status !== 'OPENED') return false;
      if (f.startsWith('cat:') && b.category !== f.slice(4)) return false;
      return !q || [b.code, b.baleNo, b.item, b.category, b.grade, b.brand].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  });
  readonly shown = computed(() => this.matches().slice(0, SHOWN));
  readonly people = computed(() => {
    const q = this.who().trim().toLowerCase();
    return this.shelf.customers().filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)).slice(0, 60);
  });
  readonly discountAmount = computed(() => {
    const d = this.discount();
    const subtotal = this.cart().reduce((a, l) => a + this.lineTotal(l), 0);
    return d.mode === 'percent' ? round2((subtotal * d.value) / 100) : d.value;
  });
  readonly math = computed(() => billMath(this.cart().map((l) => ({ quantity: l.quantity, unitPrice: l.price, discount: l.discount })), this.discountAmount(), this.api.shop()));
  readonly pieces = computed(() => this.cart().reduce((a, l) => a + l.quantity, 0));

  constructor() {
    // The bill survives a page reload or the app being closed by mistake.
    effect(() => {
      const parked = this.park();
      if (!this.restored()) return; // do not wipe the kept bill before it has been read back
      if (parked.lines.length) localStorage.setItem(CART, JSON.stringify(parked));
      else localStorage.removeItem(CART);
    });
  }

  async ngOnInit() {
    // A scan counts only when the till itself is in front, not while a sheet is open over it.
    this.stop = this.scanner.listen((code) => {
      if (this.line() || this.discounting() || this.customers() || this.itemOpen() || this.heldOpen() || this.opening() || this.ask.question()) return;
      this.code(code);
    });
    if (!this.shelf.loaded()) await this.shelf.start();
    try {
      const kept = JSON.parse(localStorage.getItem(CART) ?? 'null') as Parked | null;
      if (kept?.lines?.length) this.restore(kept, true);
    } catch {
      localStorage.removeItem(CART);
    }
    this.restored.set(true);
    if (this.bale()) this.code(this.bale()!);
  }

  ngOnDestroy() {
    this.stop?.();
  }

  @HostListener('document:keydown', ['$event'])
  keys(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // A keyboard till types into the number sheets: digits, Backspace, Tab to the next box, Enter to finish.
    const numberSheet = this.line() ? 'line' : this.discounting() ? 'discount' : '';
    if (numberSheet && !this.ask.question()) {
      const press = (k: string) => (numberSheet === 'line' ? this.lineKey(k) : this.discountKey(k));
      if (/^[0-9.]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') numberSheet === 'line' ? this.saveLine(this.line()!) : this.saveDiscount();
      else if (e.key === 'Tab' && numberSheet === 'line') {
        const order = this.fields(this.line()!).map((f) => f.key);
        this.pickField(order[(order.indexOf(this.field()) + (e.shiftKey ? order.length - 1 : 1)) % order.length]);
      } else return;
      e.preventDefault();
      return;
    }
    if (this.paying() || this.line() || this.opening() || this.customers() || this.itemOpen() || this.heldOpen() || this.ask.question()) return;
    const run = (work: () => void) => {
      e.preventDefault();
      work();
    };
    if (e.key === 'F2') run(() => this.box().nativeElement.focus());
    else if (e.key === 'F4') run(() => this.customers.set(true));
    else if (e.key === 'F8') run(() => void this.hold());
    else if (e.key === 'F9') run(() => this.pay());
  }

  meta(b: Bale) {
    return [b.grade ? `Grade ${b.grade}` : '', b.weightKg ? `${+b.weightKg} kg` : '', b.baleNo ?? ''].filter(Boolean).join(' · ');
  }
  price(b: Bale) {
    return Number(b.status === 'OPENED' ? b.piecePrice : b.salePrice) || 0;
  }
  lineTotal(l: CartLine) {
    return round2(l.quantity * l.price - l.discount);
  }
  inCart(b: Bale) {
    return this.cart().some((l) => l.bale?.id === b.id);
  }

  // ---- Finding ----

  /** Enter in the search box: an exact sticker number goes on the bill; one match goes on; several stay listed. */
  enter() {
    const q = this.query().trim();
    if (!q) return;
    const exact = this.shelf.find(q);
    const only = this.matches().length === 1 ? this.matches()[0] : undefined;
    if (exact ?? only) {
      if (this.add((exact ?? only)!)) this.query.set('');
    } else if (!this.matches().length) void this.unknown(q);
  }

  /** A scanned sticker (scanner or camera). */
  code(code: string) {
    const bale = this.shelf.find(code);
    if (bale) this.add(bale);
    else void this.unknown(code);
  }

  /** Not on this till's shelf: the server may know why (sold, other branch). */
  private async unknown(code: string) {
    navigator.vibrate?.([80, 60, 80]);
    try {
      const bale = await this.api.get<Bale>(`/bales/by-code/${encodeURIComponent(code)}`);
      if (bale.status === 'IN_STOCK' || bale.status === 'OPENED') {
        this.shelf.put(bale);
        this.add(bale);
      } else this.api.say(`Bale ${bale.code} is ${{ SOLD: 'already sold', FINISHED: 'finished', IN_TRANSIT: 'on the way to another branch', WRITTEN_OFF: 'written off' }[bale.status as string] ?? 'not on the shelf'}.`, true);
    } catch {
      this.api.say(`No bale on this shelf has the number "${code}".`, true);
    }
  }

  // ---- The bill ----

  /** A closed bale goes on whole; an opened bale as one more piece. */
  add(bale: Bale): boolean {
    const have = this.cart().find((l) => l.bale?.id === bale.id);
    if (bale.status === 'OPENED') {
      if (have) return this.step(have, 1);
      if (bale.piecesLeft < 1) return this.no(`Bale ${bale.code} has no pieces left.`);
      this.push({ key: uid(), kind: 'PIECE', bale, name: [bale.item, bale.grade].filter(Boolean).join(' · '), quantity: 1, price: Number(bale.piecePrice) || 0, discount: 0 });
    } else {
      if (have) return this.no(`Bale ${bale.code} is already on the bill.`);
      this.push({ key: uid(), kind: 'BALE', bale, name: [bale.item, bale.grade].filter(Boolean).join(' · '), quantity: 1, price: Number(bale.salePrice) || 0, discount: 0 });
    }
    return true;
  }

  private push(l: CartLine) {
    this.cart.update((c) => [...c, l]);
    navigator.vibrate?.(25);
    if (!l.price) this.edit(l); // no price on the sticker: ask now, not at the end
  }

  step(l: CartLine, by: number): boolean {
    const wanted = l.quantity + by;
    if (wanted < 1) {
      this.remove(l);
      return true;
    }
    const most = l.kind === 'PIECE' ? l.bale!.piecesLeft : 9999;
    if (wanted > most) return this.no(`Bale ${l.bale!.code} has ${most} pieces left.`);
    this.change(l, { quantity: wanted });
    return true;
  }

  private change(l: CartLine, patch: Partial<CartLine>) {
    this.cart.update((c) => c.map((x) => (x.key === l.key ? { ...x, ...patch } : x)));
  }
  remove(l: CartLine) {
    this.cart.update((c) => c.filter((x) => x.key !== l.key));
    this.line.set(null);
    if (!this.cart().length) this.ticket.set(false);
  }
  private no(text: string): false {
    this.api.say(text, true);
    return false;
  }

  async clear(ask: boolean) {
    if (ask && this.cart().length > 1 && !(await this.ask.confirm('Clear this bill?', `${this.cart().length} lines will be taken off.`, 'Clear the bill', true))) return;
    this.cart.set([]);
    this.discount.set({ mode: 'amount', value: 0 });
    this.customer.set(null);
    this.note.set('');
    this.ticket.set(false);
    if (this.api.updateReady) {
      localStorage.removeItem(CART);
      return location.reload();
    }
    setTimeout(() => this.box()?.nativeElement.focus(), 0);
  }

  // ---- One line ----

  fields(l: CartLine): { key: 'price' | 'quantity' | 'discount'; label: string }[] {
    const price = { key: 'price' as const, label: l.kind === 'BALE' ? 'Bale price' : 'Price each' };
    const less = { key: 'discount' as const, label: 'Less (Rs)' };
    return l.kind === 'BALE' ? [price, less] : [price, { key: 'quantity' as const, label: l.kind === 'PIECE' ? 'Pieces' : 'How many' }, less];
  }
  edit(l: CartLine) {
    this.draft.set({ price: l.price ? String(l.price) : '', quantity: String(l.quantity), discount: l.discount ? String(l.discount) : '' });
    this.field.set('price');
    this.fresh = true;
    this.line.set(l);
  }
  /** The first key in a field replaces what was there, like a calculator. */
  private fresh = true;
  pickField(key: 'price' | 'quantity' | 'discount') {
    this.field.set(key);
    this.fresh = true;
  }
  lineKey(k: string) {
    const f = this.field();
    const from = this.fresh && k !== 'back' ? '' : this.draft()[f];
    this.fresh = false;
    this.draft.update((d) => ({ ...d, [f]: k === '00' ? press(press(from, '0'), '0') : f === 'quantity' && k === '.' ? from : press(from, k) }));
  }
  saveLine(l: CartLine) {
    const d = this.draft();
    const most = l.kind === 'PIECE' ? l.bale!.piecesLeft : 9999;
    const quantity = l.kind === 'BALE' ? 1 : Math.min(Math.max(Math.floor(typed(d.quantity)), 1), most);
    const price = typed(d.price);
    if (l.kind === 'PIECE' && typed(d.quantity) > most) this.api.say(`Bale ${l.bale!.code} has ${most} pieces left.`, true);
    this.change(l, { price, quantity, discount: Math.min(typed(d.discount), price * quantity) });
    this.line.set(null);
  }

  // ---- Discount, customer, other item ----

  startDiscount() {
    const d = this.discount();
    this.draftDiscount.set({ mode: d.mode, value: d.value ? String(d.value) : '' });
    this.discounting.set(true);
  }
  discountKey(k: string) {
    this.draftDiscount.update((d) => ({ ...d, value: k === '00' ? press(press(d.value, '0'), '0') : press(d.value, k) }));
  }
  saveDiscount() {
    const d = this.draftDiscount();
    const value = d.mode === 'percent' ? Math.min(typed(d.value), 100) : typed(d.value);
    this.discount.set({ mode: d.mode, value });
    this.discounting.set(false);
  }

  choose(c: Customer | null) {
    this.customer.set(c);
    this.customers.set(false);
    this.who.set('');
  }
  async addCustomer() {
    if (!this.newName.trim()) return this.api.say('Type the customer\'s name.', true);
    this.busy.set(true);
    try {
      const c = await this.api.post<Customer>('/customers', { name: this.newName, phone: this.newPhone });
      this.shelf.customers.update((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name)));
      this.adding.set(false);
      this.choose(c);
    } catch (e) {
      this.api.say(this.api.unreachable(e) ? 'A new customer needs the shop server. Sell to a walk-in customer for now.' : this.api.why(e), true);
    } finally {
      this.busy.set(false);
    }
  }

  startItem() {
    this.itemName = '';
    this.itemPrice = '';
    this.itemQty = '1';
    this.itemOpen.set(true);
  }
  addItem() {
    if (!this.itemName.trim() || typed(this.itemPrice) <= 0) return this.api.say('Type what it is and its price.', true);
    this.cart.update((c) => [...c, { key: uid(), kind: 'ITEM', bale: null, name: this.itemName.trim(), quantity: Math.max(1, Math.floor(typed(this.itemQty))), price: typed(this.itemPrice), discount: 0 }]);
    this.itemOpen.set(false);
  }

  opened(bale: Bale) {
    this.opening.set(null);
    this.shelf.put(bale);
    this.add(bale);
  }

  // ---- Pay, hold ----

  pay() {
    if (!this.cart().length) return;
    const unpriced = this.cart().find((l) => l.price <= 0);
    if (unpriced) {
      this.api.say(`Set a price for ${unpriced.name}.`, true);
      return this.edit(unpriced);
    }
    this.paying.set(true);
  }

  private park(): Parked {
    return { lines: this.cart().map((l) => ({ baleId: l.bale?.id ?? null, kind: l.kind, name: l.name, quantity: l.quantity, price: l.price, discount: l.discount })), discount: this.discount(), customerId: this.customer()?.id ?? null, note: this.note() };
  }

  /** Puts a parked bill back on the till. Bales that were sold meanwhile are left off, and said. */
  private restore(p: Parked, quiet = false) {
    const gone: string[] = [];
    const lines: CartLine[] = [];
    for (const l of p.lines) {
      const bale = l.baleId ? (this.shelf.bales().find((b) => b.id === l.baleId) ?? null) : null;
      if (l.baleId && (!bale || (l.kind === 'BALE' && bale.status !== 'IN_STOCK') || (l.kind === 'PIECE' && bale.status !== 'OPENED'))) gone.push(l.name);
      else lines.push({ key: uid(), kind: l.kind, bale, name: l.name, quantity: l.kind === 'PIECE' ? Math.min(l.quantity, bale!.piecesLeft) : l.quantity, price: l.price, discount: l.discount });
    }
    this.cart.set(lines);
    this.discount.set(p.discount ?? { mode: 'amount', value: 0 });
    this.customer.set(this.shelf.customers().find((c) => c.id === p.customerId) ?? null);
    this.note.set(p.note ?? '');
    if (gone.length && !quiet) this.api.say(`No longer on the shelf, left off the bill: ${gone.join(', ')}.`, true);
  }

  private readLocalHeld(): Held[] {
    try {
      return JSON.parse(localStorage.getItem(HELD) ?? '[]');
    } catch {
      return [];
    }
  }
  private saveLocalHeld(list: Held[]) {
    localStorage.setItem(HELD, JSON.stringify(list));
    this.localHeld.set(list);
  }

  async hold() {
    if (!this.cart().length) return;
    const label = this.customer()?.name ?? `Bill of ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const body = { label, total: this.math().total, payload: this.park() };
    try {
      await this.api.post('/held', body, 6000);
      this.shelf.snap.update((s) => (s ? { ...s, held: s.held + 1 } : s));
    } catch (e) {
      if (!this.api.unreachable(e)) return this.api.say(this.api.why(e), true);
      this.saveLocalHeld([{ id: uid(), label, total: String(body.total), userName: this.api.session()?.user.name ?? '', createdAt: new Date().toISOString(), payload: body.payload, local: true }, ...this.localHeld()]);
    }
    this.clear(false);
    this.api.say(`On hold: ${label}`);
  }

  async openHeld() {
    this.heldOpen.set(true);
    let server: Held[] = [];
    try {
      server = await this.api.get<Held[]>('/held');
      this.shelf.snap.update((s) => (s ? { ...s, held: server.length } : s));
    } catch {
      /* offline: only the bills held on this device */
    }
    this.held.set([...this.localHeld(), ...server]);
  }

  async take(h: Held) {
    if (this.cart().length && !(await this.ask.confirm('Replace the bill on the till?', 'The bill being made now will be cleared. Hold it first if you still need it.', 'Replace it', true))) return;
    try {
      if (h.local) this.saveLocalHeld(this.localHeld().filter((x) => x.id !== h.id));
      else {
        await this.api.delete(`/held/${h.id}`);
        this.shelf.snap.update((s) => (s ? { ...s, held: Math.max(0, s.held - 1) } : s));
      }
      this.held.update((list) => list.filter((x) => x.id !== h.id));
      this.restore(h.payload);
      this.heldOpen.set(false);
      this.ticket.set(true);
    } catch (e) {
      this.api.say(this.api.why(e), true);
      void this.openHeld();
    }
  }
}
