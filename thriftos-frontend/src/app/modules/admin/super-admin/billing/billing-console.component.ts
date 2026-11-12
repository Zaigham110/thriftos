/**
 * Phase 7 billing console: what ThriftOS earns (MRR in PKR, businesses by state), payments to confirm (with the
 * screenshot), each business's plan and dates, the plans' prices and logins, and where customers send money.
 */
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppPageBodyComponent, AppPageComponent, AppPageHeaderComponent } from '../../../../shared/ui';

type State = 'CUSTOM' | 'FREE' | 'TRIAL' | 'TRIAL_OVER' | 'ACTIVE' | 'GRACE' | 'READ_ONLY';
interface Plan { id: string; code: string; name: string; monthlyPrice: string; yearlyPrice: string; modules: string[]; maxUsers: number | null; isActive: boolean }
interface Payment { id: string; period: 'MONTH' | 'YEAR'; amount: string; method: string; reference: string | null; status: string; rejectReason: string | null; invoiceNumber: string | null; periodEnd: string | null; createdAt: string; hasScreenshot: boolean; plan: { id: string; name: string }; tenant: { id: string; name: string; companyCode: string } }
interface Row { id: string; name: string; plan: string | null; state: State; trialEndsAt: string | null; paidUntil: string | null; monthly: string }
interface Revenue { mrr: string; counts: Record<State, number>; pending: number; businesses: Row[] }
interface PayTo { accountTitle: string; jazzcash: string; easypaisa: string; bank: string; note: string }
interface Edit { id: string; name: string; planId: string; trialEndsAt: string; paidUntil: string; extra: string }

