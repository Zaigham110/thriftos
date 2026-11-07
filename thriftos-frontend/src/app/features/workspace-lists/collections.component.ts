import { HttpClient } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule, MessageCircle, Plus } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { KhataService, WhatsappMessage } from '../../modules/sales/khata.service';
import type { PaymentMethod } from '../../modules/sales/sales.models';
import { ToastService } from '../../shared/floor/toast.service';
import { localPhone } from '../../shared/phone';
import {
  WsColumn,
  WsDataGridComponent,
  WsFilterBarComponent,
  WsKpiCardComponent,
  WsPageHeaderComponent,
  WsRow,
  WsSideSheetComponent,
  WsStateComponent,
} from '../../shared/ui/workspace';

const METHODS: readonly PaymentMethod[] = ['CASH', 'JAZZCASH', 'EASYPAISA', 'RAAST', 'BANK', 'OTHER'];

export const AGE_KEYS = ['0-30', '31-60', '61-90', '90+'] as const;
type Buckets = Record<(typeof AGE_KEYS)[number], string>;
type PromiseStatus = 'OPEN' | 'DUE_TODAY' | 'KEPT' | 'BROKEN' | 'CANCELLED';
export interface WorklistRow {
  id: string; name: string; phone: string | null; city: string | null; balance: string; buckets: Buckets; overdueDays: number;
  creditLimit: string | null; overLimit: boolean; lastPayment: { date: string; amount: string } | null; lastReminder: string | null;
  promise: { id: string; amount: string; promisedFor: string; status: PromiseStatus; paid: string } | null;
}
export interface Worklist {
  totals: { owed: string; advance: string; customers: number; buckets: Buckets };
  rows: WorklistRow[];
}

type AgeView = `age${(typeof AGE_KEYS)[number]}`;
type View = 'all' | 'today' | 'broken' | 'old' | 'overLimit' | 'notReminded' | 'everyone' | AgeView;
const VIEWS: View[] = ['all', 'today', 'broken', 'old', 'overLimit', 'notReminded', 'everyone', ...AGE_KEYS.map((k) => `age${k}` as AgeView)];
const WEEK = 7 * 86_400_000;
/** A customer who owes nothing, from the same endpoint (`settled`). */
interface SettledRow { id: string; name: string; phone: string | null; city: string | null; advance: string; lastPayment: { date: string; amount: string } | null; isActive: boolean }

/**
 * Receivables (enterprise plan E3.5, v2 review): who owes what and for how long, as one strip by age that filters
 * the list, the day's views (promised today, broken promises, over 60 days…) and every customer on request.
 * Each row takes a payment or sends a WhatsApp reminder; "Send reminders" works through the customers shown,
 * oldest debt first. The view and the search live in the address, so Back from a customer comes back here.
 */
