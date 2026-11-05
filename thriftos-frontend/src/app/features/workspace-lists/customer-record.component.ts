import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookOpen, CalendarCheck, Clock, Coins, FileText, Gauge, LucideAngularModule, MessageCircle, Receipt, Tags, Wallet } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService, serverLang } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { KhataService, WhatsappMessage } from '../../modules/sales/khata.service';
import type { PaymentMethod } from '../../modules/sales/sales.models';
import { ToastService } from '../../shared/floor/toast.service';
import {
  WsBarChartComponent,
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsSideSheetComponent,
  WsSmartButtonComponent,
  WsStateComponent,
  WsTab,
  WsTabsComponent,
} from '../../shared/ui/workspace';
import { AGE_KEYS } from './collections.component';

type Money = string | null;
/** GET /api/workspace/customers/:id (profit is null without cost.view). */
export interface Customer360 {
  customer: { id: string; name: string; phone: string | null; city: string | null; companyName: string | null; address: string | null; notes: string | null; createdAt: string; isActive: boolean; openingBalance: string; creditLimit: string | null; priceGroup: string | null };
  account: { balance: string; advance: string; openingDue: string; overdueDays: number; buckets: Record<(typeof AGE_KEYS)[number], string>; overLimit: boolean; limitUsedPercent: number | null };
  totals: { sales: number; sold: string; received: string; profit: Money; lastSale: string | null; lastPayment: string | null };
  months: { month: string; sold: string; received: string }[];
  sales: { id: string; number: string; date: string; total: string; paid: string; due: string; status: string }[];
  payments: { id: string; date: string; amount: string; method: string; reference: string | null; sale: string | null; hasPhoto: boolean }[];
  promises: { id: string; amount: string; promisedFor: string; note: string | null; createdAt: string; by: string | null; status: string; paid: string }[];
  reminders: { date: string; by: string | null }[];
}

const METHODS: readonly PaymentMethod[] = ['CASH', 'JAZZCASH', 'EASYPAISA', 'RAAST', 'BANK', 'OTHER'];

/**
 * A customer's 360 record (enterprise plan E3.5): balance and how old the debt is, credit limit, 12 months of
 * sales and payments, every sale with what is still due, payments, promises to pay and reminders, with the
 * activity panel. Receive a payment, send a WhatsApp reminder, note a promise or open the statement from here.
 */