const STATE_NAMES: Record<State, string> = { CUSTOM: 'Set up by hand', FREE: 'Free', TRIAL: 'On trial', TRIAL_OVER: 'Trial over (Free)', ACTIVE: 'Paid', GRACE: 'Grace (unpaid)', READ_ONLY: 'Read-only' };
const METHOD_NAMES: Record<string, string> = { JAZZCASH: 'JazzCash', EASYPAISA: 'Easypaisa', BANK: 'Bank' };
const pkr = (v: string | number) => `Rs ${Number(v).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const day = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const dateInput = (v: string | null) => (v ? v.slice(0, 10) : '');

@Component({
  selector: 'app-billing-console',
  standalone: true,
  imports: [FormsModule, AppPageComponent, AppPageHeaderComponent, AppPageBodyComponent],
  template: `
    <app-page>
      <app-page-header>
        <div><h1 class="page-title">Billing</h1><p class="page-subtitle">Plans, payments to confirm, each business's plan and what ThriftOS earns.</p></div>
      </app-page-header>
      <app-page-body>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }

        @if (rev(); as r) {
          <section class="stats">
            <div class="card stat"><small>Monthly revenue (MRR)</small><strong>{{ pkr(r.mrr) }}</strong></div>
            <div class="card stat"><small>Payments to confirm</small><strong>{{ r.pending }}</strong></div>
            @for (s of statesShown; track s) { <div class="card stat"><small>{{ stateName(s) }}</small><strong>{{ r.counts[s] }}</strong></div> }
          </section>
        }

        <section class="card">
          <h2>Payments</h2>
          <div class="tabs" role="group" aria-label="Which payments">
            @for (f of filters; track f.value) {
              <button type="button" class="chip" [class.on]="filter() === f.value" [attr.aria-pressed]="filter() === f.value" (click)="setFilter(f.value)">{{ f.label }}</button>
            }
          </div>
          @if (!payments().length) { <p class="muted">No payments here.</p> }
          <table class="table">
            @if (payments().length) {
              <thead><tr><th scope="col">Business</th><th scope="col">Plan</th><th scope="col" class="num">Amount</th><th scope="col">Paid with</th><th scope="col">Sent</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            }
            <tbody>
              @for (p of payments(); track p.id) {
                <tr>
                  <td><strong>{{ p.tenant.name }}</strong><small>{{ p.tenant.companyCode }}</small></td>
                  <td>{{ p.plan.name }}<small>{{ p.period === 'YEAR' ? 'Yearly' : 'Monthly' }}</small></td>
                  <td class="num">{{ pkr(p.amount) }}</td>
                  <td>{{ methodName(p.method) }}@if (p.reference) { <small dir="ltr">{{ p.reference }}</small> }</td>
                  <td>{{ day(p.createdAt) }}</td>
                  <td>
                    {{ p.status === 'PENDING' ? 'Waiting' : p.status === 'CONFIRMED' ? 'Confirmed' : 'Rejected' }}
                    @if (p.invoiceNumber) { <small>{{ p.invoiceNumber }} · until {{ day(p.periodEnd) }}</small> }
                    @if (p.rejectReason) { <small>{{ p.rejectReason }}</small> }
                  </td>
                  <td class="actions">
                    @if (p.hasScreenshot) { <button type="button" class="btn" (click)="viewShot(p)">Screenshot</button> }
                    @if (p.status === 'PENDING') {
                      <button type="button" class="btn primary" [disabled]="busy()" (click)="confirm(p)">Confirm</button>
                      <button type="button" class="btn" [disabled]="busy()" (click)="rejecting.set(p.id)">Reject</button>
                    }
                  </td>
                </tr>
                @if (rejecting() === p.id) {
                  <tr><td colspan="7">
                    <form class="inline" (ngSubmit)="reject(p)">
                      <label>Why (the business sees this)<input name="reason" maxlength="300" required [(ngModel)]="reason" placeholder="e.g. Amount not received" /></label>
                      <button type="submit" class="btn primary" [disabled]="!reason.trim() || busy()">Reject payment</button>
                      <button type="button" class="btn" (click)="rejecting.set(null)">Cancel</button>
                    </form>
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </section>

        <section class="card">
          <h2>Businesses on a plan</h2>
          @if (!(rev()?.businesses ?? []).length) { <p class="muted">No business has a plan yet. New businesses made with "New business" start a 14-day Workshop trial.</p> }
          <table class="table">
            @if ((rev()?.businesses ?? []).length) {
              <thead><tr><th scope="col">Business</th><th scope="col">Plan</th><th scope="col">Where it stands</th><th scope="col">Trial ends</th><th scope="col">Paid until</th><th scope="col" class="num">A month</th><th scope="col"><span class="sr-only">Edit</span></th></tr></thead>
            }
            <tbody>
              @for (b of rev()?.businesses ?? []; track b.id) {
                <tr>
                  <td><strong>{{ b.name }}</strong></td>
                  <td>{{ b.plan ?? '—' }}</td>
                  <td><span class="pill" [class]="b.state.toLowerCase()">{{ stateName(b.state) }}</span></td>
                  <td>{{ day(b.trialEndsAt) }}</td>
                  <td>{{ day(b.paidUntil) }}</td>
                  <td class="num">{{ pkr(b.monthly) }}</td>
                  <td><button type="button" class="btn" (click)="startEdit(b)">Change</button></td>
                </tr>
              }
            </tbody>
          </table>
          <form class="inline find" (ngSubmit)="openById()">
            <label>Set a plan for another business (its id from the Businesses page)<input name="byId" [(ngModel)]="byId" placeholder="Business id" /></label>
            <button type="submit" class="btn" [disabled]="!byId.trim()">Open</button>
          </form>
          @if (edit(); as e) {
            <form class="card form" (ngSubmit)="saveEdit()">
              <h3>{{ e.name }}</h3>
              <label>Plan
                <select name="plan" [(ngModel)]="e.planId">
                  <option value="">No plan (set up by hand, never expires)</option>
                  @for (p of plans(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
                </select>
              </label>
              <div class="two">
                <label>Trial ends<input name="trial" type="date" [(ngModel)]="e.trialEndsAt" /></label>
                <label>Paid until<input name="paid" type="date" [(ngModel)]="e.paidUntil" /></label>
              </div>
              <label>Extra modules on top of the plan (codes, comma between)<input name="extra" [(ngModel)]="e.extra" placeholder="PRICE_LISTS, REPORTS" dir="ltr" /></label>
              <div class="foot">
                <button type="button" class="btn" (click)="edit.set(null)">Cancel</button>
                <button type="submit" class="btn primary" [disabled]="busy()">Save</button>
              </div>
            </form>
          }
        </section>

        <section class="card">
          <h2>Plans</h2>
          <table class="table plans">
            <thead><tr><th scope="col">Plan</th><th scope="col" class="num">A month (Rs)</th><th scope="col" class="num">A year (Rs)</th><th scope="col" class="num">Logins</th><th scope="col">Modules</th><th scope="col">On sale</th><th scope="col"><span class="sr-only">Save</span></th></tr></thead>
            <tbody>
              @for (p of plans(); track p.id) {
                <tr>
                  <td><input [name]="'n' + p.id" [(ngModel)]="p.name" maxlength="40" /><small>{{ p.code }}</small></td>
                  <td class="num"><input [name]="'m' + p.id" type="number" min="0" [(ngModel)]="p.monthlyPrice" /></td>
                  <td class="num"><input [name]="'y' + p.id" type="number" min="0" [(ngModel)]="p.yearlyPrice" /></td>
                  <td class="num"><input [name]="'u' + p.id" type="number" min="1" [ngModel]="p.maxUsers" (ngModelChange)="p.maxUsers = $event === '' || $event === null ? null : +$event" placeholder="Any" /></td>
                  <td><input [name]="'mod' + p.id" [ngModel]="p.modules.join(', ')" (ngModelChange)="p.modules = codes($event)" dir="ltr" /></td>
                  <td><input [name]="'a' + p.id" type="checkbox" [(ngModel)]="p.isActive" [disabled]="p.code === 'FREE'" /></td>
                  <td><button type="button" class="btn" [disabled]="busy()" (click)="savePlan(p)">Save</button></td>
                </tr>
              }
            </tbody>
          </table>
          <p class="muted">Changing a plan's modules changes them at once for every business on it.</p>
        </section>

        <form class="card form" (ngSubmit)="savePayTo()">
          <h2>Where customers pay</h2>
          <p class="muted">Shown on every business's Plan and billing page.</p>
          <label>Account name<input name="title" maxlength="100" [(ngModel)]="payTo.accountTitle" /></label>
          <div class="two">
            <label>JazzCash number<input name="jc" maxlength="100" dir="ltr" [(ngModel)]="payTo.jazzcash" /></label>
            <label>Easypaisa number<input name="ep" maxlength="100" dir="ltr" [(ngModel)]="payTo.easypaisa" /></label>
          </div>
          <label>Bank (bank, account number / IBAN)<input name="bank" maxlength="300" [(ngModel)]="payTo.bank" /></label>
          <label>Note<input name="note" maxlength="300" [(ngModel)]="payTo.note" placeholder="e.g. Send the screenshot on WhatsApp too" /></label>
          <div class="foot">@if (saved()) { <span class="ok" role="status">Saved</span> }<button type="submit" class="btn primary" [disabled]="busy()">Save</button></div>
        </form>
      </app-page-body>
    </app-page>
  `,
  styleUrls: ['../console.css'],
  styles: [`
    .stats { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px; margin-bottom:16px; }
    .stat { display:grid; gap:4px; }
    .stat small { color:var(--color-text-secondary, #6b6b6b); font-weight:600; }
    .stat strong { font-size:22px; }
    section.card, form.card { margin-bottom:16px; display:grid; gap:12px; }
    h2 { margin:0; font-size:17px; }
    h3 { margin:0; font-size:15px; }
    .tabs { display:flex; gap:8px; flex-wrap:wrap; }
    .chip { min-height:34px; padding:0 12px; border:1px solid var(--color-border, #d6cfd3); border-radius:999px; background:transparent; font:inherit; cursor:pointer; }
    .chip.on { background:var(--color-primary, #6e3a5e); color:#fff; border-color:transparent; }
    .table { width:100%; border-collapse:collapse; }
    .table th, .table td { padding:8px; border-bottom:1px solid var(--color-border, #eee); text-align:start; vertical-align:top; }
    .table td small { display:block; color:var(--color-text-secondary, #6b6b6b); font-size:12px; }
    .num { text-align:end !important; }
    .actions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
    .plans input { width:100%; min-width:70px; min-height:36px; padding:4px 8px; border:1px solid var(--color-border, #d6cfd3); border-radius:6px; font:inherit; }
    .plans input[type=checkbox] { width:auto; min-height:0; }
    .inline { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; }
    .inline label, .form label { display:grid; gap:6px; font-weight:600; font-size:14px; flex:1; }
    .inline input, .form input, .form select { min-height:40px; padding:6px 10px; border:1px solid var(--color-border, #d6cfd3); border-radius:8px; font:inherit; font-weight:400; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; }
    .foot { display:flex; justify-content:flex-end; align-items:center; gap:10px; }
    .ok { color:#047857; font-weight:600; }
    .pill { padding:2px 8px; border-radius:999px; background:#eef0f3; font-size:12px; font-weight:700; }
    .pill.active { background:#e6f6ec; color:#1b7a3d; } .pill.trial { background:#eef4ff; color:#1d3a6e; }
    .pill.grace, .pill.trial_over { background:#fff8e1; color:#6b4a00; } .pill.read_only { background:#fdecea; color:#8a1c12; }
  `],
})
export class BillingConsoleComponent {
  private readonly http = inject(HttpClient);
  protected readonly pkr = pkr;
  protected readonly day = day;
  protected readonly statesShown: State[] = ['TRIAL', 'ACTIVE', 'GRACE', 'READ_ONLY', 'TRIAL_OVER', 'FREE'];
  protected readonly filters = [{ value: 'PENDING', label: 'To confirm' }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'REJECTED', label: 'Rejected' }, { value: '', label: 'All' }];
  protected readonly rev = signal<Revenue | null>(null);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly plans = signal<Plan[]>([]);
  protected readonly filter = signal('PENDING');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal(false);
  protected readonly rejecting = signal<string | null>(null);
  protected readonly edit = signal<Edit | null>(null);
  protected reason = '';
  protected byId = '';
  protected payTo: PayTo = { accountTitle: '', jazzcash: '', easypaisa: '', bank: '', note: '' };
  protected readonly planNames = computed(() => new Map(this.plans().map((p) => [p.id, p.name])));

  constructor() {
    this.loadAll();
  }

  protected stateName(s: State): string {
    return STATE_NAMES[s];
  }

  protected methodName(m: string): string {
    return METHOD_NAMES[m] ?? m;
  }

  protected codes(v: string): string[] {
    return v.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  }

  private fail(e: { error?: { message?: string | string[] } }): void {
    this.busy.set(false);
    const m = e?.error?.message;
    this.error.set(Array.isArray(m) ? m.join('. ') : m || 'Something went wrong. Try again.');
  }

  private loadAll(): void {
    this.error.set('');
    this.http.get<Revenue>('/api/superadmin/billing/revenue').subscribe({ next: (r) => this.rev.set(r), error: (e) => this.fail(e) });
    this.http.get<Plan[]>('/api/superadmin/billing/plans').subscribe({ next: (p) => this.plans.set(p), error: (e) => this.fail(e) });
    this.http.get<PayTo>('/api/superadmin/billing/pay-to').subscribe({ next: (p) => (this.payTo = p), error: (e) => this.fail(e) });
    this.loadPayments();
  }

  private loadPayments(): void {
    const q = this.filter() ? `?status=${this.filter()}` : '';
    this.http.get<Payment[]>(`/api/superadmin/billing/payments${q}`).subscribe({ next: (p) => this.payments.set(p), error: (e) => this.fail(e) });
  }

  protected setFilter(v: string): void {
    this.filter.set(v);
    this.loadPayments();
  }

  protected viewShot(p: Payment): void {
    this.http.get(`/api/superadmin/billing/payments/${p.id}/screenshot`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => this.fail(e),
    });
  }

  protected confirm(p: Payment): void {
    if (!window.confirm(`Confirm ${pkr(p.amount)} from ${p.tenant.name} for ${p.plan.name}? The plan starts now.`)) return;
    this.busy.set(true);
    this.http.post(`/api/superadmin/billing/payments/${p.id}/confirm`, {}).subscribe({ next: () => { this.busy.set(false); this.loadAll(); }, error: (e) => this.fail(e) });
  }

  protected reject(p: Payment): void {
    this.busy.set(true);
    this.http.post(`/api/superadmin/billing/payments/${p.id}/reject`, { reason: this.reason.trim() }).subscribe({
      next: () => { this.busy.set(false); this.reason = ''; this.rejecting.set(null); this.loadAll(); },
      error: (e) => this.fail(e),
    });
  }

  protected startEdit(b: { id: string; name: string }): void {
    this.http.get<{ id: string; name: string; trialEndsAt: string | null; paidUntil: string | null; extraModules: string[]; plan: { id: string } | null }>(`/api/superadmin/billing/tenants/${b.id}`).subscribe({
      next: (t) => this.edit.set({ id: t.id, name: t.name, planId: t.plan?.id ?? '', trialEndsAt: dateInput(t.trialEndsAt), paidUntil: dateInput(t.paidUntil), extra: t.extraModules.join(', ') }),
      error: (e) => this.fail(e),
    });
  }

  protected openById(): void {
    this.startEdit({ id: this.byId.trim(), name: '' });
  }

  protected saveEdit(): void {
    const e = this.edit();
    if (!e) return;
    this.busy.set(true);
    // A date ends at the end of that day.
    const end = (d: string) => (d ? new Date(`${d}T23:59:59`).toISOString() : null);
    this.http.patch(`/api/superadmin/billing/tenants/${e.id}`, { planId: e.planId || null, trialEndsAt: end(e.trialEndsAt), paidUntil: end(e.paidUntil), extraModules: this.codes(e.extra) }).subscribe({
      next: () => { this.busy.set(false); this.edit.set(null); this.byId = ''; this.loadAll(); },
      error: (err) => this.fail(err),
    });
  }

  protected savePlan(p: Plan): void {
    this.busy.set(true);
    this.http.patch(`/api/superadmin/billing/plans/${p.id}`, { name: p.name, monthlyPrice: Number(p.monthlyPrice), yearlyPrice: Number(p.yearlyPrice), maxUsers: p.maxUsers, modules: p.modules, ...(p.code === 'FREE' ? {} : { isActive: p.isActive }) }).subscribe({
      next: () => { this.busy.set(false); this.loadAll(); },
      error: (e) => this.fail(e),
    });
  }

  protected savePayTo(): void {
    this.busy.set(true);
    this.http.put<PayTo>('/api/superadmin/billing/pay-to', this.payTo).subscribe({
      next: (p) => { this.payTo = p; this.busy.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 2500); },
      error: (e) => this.fail(e),
    });
  }
}