@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe, WsDataGridComponent, WsFilterBarComponent, WsKpiCardComponent, WsPageHeaderComponent, WsSideSheetComponent, WsStateComponent],
  template: `
    @if (failed()) {
      <ws-state kind="error" (retry)="load()" />
    } @else if (data(); as d) {
      <div class="page">
        <ws-page-header [heading]="'ws.collections.title' | t" [subtitle]="'ws.collections.subtitle' | t: { n: i18n.num(d.totals.customers) }">
          <button actions type="button" class="ws-btn" [disabled]="!remindable().length" (click)="remindShown()"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.rc.remindShown' | t: { n: remindable().length } }}</button>
          <button actions type="button" class="ws-btn primary" (click)="newCustomer()"><lucide-icon [img]="icons.Plus" [size]="16" aria-hidden="true" />{{ 'sell.newCustomer' | t }}</button>
        </ws-page-header>
        <section class="kpis">
          <ws-kpi-card [label]="'ws.collections.owed' | t" [value]="i18n.money(d.totals.owed)" />
          <ws-kpi-card [label]="'ws.collections.over90' | t" [value]="i18n.money(d.totals.buckets['90+'])" [hint]="'ws.collections.over90Hint' | t" />
          <ws-kpi-card [label]="'ws.rc.advance' | t" [value]="i18n.money(d.totals.advance)" [hint]="'ws.rc.advanceHint' | t" />
        </section>

        <!-- How old the debt is: one strip; a part filters the list to the customers with money that old. -->
        <div class="ageing" role="group" [attr.aria-label]="'ws.collections.ageing' | t">
          @for (k of ageKeys; track k) {
            <button type="button" [class.on]="view() === 'age' + k" [class.hot]="(k === '61-90' || k === '90+') && +d.totals.buckets[k] > 0" [attr.aria-pressed]="view() === 'age' + k" (click)="setView(view() === 'age' + k ? 'all' : $any('age' + k))">
              <span>{{ 'ws.stockValue.age.' + k | t }}</span>
              <strong>{{ i18n.money(d.totals.buckets[k]) }}</strong>
              <small>{{ 'ws.rc.customersN' | t: { n: count($any('age' + k)) } }}</small>
            </button>
          }
        </div>

        <div class="views" role="group" [attr.aria-label]="'ws.collections.show' | t">
          @for (v of chips; track v) {
            <button type="button" class="ws-btn" [class.on]="view() === v" [attr.aria-pressed]="view() === v" (click)="setView(v)">
              {{ 'ws.collections.view.' + v | t }} <span class="n">{{ count(v) }}</span>
            </button>
          }
        </div>
        <ws-filter-bar [query]="query()" (queryChange)="setQuery($event)" [placeholder]="'ws.collections.search' | t" [chips]="[]" />

        <ws-data-grid [caption]="'ws.collections.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" [selectable]="view() !== 'everyone'"
          [(selected)]="selected" (rowClick)="open($event)" [rowActions]="rowActions()" (rowAction)="act($event)" [emptyHeading]="'ws.collections.empty' | t">
          <button bulk type="button" class="ws-btn primary" (click)="startReminders()"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.collections.remind' | t: { n: selected().length } }}</button>
        </ws-data-grid>
      </div>

      <ws-side-sheet [open]="queue().length > 0" [heading]="'ws.collections.reminders' | t" (close)="queue.set([])">
        @if (current(); as c) {
          <div class="queue">
            <p class="step">{{ 'ws.collections.step' | t: { i: position() + 1, n: queue().length } }}</p>
            <h3>{{ c.name }}</h3>
            <p>{{ i18n.money(c.balance) }} · {{ c.phone ? phone(c.phone) : ('ws.collections.noPhone' | t) }}</p>
            @if (c.lastReminder) { <p class="muted">{{ 'ws.collections.lastReminder' | t: { date: date(c.lastReminder) } }}</p> }
            <div class="row">
              <button type="button" class="ws-btn primary" [disabled]="!c.phone" (click)="remind(c)"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.collections.openWhatsapp' | t }}</button>
              <button type="button" class="ws-btn" (click)="next()">{{ (position() + 1 < queue().length ? 'ws.collections.next' : 'ws.collections.done') | t }}</button>
            </div>
            <p class="muted">{{ 'ws.collections.queueHint' | t }}</p>
          </div>
        }
      </ws-side-sheet>

      <ws-side-sheet [open]="!!paying()" [heading]="'ws.customer.receive' | t" (close)="paying.set(null)">
        @if (paying(); as c) {
          <form class="form" id="ws-rc-pay" (ngSubmit)="receive()">
            <h3>{{ c.name }}</h3>
            <p class="muted">{{ 'ws.customer.receiveHint' | t: { balance: i18n.money(c.balance) } }}</p>
            <label>{{ 'ws.sale.amount' | t }}<input name="amount" type="number" min="1" step="1" required [(ngModel)]="amount" /></label>
            <label>{{ 'ws.sale.method' | t }}
              <select name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
            </label>
            <label>{{ 'ws.sale.reference' | t }}<input name="reference" maxlength="80" [(ngModel)]="reference" /></label>
          </form>
        }
        <ng-container footer>
          <button type="button" class="ws-btn" (click)="paying.set(null)">{{ 'common.cancel' | t }}</button>
          <button type="submit" form="ws-rc-pay" class="ws-btn primary" [disabled]="busy() || !amount || amount < 1">{{ 'ws.customer.saveReceipt' | t }}</button>
        </ng-container>
      </ws-side-sheet>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .ageing { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); overflow:hidden; }
    .ageing button { display:grid; gap:2px; padding:var(--ws-3) var(--ws-4); border:0; background:transparent; color:var(--ws-ink); font:inherit; text-align:start; cursor:pointer; }
    .ageing button + button { border-inline-start:1px solid var(--ws-line); }
    .ageing button:hover { background:var(--ws-surface-hover); }
    .ageing button.on { background:var(--ws-brand-soft); box-shadow:inset 0 -3px 0 var(--ws-brand); }
    .ageing span, .ageing small { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .ageing strong { font-size:var(--ws-text-lg, 1.125rem); font-variant-numeric:tabular-nums; }
    .ageing button.hot strong { color:var(--ws-bad); }
    .views { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .views .on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); }
    .n { padding:0 6px; border-radius:10px; background:var(--ws-surface-2); color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .queue, .form { display:grid; gap:var(--ws-2); }
    .form { gap:var(--ws-3); }
    .form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .form input, .form select { padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .queue h3, .form h3 { margin:0; font-size:var(--ws-text-lg, 1.125rem); }
    .queue p, .form p { margin:0; }
    .step, .muted { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .row { display:flex; flex-wrap:wrap; gap:var(--ws-2); margin-block:var(--ws-2); }
    @media (max-width: 720px) { .ageing { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
  `],
})
export class CollectionsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly khata = inject(KhataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly nav = inject(NavService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly icons = { MessageCircle, Plus };
  protected readonly ageKeys = AGE_KEYS;
  protected readonly chips: View[] = ['all', 'today', 'broken', 'old', 'overLimit', 'notReminded', 'everyone'];
  protected readonly methods = METHODS;
  protected readonly phone = localPhone;
  /** ?view= and ?q= from the address (Back from a customer keeps them). */
  readonly viewParam = input<string | undefined>(undefined, { alias: 'view' });
  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });

  protected readonly data = signal<(Worklist & { settled?: SettledRow[] }) | null>(null);
  protected readonly failed = signal(false);
  protected readonly view = computed<View>(() => (VIEWS as string[]).includes(this.viewParam() ?? '') ? (this.viewParam() as View) : 'all');
  protected readonly query = computed(() => this.qParam() ?? '');
  protected readonly selected = signal<string[]>([]);
  protected readonly queue = signal<WorklistRow[]>([]);
  protected readonly position = signal(0);
  protected readonly current = computed(() => this.queue()[this.position()] ?? null);
  protected readonly paying = signal<WorklistRow | null>(null);
  protected readonly busy = signal(false);
  protected amount: number | null = null;
  protected method: PaymentMethod = 'CASH';
  protected reference = '';

  private match(r: WorklistRow, v: View, now = Date.now()): boolean {
    switch (v) {
      case 'today': return r.promise?.status === 'DUE_TODAY';
      case 'broken': return r.promise?.status === 'BROKEN';
      case 'old': return +r.buckets['61-90'] > 0 || +r.buckets['90+'] > 0;
      case 'overLimit': return r.overLimit;
      case 'notReminded': return !r.lastReminder || now - new Date(r.lastReminder).getTime() > WEEK;
      case 'age0-30': case 'age31-60': case 'age61-90': case 'age90+': return +r.buckets[v.slice(3) as (typeof AGE_KEYS)[number]] > 0;
      default: return true;
    }
  }
  protected count(v: View): number {
    const d = this.data();
    if (v === 'everyone') return (d?.rows.length ?? 0) + (d?.settled?.length ?? 0);
    return (d?.rows ?? []).filter((r) => this.match(r, v)).length;
  }
  private readonly owing = computed(() => {
    const q = this.query().trim().toLowerCase();
    return (this.data()?.rows ?? []).filter((r) => this.match(r, this.view()) && this.found(r, q));
  });
  private found(r: { name: string; city: string | null; phone: string | null }, q: string): boolean {
    return !q || r.name.toLowerCase().includes(q) || (r.city ?? '').toLowerCase().includes(q) || (r.phone ?? '').includes(q) || localPhone(r.phone).replace(/\s/g, '').includes(q.replace(/\s/g, ''));
  }
  /** Who "Send reminders" works through: the customers shown with a number, oldest debt first. */
  protected readonly remindable = computed(() => this.owing().filter((r) => !!r.phone).sort((a, b) => b.overdueDays - a.overdueDays));

  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'name', label: this.i18n.t('ws.col.customer') },
    { key: 'city', label: this.i18n.t('ws.col.city') },
    { key: 'balance', label: this.i18n.t('ws.collections.balance'), format: 'money', total: true, round: true },
    ...AGE_KEYS.map((k) => ({ key: `age${k}`, label: this.i18n.t(`ws.stockValue.age.${k}`), format: 'money' as const, total: true, round: true, blankZero: true })),
    { key: 'promise', label: this.i18n.t('ws.collections.promise') },
    { key: 'lastPayment', label: this.i18n.t('ws.collections.lastPayment') },
    { key: 'lastReminder', label: this.i18n.t('ws.collections.reminded'), format: 'date' },
  ]);
  protected readonly rowActions = computed(() => [
    { id: 'receive', label: this.i18n.t('ws.rc.receive') },
    { id: 'remind', label: this.i18n.t('ws.rc.remind') },
  ]);
  protected readonly rows = computed<WsRow[]>(() => {
    const owing: WsRow[] = this.owing().map((r) => ({
      id: r.id, name: r.overLimit ? `${r.name} · ${this.i18n.t('ws.collections.overLimitTag')}` : r.name, city: r.city, balance: r.balance,
      ...Object.fromEntries(AGE_KEYS.map((k) => [`age${k}`, r.buckets[k]])),
      promise: r.promise ? `${this.i18n.money(r.promise.amount)} · ${this.dayLabel(r.promise.promisedFor)} · ${this.i18n.t(`ws.promise.${r.promise.status}`)}` : null,
      lastPayment: r.lastPayment ? `${this.i18n.money(r.lastPayment.amount)} · ${this.date(r.lastPayment.date)}` : null,
      lastReminder: r.lastReminder,
      _actions: r.phone ? ['receive', 'remind'] : ['receive'],
    }));
    if (this.view() !== 'everyone') return owing;
    const q = this.query().trim().toLowerCase();
    const settled: WsRow[] = (this.data()?.settled ?? []).filter((c) => this.found(c, q)).map((c) => ({
      id: c.id, name: c.isActive ? c.name : `${c.name} · ${this.i18n.t('ws.rc.inactive')}`, city: c.city, balance: '0',
      ...Object.fromEntries(AGE_KEYS.map((k) => [`age${k}`, '0'])),
      promise: +c.advance > 0 ? this.i18n.t('ws.rc.paidAhead', { amount: this.i18n.money(c.advance) }) : null,
      lastPayment: c.lastPayment ? `${this.i18n.money(c.lastPayment.amount)} · ${this.date(c.lastPayment.date)}` : null,
      lastReminder: null,
      _actions: ['receive'],
    }));
    return [...owing, ...settled];
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<Worklist & { settled?: SettledRow[] }>('/api/workspace/receivables').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.failed.set(true),
    });
  }

  /** The view and the search go into the address (replaceUrl), so Back from a customer returns to them. */
  protected setView(v: View): void {
    this.selected.set([]);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { view: v === 'all' ? null : v }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected setQuery(q: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: q || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected date(v: string): string {
    return new Date(v).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', numberingSystem: 'latn' });
  }
  protected dayLabel(ymd: string): string {
    return this.date(ymd + 'T12:00:00Z');
  }

  protected open(row: WsRow): void {
    void this.nav.open(['/khata/records', row.id]);
  }

  protected newCustomer(): void {
    void this.nav.open(['/khata/records/new']);
  }

  protected act(e: { action: string; row: WsRow }): void {
    const owing = this.data()?.rows.find((r) => r.id === e.row.id);
    if (e.action === 'remind' && owing) {
      this.remind(owing);
      return;
    }
    if (e.action === 'receive') {
      const settled = this.data()?.settled?.find((c) => c.id === e.row.id);
      const c = owing ?? (settled ? ({ ...settled, balance: '0', buckets: { '0-30': '0', '31-60': '0', '61-90': '0', '90+': '0' }, overdueDays: 0, creditLimit: null, overLimit: false, lastReminder: null, promise: null } as WorklistRow) : null);
      if (!c) return;
      this.amount = +c.balance > 0 ? Math.round(+c.balance) : null;
      this.method = 'CASH';
      this.reference = '';
      this.paying.set(c);
    }
  }

  protected receive(): void {
    const c = this.paying();
    if (!c || !this.amount) return;
    this.busy.set(true);
    this.khata.recordPayment({ customerId: c.id, amount: this.amount, method: this.method, reference: this.reference.trim() || undefined }).subscribe({
      next: () => {
        this.busy.set(false);
        this.paying.set(null);
        this.toast.show(this.i18n.t('ws.customer.receiptSaved'));
        this.load();
      },
      error: (e: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.toast.show(e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }

  protected remindShown(): void {
    this.position.set(0);
    this.queue.set(this.remindable());
  }

  protected startReminders(): void {
    const ids = new Set(this.selected());
    this.position.set(0);
    this.queue.set(this.owing().filter((r) => ids.has(r.id)));
  }

  protected remind(c: WorklistRow): void {
    this.khata.openWhatsapp(this.http.post<WhatsappMessage>(`/api/workspace/customers/${c.id}/remind`, { lang: this.i18n.lang() }), () =>
      this.toast.show(this.i18n.t('common.couldNotLoad')),
    );
  }

  protected next(): void {
    if (this.position() + 1 < this.queue().length) {
      this.position.set(this.position() + 1);
      return;
    }
    this.toast.show(this.i18n.t('ws.collections.sent', { n: this.queue().length }));
    this.queue.set([]);
    this.selected.set([]);
    this.load();
  }
}
