import { Component, computed, HostListener, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Api, Customer, Method, METHODS, money, MoneyPipe, round2, Sale, typed, whatsapp } from '../core';
import { Printer } from '../hardware/printer';
import { receiptModel, receiptText } from '../hardware/receipt';
import { Scanner } from '../hardware/scanner';
import { CartLine, Shelf, Tender } from '../offline/shelf';
import { Icon } from '../ui/icon';
import { Numpad, press } from '../ui/numpad';
import { Sheet } from '../ui/sheet';

/**
 * Taking the money. Nothing typed and "Complete" means the exact amount in cash. Cash, bank and wallet can be mixed;
 * what is not paid goes on the chosen customer's khata. After saving: the change to give back, print, new sale.
 */
@Component({
  selector: 'pos-pay-sheet',
  imports: [Sheet, Numpad, Icon, MoneyPipe],
  template: `
    <pos-sheet [heading]="sale() ? 'Bill ' + sale()!.code : 'Take payment'" [wide]="!sale()" (closed)="sale() ? finished.emit() : closed.emit()">
      @if (sale(); as s) {
        <!-- Saved -->
        <div class="flex flex-col items-center py-2 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-full bg-pay-600 text-white"><pos-icon name="check" size="h-9 w-9" /></div>
          @if (+s.changeGiven > 0) {
            <div class="mt-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Give back</div>
            <div class="num text-5xl font-extrabold tracking-tight text-pay-700">{{ s.changeGiven | money }}</div>
          } @else {
            <div class="mt-4 text-2xl font-bold">Paid {{ s.paidTotal | money }}</div>
          }
          @if (+s.creditAmount > 0) {
            <div class="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{{ s.creditAmount | money }} put on {{ s.customerName }}'s khata</div>
          }
          @if (s.waiting) {
            <div class="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Saved on this device. It will be sent to the shop server when the connection is back.</div>
          }
          <div class="mt-5 grid w-full grid-cols-2 gap-2">
            <button class="btn-soft" (click)="print(s)"><pos-icon name="print" /> Print bill</button>
            <a class="btn-soft" [href]="wa(s)" target="_blank" rel="noopener"><pos-icon name="receipt" /> WhatsApp</a>
          </div>
          <button class="btn-pay mt-2" (click)="finished.emit()" autofocus>New sale</button>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_280px] md:gap-5">
          <div class="min-w-0">
            <div class="rounded-2xl bg-brand-950 px-5 py-4 text-white">
              <div class="text-xs font-semibold uppercase tracking-widest text-brand-300">To pay</div>
              <div class="num text-4xl font-extrabold tracking-tight">{{ total() | money }}</div>
              @if (customer(); as c) {
                <div class="mt-1 text-sm text-brand-200">{{ c.name }}{{ +c.balance > 0 ? ' · owes ' + fmt(c.balance) : '' }}</div>
              }
            </div>

            <div class="mt-3 grid grid-cols-1 gap-2" role="radiogroup" aria-label="Paid by">
              @for (m of methods; track m.key) {
                <button type="button" class="flex min-h-[54px] items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left transition md:min-h-[60px]" [class]="active() === m.key ? 'border-brand-600 bg-brand-50' : 'border-stone-200 bg-white'" (click)="active.set(m.key)" role="radio" [attr.aria-checked]="active() === m.key">
                  <span class="text-base font-semibold">{{ m.label }}</span>
                  <span class="num text-xl font-bold" [class]="amounts()[m.key] ? 'text-stone-900' : 'text-stone-300'">{{ amounts()[m.key] ? fmt(amounts()[m.key]) : 'Rs 0' }}</span>
                </button>
              }
            </div>

            <div class="scroll-x mt-3">
              <button class="chip" (click)="exact()">Exact {{ fmt(leftFor()) }}</button>
              @if (active() === 'CASH') {
                @for (q of quick(); track q) {
                  <button class="chip num" (click)="set(q)">{{ fmt(q) }}</button>
                }
              }
              <button class="chip" (click)="set(0)">Clear</button>
            </div>

            <div class="mt-3 rounded-2xl px-4 py-3 text-base font-semibold" [class]="tone()" role="status">
              <div class="flex items-baseline justify-between gap-3"><span>{{ state().label }}</span><span class="num text-2xl font-extrabold">{{ state().amount | money }}</span></div>
              @if (state().kind === 'short') {
                <button class="mt-1 text-sm font-semibold underline" (click)="pickCustomer.emit()">Choose a customer to put it on khata</button>
              }
            </div>
            @if (customer() && state().kind !== 'khata-all') {
              <button class="mt-2 text-sm font-semibold text-brand-700 underline" (click)="allKhata()">Put the whole bill on khata</button>
            }
            @if (error()) {
              <p class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">{{ error() }}</p>
            }
          </div>

          <div class="flex min-w-0 flex-col gap-3">
            <pos-numpad (key)="key($event)" />
            <!-- On a phone the button stays in reach while the sheet scrolls. -->
            <div class="sticky bottom-0 -mx-1 bg-white px-1 pb-1 pt-1 md:static">
              <button class="btn-pay" [disabled]="busy() || state().kind === 'short'" (click)="complete()">{{ busy() ? 'Saving…' : 'Complete sale' }}</button>
            </div>
          </div>
        </div>
      }
    </pos-sheet>
  `,
})
export class PaySheet implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  private readonly printer = inject(Printer);
  private readonly scanner = inject(Scanner);
  private stopScans: (() => void) | undefined;

  readonly lines = input.required<CartLine[]>();
  readonly discount = input.required<number>();
  readonly total = input.required<number>();
  readonly customer = input<Customer | null>(null);
  readonly note = input('');
  readonly closed = output<void>();
  readonly finished = output<void>();
  readonly pickCustomer = output<void>();

  readonly methods = METHODS;
  readonly fmt = money;
  readonly active = signal<Method>('CASH');
  readonly amounts = signal<Record<Method, string>>({ CASH: '', BANK: '', WALLET: '' });
  private readonly khataAll = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly sale = signal<Sale | null>(null);

  readonly paid = computed(() => round2(METHODS.reduce((a, m) => a + typed(this.amounts()[m.key]), 0)));
  /** What the active way of paying still has to cover. */
  readonly leftFor = computed(() => Math.max(0, round2(this.total() - this.paid() + typed(this.amounts()[this.active()]))));
  readonly quick = computed(() => {
    const due = this.leftFor();
    const out = new Set<number>();
    for (const step of [100, 500, 1000, 5000]) {
      const up = Math.ceil(due / step) * step;
      if (up > due) out.add(up);
    }
    return [...out].sort((a, b) => a - b).slice(0, 4);
  });
  readonly state = computed<{ kind: 'exact' | 'change' | 'khata' | 'khata-all' | 'short' | 'over'; label: string; amount: number }>(() => {
    const total = this.total();
    const paid = this.paid();
    const cash = typed(this.amounts().CASH);
    if (this.khataAll() && this.customer()) return { kind: 'khata-all', label: `All on ${this.customer()!.name}'s khata`, amount: total };
    if (paid === 0) return { kind: 'exact', label: 'Exact amount in cash', amount: total };
    if (paid > total) return paid - total > cash ? { kind: 'over', label: 'Bank and wallet are more than the bill by', amount: round2(paid - total) } : { kind: 'change', label: 'Give back', amount: round2(paid - total) };
    if (paid < total) return this.customer() ? { kind: 'khata', label: `On ${this.customer()!.name}'s khata`, amount: round2(total - paid) } : { kind: 'short', label: 'Still to pay', amount: round2(total - paid) };
    return { kind: 'exact', label: 'Paid in full', amount: paid };
  });
  readonly tone = computed(() => ({ exact: 'bg-stone-100 text-stone-800', change: 'bg-emerald-50 text-emerald-900', khata: 'bg-amber-50 text-amber-900', 'khata-all': 'bg-amber-50 text-amber-900', short: 'bg-red-50 text-red-800', over: 'bg-red-50 text-red-800' })[this.state().kind]);

  ngOnInit() {
    (document.activeElement as HTMLElement | null)?.blur(); // so number keys go to the pay sheet, not the search box
    // While money is being taken, a scan (or an amount typed very fast) must not put another bale on the bill.
    this.stopScans = this.scanner.listen(() => undefined);
  }

  ngOnDestroy() {
    this.stopScans?.();
  }

  set(value: number) {
    this.khataAll.set(false);
    this.error.set('');
    this.amounts.update((a) => ({ ...a, [this.active()]: value ? String(value) : '' }));
  }
  exact() {
    this.set(this.leftFor());
  }
  allKhata() {
    this.amounts.set({ CASH: '', BANK: '', WALLET: '' });
    this.khataAll.set(true);
  }
  key(k: string) {
    this.khataAll.set(false);
    this.error.set('');
    this.amounts.update((a) => ({ ...a, [this.active()]: k === '00' ? (a[this.active()] ? press(press(a[this.active()], '0'), '0') : '') : press(a[this.active()], k) }));
  }

  /** A keyboard till: digits type the amount, Enter completes, Backspace deletes. */
  @HostListener('document:keydown', ['$event'])
  typedKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.sale()) this.finished.emit();
      else if (!this.busy() && this.state().kind !== 'short') void this.complete();
    } else if (!this.sale() && /^[0-9.]$/.test(e.key)) this.key(e.key);
    else if (!this.sale() && e.key === 'Backspace') this.key('back');
  }

  async complete() {
    const state = this.state();
    if (state.kind === 'over') return this.error.set('Bank and wallet payments together cannot be more than the bill. Change can only be given from cash.');
    const tenders: Tender[] = state.kind === 'khata-all' ? [] : this.paid() === 0 ? [{ method: 'CASH', amount: this.total() }] : METHODS.map((m) => ({ method: m.key, amount: typed(this.amounts()[m.key]) })).filter((t) => t.amount > 0);
    this.busy.set(true);
    this.error.set('');
    try {
      const sale = await this.shelf.sell({ lines: this.lines(), discount: this.discount(), customer: this.customer(), note: this.note(), tenders });
      this.sale.set(sale);
      const cash = tenders.some((t) => t.method === 'CASH');
      const auto = this.printer.config().receipt.auto;
      // The drawer opens with the bill when it prints; otherwise it is opened on its own for cash.
      if (auto) void this.printer.receipt(sale, { drawer: cash }).catch((e) => this.api.say(this.api.why(e), true));
      else if (cash) void this.printer.drawer().catch(() => undefined);
    } catch (e) {
      this.error.set(this.api.why(e));
      void this.shelf.refresh(); // stock changed under us: show what is really there
    } finally {
      this.busy.set(false);
    }
  }

  async print(sale: Sale) {
    try {
      await this.printer.receipt(sale);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  wa(sale: Sale): string {
    const shop = this.api.shop();
    return shop ? whatsapp(sale.customerPhone, receiptText(receiptModel(sale, shop, this.api.branch()))) : '#';
  }
}
