import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Check, LucideAngularModule, Printer } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { TenantService } from '../../core/tenant/tenant.service';
import { ToastService } from '../../shared/floor/toast.service';

export type BillingState = 'CUSTOM' | 'FREE' | 'TRIAL' | 'TRIAL_OVER' | 'ACTIVE' | 'GRACE' | 'READ_ONLY';
interface Plan { id: string; code: string; name: string; monthlyPrice: string; yearlyPrice: string; modules: string[]; maxUsers: number | null }
interface PaymentRow { id: string; period: 'MONTH' | 'YEAR'; amount: string; method: string; reference: string | null; status: 'PENDING' | 'CONFIRMED' | 'REJECTED'; rejectReason: string | null; invoiceNumber: string | null; periodStart: string | null; periodEnd: string | null; createdAt: string; plan: { name: string } }
interface PayTo { accountTitle: string; jazzcash: string; easypaisa: string; bank: string; note: string }
interface Status {
  state: BillingState; plan: Plan | null; trialEndsAt: string | null; paidUntil: string | null; graceEndsAt: string | null; daysLeft: number | null;
  users: number; plans: Plan[]; payments: PaymentRow[]; pending: boolean; payTo: PayTo;
}
interface Invoice { number: string; date: string; business: { name: string; phone: string | null; address: string | null; city: string | null }; plan: string; period: 'MONTH' | 'YEAR'; periodStart: string; periodEnd: string; amount: string; method: string; reference: string | null }

const METHODS = ['JAZZCASH', 'EASYPAISA', 'BANK'] as const;

/**
 * Settings → Plan and billing (Phase 7): where the business stands (trial, paid until, grace, read-only), the plans
 * with what each gives, and paying by hand: send money to the accounts shown, attach the screenshot, the ThriftOS
 * team confirms it; each confirmed payment has an invoice to print.
 */