@Component({
  selector: 'app-customer-record',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    TPipe,
    WsBarChartComponent,
    WsDataGridComponent,
    WsPageHeaderComponent,
    WsRecordActivityComponent,
    WsSideSheetComponent,
    WsSmartButtonComponent,
    WsStateComponent,
    WsTabsComponent,
  ],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.customer.notFound' | t" (retry)="reload()" />
    } @else if (data(); as d) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="d.customer.name" [subtitle]="subtitle()">
            <ng-container actions>
              <button type="button" class="ws-btn primary" (click)="sheet.set('payment')"><lucide-icon [img]="icons.Wallet" [size]="16" aria-hidden="true" />{{ 'ws.customer.receive' | t }}</button>
              @if (d.customer.phone && +d.account.balance > 0) {
                <button type="button" class="ws-btn" (click)="remind()"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.customer.remind' | t }}</button>
              }
              <button type="button" class="ws-btn" (click)="sheet.set('promise')"><lucide-icon [img]="icons.CalendarCheck" [size]="16" aria-hidden="true" />{{ 'ws.customer.promise' | t }}</button>
              <button type="button" class="ws-btn" (click)="limit = d.customer.creditLimit ? +d.customer.creditLimit : 0; sheet.set('limit')"><lucide-icon [img]="icons.Gauge" [size]="16" aria-hidden="true" />{{ 'ws.customer.setLimit' | t }}</button>
              @if (can('price.manage')) {
                <button type="button" class="ws-btn" (click)="openGroup()"><lucide-icon [img]="icons.Tags" [size]="16" aria-hidden="true" />{{ d.customer.priceGroup ?? ('ws.customer.priceList' | t) }}</button>
              }
              <a class="ws-btn" [routerLink]="['/statement', d.customer.id]"><lucide-icon [img]="icons.FileText" [size]="16" aria-hidden="true" />{{ 'ws.customer.statement' | t }}</a>
            </ng-container>
          </ws-page-header>

          @if (d.account.overLimit) {
            <p class="banner" role="status">{{ 'ws.customer.overLimit' | t: { limit: i18n.money(d.customer.creditLimit), used: d.account.limitUsedPercent ?? 0 } }}</p>
          }

          <section class="smart">
            <ws-smart-button [label]="'ws.collections.balance' | t" [value]="i18n.money(d.account.balance)" [icon]="icons.BookOpen" [tone]="+d.account.balance > 0 ? 'bad' : 'good'" [link]="[]" [query]="{ tab: 'sales' }" />
            <ws-smart-button [label]="'ws.customer.overdue' | t" [value]="'ws.customer.days' | t: { n: d.account.overdueDays }" [icon]="icons.Clock" [tone]="d.account.overdueDays > 60 ? 'bad' : 'plain'" [link]="[]" />
            <ws-smart-button [label]="'ws.customer.creditLimit' | t" [value]="d.customer.creditLimit ? i18n.money(d.customer.creditLimit) + ' · ' + d.account.limitUsedPercent + '%' : ('ws.customer.noLimit' | t)" [icon]="icons.Gauge" [tone]="d.account.overLimit ? 'bad' : 'plain'" [link]="[]" />
            <ws-smart-button [label]="'ws.customer.sold' | t" [value]="i18n.money(d.totals.sold)" [icon]="icons.Receipt" [link]="[]" [query]="{ tab: 'sales' }" />
            <ws-smart-button [label]="'ws.customer.received' | t" [value]="i18n.money(d.totals.received)" [icon]="icons.Wallet" tone="good" [link]="[]" [query]="{ tab: 'payments' }" />
            @if (d.totals.profit !== null) { <ws-smart-button [label]="'ws.col.profit' | t" [value]="i18n.money(d.totals.profit)" [icon]="icons.Coins" [link]="[]" /> }
          </section>

          <ol class="ageing" [attr.aria-label]="'ws.collections.ageing' | t">
            @for (k of ageKeys; track k) {
              <li [class.hot]="(k === '61-90' || k === '90+') && +d.account.buckets[k] > 0"><span>{{ 'ws.stockValue.age.' + k | t }}</span><strong>{{ i18n.money(d.account.buckets[k]) }}</strong></li>
            }
          </ol>

          <ws-bar-chart [heading]="'ws.customer.months' | t" [categories]="monthLabels()" [series]="monthSeries()" format="money" />

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="chosenTab.set($event)" [label]="d.customer.name" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()">
            @switch (tab()) {
              @case ('sales') { <ws-data-grid [caption]="'ws.container.tab.sales' | t" [columns]="saleColumns()" [rows]="saleRows()" [clickable]="true" (rowClick)="openSale($event)" [emptyHeading]="'ws.container.noSales' | t" /> }
              @case ('payments') { <ws-data-grid [caption]="'ws.sale.payments' | t" [columns]="paymentColumns()" [rows]="paymentRows()" [emptyHeading]="'ws.sale.noPayments' | t" /> }
              @case ('promises') {
                <ws-data-grid [caption]="'ws.customer.promises' | t" [columns]="promiseColumns()" [rows]="promiseRows()" [emptyHeading]="'ws.customer.noPromises' | t" [clickable]="true" (rowClick)="askCancel($event)" />
              }
              @case ('reminders') { <ws-data-grid [caption]="'ws.customer.reminders' | t" [columns]="reminderColumns()" [rows]="reminderRows()" [emptyHeading]="'ws.customer.noReminders' | t" /> }
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="customer" [recordId]="d.customer.id" /></aside>
      </div>

      <ws-side-sheet [open]="sheet() === 'payment'" [heading]="'ws.customer.receive' | t" (close)="sheet.set(null)">
        <form class="form" (ngSubmit)="receive()">
          <p class="hint">{{ 'ws.customer.receiveHint' | t: { balance: i18n.money(d.account.balance) } }}</p>
          <label>{{ 'ws.sale.amount' | t }}<input name="amount" type="number" min="1" step="1" required [(ngModel)]="amount" /></label>
          <label>{{ 'ws.sale.method' | t }}
            <select name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
          </label>
          <label>{{ 'ws.sale.reference' | t }}<input name="reference" maxlength="80" [(ngModel)]="reference" /></label>
          <button type="submit" class="ws-btn primary" [disabled]="busy() || !amount || amount < 1">{{ 'ws.customer.saveReceipt' | t }}</button>
        </form>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'promise'" [heading]="'ws.customer.promise' | t" (close)="sheet.set(null)">
        <form class="form" (ngSubmit)="addPromise()">
          <label>{{ 'ws.sale.amount' | t }}<input name="pamount" type="number" min="1" step="1" required [(ngModel)]="promiseAmount" /></label>
          <label>{{ 'ws.customer.promisedFor' | t }}<input name="pday" type="date" required [min]="today" [(ngModel)]="promiseDay" /></label>
          <label>{{ 'ws.customer.note' | t }}<input name="pnote" maxlength="300" [(ngModel)]="promiseNote" /></label>
          <button type="submit" class="ws-btn primary" [disabled]="busy() || !promiseAmount || !promiseDay">{{ 'ws.customer.savePromise' | t }}</button>
        </form>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'limit'" [heading]="'ws.customer.creditLimit' | t" (close)="sheet.set(null)">
        <form class="form" (ngSubmit)="saveLimit()">
          <p class="hint">{{ 'ws.customer.limitHint' | t }}</p>
          <label>{{ 'ws.customer.creditLimit' | t }}<input name="limit" type="number" min="0" step="1000" required [(ngModel)]="limit" /></label>
          <button type="submit" class="ws-btn primary" [disabled]="busy() || limit === null || limit < 0">{{ 'common.save' | t }}</button>
        </form>
      </ws-side-sheet>

      <ws-side-sheet [open]="sheet() === 'group'" [heading]="'ws.customer.priceList' | t" (close)="sheet.set(null)">
        <form class="form" (ngSubmit)="saveGroup()">
          <p class="hint">{{ 'ws.customer.priceListHint' | t }}</p>
          <label>{{ 'ws.customer.priceGroup' | t }}
            <input name="group" list="ws-price-groups" maxlength="40" [(ngModel)]="priceGroup" />
            <datalist id="ws-price-groups">@for (g of groups(); track g) { <option [value]="g"></option> }</datalist>
          </label>
          <button type="submit" class="ws-btn primary" [disabled]="busy()">{{ 'common.save' | t }}</button>
        </form>
      </ws-side-sheet>

      <ws-side-sheet [open]="!!cancelling()" [heading]="'ws.customer.cancelPromise' | t" (close)="cancelling.set(null)">
        <div class="form">
          <p class="hint">{{ cancelling()?.['label'] }}</p>
          <button type="button" class="ws-btn" [disabled]="busy()" (click)="cancelPromise()">{{ 'ws.customer.cancelPromise' | t }}</button>
        </div>
      </ws-side-sheet>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:var(--ws-3); }
    .banner { margin:0; padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-bad); border-radius:var(--ws-r-lg); background:var(--ws-bad-soft); color:var(--ws-bad); font-weight:600; }
    .ageing { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); overflow:hidden; }
    .ageing li { display:grid; gap:2px; padding:var(--ws-3) var(--ws-4); }
    .ageing li + li { border-inline-start:1px solid var(--ws-line); }
    .ageing li.hot strong { color:var(--ws-bad); }
    .ageing span { color:var(--ws-ink-2); font-size:var(--ws-text-xs); }
    .ageing strong { font-variant-numeric:tabular-nums; }
    .form { display:grid; gap:var(--ws-3); }
    .form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .form input, .form select { padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .hint { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
  `],
})
export class CustomerRecordComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly khata = inject(KhataService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly id = input.required<string>();
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { BookOpen, CalendarCheck, Clock, Coins, FileText, Gauge, MessageCircle, Receipt, Tags, Wallet };
  protected readonly ageKeys = AGE_KEYS;
  protected readonly methods = METHODS;
  protected readonly data = signal<Customer360 | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly sheet = signal<'payment' | 'promise' | 'limit' | 'group' | null>(null);
  protected readonly groups = signal<string[]>([]);
  protected priceGroup = '';
  protected readonly cancelling = signal<WsRow | null>(null);
  protected readonly chosenTab = signal<string | null>(null);
  private readonly reloads = signal(0);
  protected readonly today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
  protected amount: number | null = null;
  protected method: PaymentMethod = 'CASH';
  protected reference = '';
  protected promiseAmount: number | null = null;
  protected promiseDay = '';
  protected promiseNote = '';
  protected limit: number | null = null;

  protected readonly subtitle = computed(() => {
    const c = this.data()?.customer;
    if (!c) return '';
    return [c.companyName, c.city, c.phone, c.address].filter(Boolean).join(' · ');
  });
  protected readonly tabs = computed<WsTab[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { id: 'sales', label: this.i18n.t('ws.container.tab.sales'), count: d.sales.length },
      { id: 'payments', label: this.i18n.t('ws.sale.payments'), count: d.payments.length },
      { id: 'promises', label: this.i18n.t('ws.customer.promises'), count: d.promises.length },
      { id: 'reminders', label: this.i18n.t('ws.customer.reminders'), count: d.reminders.length },
    ];
  });
  protected readonly tab = computed(() => {
    const want = this.chosenTab() ?? this.tabParam();
    return want && this.tabs().some((t) => t.id === want) ? want : 'sales';
  });
  protected readonly monthLabels = computed(() =>
    (this.data()?.months ?? []).map((m) => new Date(m.month + '-15T00:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short', numberingSystem: 'latn' })),
  );
  protected readonly monthSeries = computed(() => {
    const m = this.data()?.months ?? [];
    return [
      { label: this.i18n.t('ws.customer.sold'), values: m.map((x) => Number(x.sold)) },
      { label: this.i18n.t('ws.customer.received'), values: m.map((x) => Number(x.received)) },
    ];
  });

  private col(key: string, label: string, format?: WsColumn['format'], total?: boolean): WsColumn {
    return { key, label: this.i18n.t(label), format, total };
  }
  protected readonly saleColumns = computed(() => [
    this.col('number', 'ws.col.number'), this.col('date', 'ws.col.date', 'date'), this.col('status', 'ws.col.status'),
    this.col('total', 'ws.col.total', 'money', true), this.col('paid', 'ws.sale.paid', 'money', true), this.col('due', 'ws.sale.due', 'money', true),
  ]);
  protected readonly saleRows = computed<WsRow[]>(() => (this.data()?.sales ?? []).map((s) => ({ ...s, status: this.i18n.t(`ws.status.${s.status}`) })));
  protected readonly paymentColumns = computed(() => [
    this.col('date', 'ws.col.date', 'date'), this.col('method', 'ws.sale.method'), this.col('reference', 'ws.sale.reference'), this.col('sale', 'ws.col.number'),
    this.col('amount', 'ws.sale.amount', 'money', true),
  ]);
  protected readonly paymentRows = computed<WsRow[]>(() => (this.data()?.payments ?? []).map((p) => ({ ...p, method: this.i18n.t(`method.${p.method}`) }) as unknown as WsRow));
  protected readonly promiseColumns = computed(() => [
    this.col('promisedFor', 'ws.customer.promisedFor'), this.col('amount', 'ws.sale.amount', 'money'), this.col('paid', 'ws.customer.paidSince', 'money'),
    this.col('status', 'ws.col.status'), this.col('note', 'ws.customer.note'), this.col('by', 'ws.col.createdBy'),
  ]);
  protected readonly promiseRows = computed<WsRow[]>(() =>
    (this.data()?.promises ?? []).map((p) => ({
      ...p, rawStatus: p.status, status: this.i18n.t(`ws.promise.${p.status}`), promisedFor: this.day(p.promisedFor),
      label: `${this.i18n.money(p.amount)} · ${this.day(p.promisedFor)}`,
    })),
  );
  protected readonly reminderColumns = computed(() => [this.col('date', 'ws.col.date', 'date'), this.col('by', 'ws.col.createdBy')]);
  protected readonly reminderRows = computed<WsRow[]>(() => (this.data()?.reminders ?? []).map((r, i) => ({ id: String(i), ...r })));

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) => this.http.get<Customer360>(`/api/workspace/customers/${id}`).pipe(map((d) => ({ ok: true as const, d })), catchError(() => of({ ok: false as const })))),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.failed.set(!x.ok);
        if (x.ok) this.data.set(x.d);
      });
    toObservable(this.tabParam).pipe(takeUntilDestroyed()).subscribe(() => this.chosenTab.set(null));
  }

  private day(ymd: string): string {
    return new Date(ymd + 'T12:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  private done(message: string): void {
    this.busy.set(false);
    this.sheet.set(null);
    this.cancelling.set(null);
    this.toast.show(message);
    this.reload();
  }

  private failedWith(e: { status?: number; error?: { message?: string } }): void {
    this.busy.set(false);
    this.toast.show(e.status === 400 || e.status === 409 ? (e.error?.message ?? this.i18n.t('common.couldNotSave')) : this.i18n.t('common.couldNotSave'));
  }

  protected receive(): void {
    const d = this.data();
    if (!d || !this.amount) return;
    this.busy.set(true);
    this.khata.recordPayment({ customerId: d.customer.id, amount: this.amount, method: this.method, reference: this.reference.trim() || undefined }).subscribe({
      next: () => { this.amount = null; this.reference = ''; this.done(this.i18n.t('ws.customer.receiptSaved')); },
      error: (e) => this.failedWith(e),
    });
  }

  protected remind(): void {
    const d = this.data();
    if (!d) return;
    this.khata.openWhatsapp(this.http.post<WhatsappMessage>(`/api/workspace/customers/${d.customer.id}/remind`, { lang: serverLang(this.i18n.lang()) }), () => this.toast.show(this.i18n.t('common.couldNotLoad')));
    setTimeout(() => this.reload(), 1500);
  }

  protected addPromise(): void {
    const d = this.data();
    if (!d || !this.promiseAmount || !this.promiseDay) return;
    this.busy.set(true);
    this.http.post(`/api/workspace/customers/${d.customer.id}/promises`, { amount: this.promiseAmount, promisedFor: this.promiseDay, note: this.promiseNote.trim() || undefined }).subscribe({
      next: () => { this.promiseAmount = null; this.promiseDay = ''; this.promiseNote = ''; this.chosenTab.set('promises'); this.done(this.i18n.t('ws.customer.promiseSaved')); },
      error: (e) => this.failedWith(e),
    });
  }

  protected saveLimit(): void {
    const d = this.data();
    if (!d || this.limit === null) return;
    this.busy.set(true);
    this.http.patch(`/api/workspace/customers/${d.customer.id}/credit-limit`, { creditLimit: this.limit }).subscribe({
      next: () => this.done(this.i18n.t('ws.customer.limitSaved')),
      error: (e) => this.failedWith(e),
    });
  }

  protected openGroup(): void {
    this.priceGroup = this.data()?.customer.priceGroup ?? '';
    this.sheet.set('group');
    this.http.get<{ groups: { name: string }[] }>('/api/workspace/price-lists').subscribe({ next: (p) => this.groups.set(p.groups.map((g) => g.name)), error: () => undefined });
  }

  protected saveGroup(): void {
    const d = this.data();
    if (!d) return;
    this.busy.set(true);
    this.http.patch(`/api/workspace/customers/${d.customer.id}/price-group`, { group: this.priceGroup.trim() || null }).subscribe({
      next: () => this.done(this.i18n.t('ws.customer.priceGroupSaved')),
      error: (e) => this.failedWith(e),
    });
  }

  protected askCancel(row: WsRow): void {
    const s = row['rawStatus'];
    if (s === 'OPEN' || s === 'DUE_TODAY' || s === 'BROKEN') this.cancelling.set(row);
  }

  protected cancelPromise(): void {
    const row = this.cancelling();
    if (!row) return;
    this.busy.set(true);
    this.http.post(`/api/workspace/promises/${row.id}/cancel`, {}).subscribe({
      next: () => this.done(this.i18n.t('ws.customer.promiseCancelled')),
      error: (e) => this.failedWith(e),
    });
  }

  protected openSale(row: WsRow): void {
    void this.router.navigate(['/sell/records', row.id]);
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }
}