@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor billing">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/settings" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'billing.title' | t }}</h1>
      </header>

      @if (s(); as st) {
        <div class="card now" [class.warn]="st.state === 'GRACE' || st.state === 'TRIAL_OVER'" [class.bad]="st.state === 'READ_ONLY'" aria-live="polite">
          <small>{{ 'billing.yourPlan' | t }}</small>
          <strong>{{ st.plan?.name ?? ('billing.custom' | t) }}</strong>
          <p>{{ ('billing.state.' + st.state) | t: { n: st.daysLeft ?? 0, date: day(st.paidUntil ?? st.trialEndsAt), grace: day(st.graceEndsAt) } }}</p>
          @if (st.plan?.maxUsers; as max) { <small>{{ 'billing.logins' | t: { n: st.users, max: max } }}</small> }
        </div>

        @if (st.state !== 'CUSTOM') {
          <h2>{{ 'billing.choose' | t }}</h2>
          <div class="seg" role="group" [attr.aria-label]="'billing.period' | t">
            <button type="button" [class.on]="period() === 'MONTH'" [attr.aria-pressed]="period() === 'MONTH'" (click)="period.set('MONTH')">{{ 'billing.monthly' | t }}</button>
            <button type="button" [class.on]="period() === 'YEAR'" [attr.aria-pressed]="period() === 'YEAR'" (click)="period.set('YEAR')">{{ 'billing.yearly' | t }}</button>
          </div>
          <ul class="plans">
            @for (p of payable(); track p.id) {
              <li>
                <button type="button" class="card plan" [class.on]="chosen() === p.id" [attr.aria-pressed]="chosen() === p.id" (click)="chosen.set(p.id)">
                  <span class="head"><strong>{{ p.name }}</strong>@if (st.plan?.id === p.id) { <em>{{ 'billing.current' | t }}</em> }</span>
                  <span class="price">{{ i18n.money(price(p)) }}<small> / {{ (period() === 'YEAR' ? 'billing.perYear' : 'billing.perMonth') | t }}</small></span>
                  <small>{{ p.maxUsers ? ('billing.upTo' | t: { n: p.maxUsers }) : ('billing.unlimited' | t) }}</small>
                  <small class="mods">{{ moduleNames(p) }}</small>
                  @if (chosen() === p.id) { <lucide-icon class="tick" [img]="icons.Check" [size]="20" /> }
                </button>
              </li>
            }
          </ul>

          @if (st.pending) {
            <p class="notice" role="status">{{ 'billing.waiting' | t }}</p>
          } @else if (chosenPlan(); as p) {
            <form class="card pay" (ngSubmit)="pay()">
              <h2>{{ 'billing.payFor' | t: { plan: p.name, amount: i18n.money(price(p)) } }}</h2>
              @if (hasPayTo()) {
                <dl class="payto">
                  @if (st.payTo.accountTitle) { <div><dt>{{ 'billing.accountTitle' | t }}</dt><dd>{{ st.payTo.accountTitle }}</dd></div> }
                  @if (st.payTo.jazzcash) { <div><dt>{{ 'billing.method.JAZZCASH' | t }}</dt><dd class="ltr">{{ st.payTo.jazzcash }}</dd></div> }
                  @if (st.payTo.easypaisa) { <div><dt>{{ 'billing.method.EASYPAISA' | t }}</dt><dd class="ltr">{{ st.payTo.easypaisa }}</dd></div> }
                  @if (st.payTo.bank) { <div><dt>{{ 'billing.bank' | t }}</dt><dd>{{ st.payTo.bank }}</dd></div> }
                  @if (st.payTo.note) { <div class="note"><dd>{{ st.payTo.note }}</dd></div> }
                </dl>
              } @else {
                <p class="notice">{{ 'billing.noPayTo' | t }}</p>
              }
              <span class="field-label">{{ 'billing.paidWith' | t }}</span>
              <div class="chips" role="group" [attr.aria-label]="'billing.paidWith' | t">
                @for (m of methods; track m) {
                  <button type="button" class="chip" [class.on]="method === m" [attr.aria-pressed]="method === m" (click)="method = m">{{ ('billing.method.' + m) | t }}</button>
                }
              </div>
              <label class="field">{{ 'billing.reference' | t }} <small>· {{ 'common.optional' | t }}</small><input name="reference" maxlength="100" [(ngModel)]="reference" [placeholder]="'billing.referenceHint' | t" /></label>
              <label class="field">{{ 'billing.screenshot' | t }}<input name="shot" type="file" accept="image/*,application/pdf" (change)="pick($event)" /></label>
              @if (error(); as e) { <p class="notice error" role="alert">{{ e }}</p> }
              <button type="submit" class="btn primary block" [disabled]="busy() || (!shot && !reference.trim())">{{ (busy() ? 'common.saving' : 'billing.send') | t }}</button>
              <small class="hint">{{ 'billing.sendHint' | t }}</small>
            </form>
          }
        } @else {
          <p class="notice">{{ 'billing.customHint' | t }}</p>
        }

        @if (st.payments.length) {
          <h2>{{ 'billing.history' | t }}</h2>
          <ul class="list">
            @for (p of st.payments; track p.id) {
              <li class="row pay-row">
                <span>
                  <strong>{{ p.plan.name }} · {{ (p.period === 'YEAR' ? 'billing.yearly' : 'billing.monthly') | t }}</strong>
                  <small>{{ day(p.createdAt) }} · {{ ('billing.method.' + p.method) | t }}@if (p.periodEnd) { · {{ 'billing.until' | t: { date: day(p.periodEnd) } }} }</small>
                  @if (p.rejectReason) { <small class="bad">{{ p.rejectReason }}</small> }
                </span>
                <span class="amount">
                  {{ i18n.money(p.amount) }}
                  <span class="ws-status" [class]="p.status.toLowerCase()" [attr.data-tone]="p.status === 'CONFIRMED' ? 'good' : p.status === 'REJECTED' ? 'bad' : 'warn'">{{ ('billing.status.' + p.status) | t }}</span>
                  @if (p.status === 'CONFIRMED') { <button type="button" class="link" (click)="openInvoice(p.id)"><lucide-icon [img]="icons.Printer" [size]="16" /> {{ 'billing.invoice' | t }}</button> }
                </span>
              </li>
            }
          </ul>
        }
      } @else if (loadError()) {
        <p class="notice error" role="alert">{{ 'common.couldNotLoad' | t }}</p>
      }

      @if (invoice(); as inv) {
        <div class="sheet-backdrop" (click)="invoice.set(null)"></div>
        <section class="card invoice" role="dialog" aria-modal="true" aria-labelledby="inv-title">
          <header><h2 id="inv-title">{{ 'billing.invoiceTitle' | t }} {{ inv.number }}</h2><small>{{ day(inv.date) }}</small></header>
          <p><strong>ThriftOS</strong></p>
          <p>{{ 'billing.billedTo' | t }}: <strong>{{ inv.business.name }}</strong>@if (inv.business.city) { · {{ inv.business.city }} }</p>
          <table>
            <tr><th scope="row">{{ 'billing.planLabel' | t }}</th><td>{{ inv.plan }} · {{ (inv.period === 'YEAR' ? 'billing.yearly' : 'billing.monthly') | t }}</td></tr>
            <tr><th scope="row">{{ 'billing.periodLabel' | t }}</th><td>{{ day(inv.periodStart) }} – {{ day(inv.periodEnd) }}</td></tr>
            <tr><th scope="row">{{ 'billing.paidWith' | t }}</th><td>{{ ('billing.method.' + inv.method) | t }}@if (inv.reference) { · {{ inv.reference }} }</td></tr>
            <tr class="total"><th scope="row">{{ 'billing.amount' | t }}</th><td>{{ i18n.money(inv.amount) }}</td></tr>
          </table>
          <div class="actions no-print">
            <button type="button" class="btn primary" (click)="print()"><lucide-icon [img]="icons.Printer" [size]="18" /> {{ 'billing.print' | t }}</button>
            <button type="button" class="btn" (click)="invoice.set(null)">{{ 'billing.close' | t }}</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .billing h2 { font-size:17px; margin:18px 0 8px; }
    .now { display:grid; gap:4px; }
    .now strong { font-size:22px; }
    .now p { margin:0; font-weight:600; }
    .now small { color:var(--tos-ink-soft); font-weight:600; }
    .now.warn { border-color:#e0a100; background:#fff8e1; }
    .now.bad { border-color:var(--tos-warn); background:#fdecea; }
    .seg { display:inline-flex; border:1px solid var(--tos-line); border-radius:12px; overflow:hidden; margin-bottom:10px; }
    .seg button { min-height:44px; padding:0 16px; border:0; background:var(--tos-card); font:inherit; font-weight:700; cursor:pointer; }
    .seg button.on { background:var(--tos-primary); color:#fff; }
    .plans { list-style:none; margin:0; padding:0; display:grid; gap:10px; grid-template-columns:repeat(auto-fill, minmax(min(100%, 220px), 1fr)); }
    .plan { position:relative; width:100%; display:grid; gap:4px; text-align:start; font:inherit; cursor:pointer; }
    .plan.on { border:2px solid var(--tos-primary); background:var(--tos-primary-soft, #f3e8ef); }
    .plan .head { display:flex; gap:8px; align-items:center; }
    .plan em { font-style:normal; font-size:12px; font-weight:700; color:var(--tos-primary); }
    .plan .price { font-size:20px; font-weight:800; }
    .plan .price small { font-size:13px; font-weight:600; color:var(--tos-ink-soft); }
    .plan small { color:var(--tos-ink-soft); }
    .plan .mods { font-size:12px; }
    .plan .tick { position:absolute; inset-block-start:12px; inset-inline-end:12px; color:var(--tos-primary); }
    .pay { display:grid; gap:10px; margin-top:12px; }
    .pay h2 { margin:0; }
    .payto { display:grid; gap:6px; margin:0; padding:10px; border-radius:10px; background:var(--tos-bg, #f6f3ee); }
    .payto div { display:flex; justify-content:space-between; gap:12px; }
    .payto dt { color:var(--tos-ink-soft); font-weight:600; }
    .payto dd { margin:0; font-weight:700; }
    .hint { color:var(--tos-ink-soft); }
    .pay-row .amount { display:grid; justify-items:end; gap:2px; }
    .pay-row small.pending { color:#a16b00; font-weight:700; }
    .pay-row small.confirmed { color:#1b7a3d; font-weight:700; }
    .pay-row small.rejected, .bad { color:var(--tos-warn); font-weight:700; }
    .link { display:inline-flex; gap:4px; align-items:center; border:0; background:none; color:var(--tos-primary); font:inherit; font-weight:700; cursor:pointer; padding:0; }
    .invoice { position:fixed; inset-inline:16px; inset-block-start:10vh; max-width:520px; margin-inline:auto; z-index:50; display:grid; gap:8px; }
    .invoice header { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
    .invoice h2 { margin:0; }
    .invoice table { width:100%; border-collapse:collapse; }
    .invoice th, .invoice td { padding:8px 0; border-block-end:1px solid var(--tos-line); text-align:start; }
    .invoice td { text-align:end; }
    .invoice .total th, .invoice .total td { font-weight:800; font-size:18px; }
    .invoice .actions { display:flex; gap:8px; }
    .sheet-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:40; }
    @media print {
      :host ::ng-deep body * { visibility:hidden; }
      .invoice, .invoice * { visibility:visible; }
      .invoice { position:absolute; inset:0; box-shadow:none; border:0; }
      .no-print { display:none !important; }
    }
  `],
})
export class BillingComponent {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly tenants = inject(TenantService);
  protected readonly icons = { ArrowLeft, Check, Printer };
  protected readonly methods = METHODS;

  protected readonly s = signal<Status | null>(null);
  protected readonly loadError = signal(false);
  protected readonly period = signal<'MONTH' | 'YEAR'>('MONTH');
  protected readonly chosen = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly invoice = signal<Invoice | null>(null);
  protected method: (typeof METHODS)[number] = 'JAZZCASH';
  protected reference = '';
  protected shot: File | null = null;
  private names: Record<string, string> = {};

  /** Plans that can be paid for (the Free plan needs no payment). */
  protected readonly payable = computed(() => (this.s()?.plans ?? []).filter((p) => p.code !== 'FREE'));
  protected readonly chosenPlan = computed(() => this.payable().find((p) => p.id === this.chosen()) ?? null);
  protected readonly hasPayTo = computed(() => {
    const p = this.s()?.payTo;
    return !!p && !!(p.jazzcash || p.easypaisa || p.bank || p.accountTitle);
  });

  constructor() {
    this.load();
    this.http.get<{ modules: { key: string; name: Record<string, string> }[] }>('/api/tenant/modules').subscribe({
      next: (c) => {
        const lang = this.i18n.lang();
        this.names = Object.fromEntries((c.modules ?? []).map((m) => [m.key, m.name[lang] ?? m.name['en'] ?? m.key]));
        this.s.update((v) => (v ? { ...v } : v));
      },
      error: () => undefined,
    });
  }

  private load(): void {
    this.http.get<Status>('/api/billing').subscribe({
      next: (st) => {
        this.s.set(st);
        // Start on the plan the business has (or Workshop), so paying again is one tap.
        if (!this.chosen()) this.chosen.set((st.plan && st.plan.code !== 'FREE' ? st.plan.id : null) ?? st.plans.find((p) => p.code === 'WORKSHOP')?.id ?? null);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected price(p: Plan): string {
    return this.period() === 'YEAR' ? p.yearlyPrice : p.monthlyPrice;
  }

  protected moduleNames(p: Plan): string {
    return p.modules.map((m) => this.names[m] ?? '').filter(Boolean).join(' · ');
  }

  protected day(v: string | null | undefined): string {
    return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  protected pick(e: Event): void {
    this.shot = (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected pay(): void {
    const plan = this.chosenPlan();
    if (!plan || this.busy()) return;
    const form = new FormData();
    form.append('planId', plan.id);
    form.append('period', this.period());
    form.append('method', this.method);
    if (this.reference.trim()) form.append('reference', this.reference.trim());
    if (this.shot) form.append('screenshot', this.shot);
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/billing/payments', form).subscribe({
      next: () => {
        this.busy.set(false);
        this.reference = '';
        this.shot = null;
        this.toast.show(this.i18n.t('billing.sent'));
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        const m = e.error?.message;
        this.error.set(Array.isArray(m) ? m.join(', ') : m ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }

  protected openInvoice(id: string): void {
    this.http.get<Invoice>(`/api/billing/payments/${id}/invoice`).subscribe({
      next: (inv) => this.invoice.set(inv),
      error: () => this.toast.show(this.i18n.t('common.couldNotLoad')),
    });
  }

  protected print(): void {
    window.print();
  }

  /** After a payment is confirmed the banner and modules change: read the business again. */
  protected refreshTenant(): void {
    this.tenants.loadTenant(true).subscribe();
  }
}
