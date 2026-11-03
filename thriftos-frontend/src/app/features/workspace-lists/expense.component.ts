import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsRecordActivityComponent, WsStateComponent } from '../../shared/ui/workspace';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from './lists';

/** GET /api/workspace/expenses/:id */
export interface Expense {
  id: string; day: string; category: string; amount: string; method: string; paidTo: string | null; note: string | null;
  createdAt: string; createdByName: string | null; cancelledAt: string | null; cancelledByName: string | null;
}

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * An expense (enterprise plan E3.6): record a new one (route without :id), or see one with its bill photo or
 * receipt attached in the activity panel, and cancel it (a cancelled expense stays for the record).
 */
@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [FormsModule, TPipe, WsPageHeaderComponent, WsRecordActivityComponent, WsStateComponent],
  template: `
    @if (!id()) {
      <div class="page narrow">
        <ws-page-header [heading]="'ws.expenses.new' | t" [subtitle]="'ws.expenses.newHint' | t" />
        <form class="form card-like" (ngSubmit)="save()">
          <label>{{ 'ws.container.category' | t }}
            <select name="category" required [(ngModel)]="category">
              @for (c of categories; track c) { <option [value]="c">{{ 'ws.expenseCategory.' + c | t }}</option> }
            </select>
          </label>
          <label>{{ 'ws.sale.amount' | t }}<input name="amount" type="number" min="1" step="1" required [(ngModel)]="amount" /></label>
          <label>{{ 'ws.col.date' | t }}<input name="day" type="date" required [max]="maxDay" [(ngModel)]="day" /></label>
          <label>{{ 'ws.sale.method' | t }}
            <select name="method" [(ngModel)]="method">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
          </label>
          <label>{{ 'ws.expenses.col.paidTo' | t }}<input name="paidTo" maxlength="120" [(ngModel)]="paidTo" /></label>
          <label>{{ 'ws.customer.note' | t }}<input name="note" maxlength="300" [(ngModel)]="note" /></label>
          <p class="hint">{{ 'ws.expenses.attachHint' | t }}</p>
          <button type="submit" class="ws-btn primary" [disabled]="busy() || !amount || amount < 1 || !day">{{ 'ws.expenses.save' | t }}</button>
        </form>
      </div>
    } @else if (failed()) {
      <ws-state kind="error" [heading]="'ws.expenses.notFound' | t" (retry)="reload()" />
    } @else if (data(); as e) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="('ws.expenseCategory.' + e.category | t) + ' · ' + i18n.money(e.amount)" [subtitle]="subtitle()">
            @if (!e.cancelledAt && can('expense.create')) {
              <button actions type="button" class="ws-btn" [disabled]="busy()" (click)="cancel()">{{ 'ws.expenses.cancel' | t }}</button>
            }
          </ws-page-header>
          @if (e.cancelledAt) { <p class="badge" role="status">{{ 'ws.expenses.cancelledBy' | t: { name: e.cancelledByName ?? '—' } }}</p> }
          <dl class="facts">
            <div><dt>{{ 'ws.col.date' | t }}</dt><dd>{{ date(e.day + 'T12:00:00Z') }}</dd></div>
            <div><dt>{{ 'ws.container.category' | t }}</dt><dd>{{ 'ws.expenseCategory.' + e.category | t }}</dd></div>
            <div><dt>{{ 'ws.sale.amount' | t }}</dt><dd>{{ i18n.money(e.amount) }}</dd></div>
            <div><dt>{{ 'ws.sale.method' | t }}</dt><dd>{{ 'method.' + e.method | t }}</dd></div>
            <div><dt>{{ 'ws.expenses.col.paidTo' | t }}</dt><dd>{{ e.paidTo ?? '—' }}</dd></div>
            <div><dt>{{ 'ws.customer.note' | t }}</dt><dd>{{ e.note ?? '—' }}</dd></div>
            <div><dt>{{ 'ws.col.createdBy' | t }}</dt><dd>{{ e.createdByName ?? '—' }}</dd></div>
          </dl>
        </div>
        <aside class="side"><ws-record-activity type="expense" [recordId]="e.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .page, .record { max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .page { display:grid; gap:var(--ws-4); }
    .narrow { max-width:640px; }
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); align-items:start; }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .form { display:grid; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .form input, .form select { padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .hint { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .badge { justify-self:start; margin:0; padding:var(--ws-1) var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-bad-soft); color:var(--ws-bad); font-weight:600; }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--ws-3); margin:0; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .facts dt { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .facts dd { margin:2px 0 0; }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
  `],
})
export class ExpenseComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  /** Absent on /finance/expenses/new. */
  readonly id = input<string | undefined>();
  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly maxDay = today();
  protected readonly data = signal<Expense | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  private readonly reloads = signal(0);
  protected category: string = 'OTHER';
  protected amount: number | null = null;
  protected day = today();
  protected method: string = 'CASH';
  protected paidTo = '';
  protected note = '';

  protected readonly subtitle = computed(() => {
    const e = this.data();
    return e ? [this.date(e.day + 'T12:00:00Z'), e.paidTo, this.i18n.t(`method.${e.method}`)].filter(Boolean).join(' · ') : '';
  });

  constructor() {
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) => (id ? this.http.get<Expense>(`/api/workspace/expenses/${id}`).pipe(map((d) => ({ ok: true as const, d })), catchError(() => of({ ok: false as const }))) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        if (!x) return;
        this.failed.set(!x.ok);
        if (x.ok) this.data.set(x.d);
      });
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }
  protected date(v: string): string {
    return new Date(v).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  }
  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  private failedWith(e: { status?: number; error?: { message?: string } }): void {
    this.busy.set(false);
    this.toast.show(e.status === 400 || e.status === 409 ? (e.error?.message ?? this.i18n.t('common.couldNotSave')) : this.i18n.t('common.couldNotSave'));
  }

  protected save(): void {
    if (!this.amount) return;
    this.busy.set(true);
    this.http
      .post<{ id: string }>('/api/workspace/expenses', { category: this.category, amount: this.amount, day: this.day, method: this.method, paidTo: this.paidTo.trim() || undefined, note: this.note.trim() || undefined })
      .subscribe({
        next: (e) => { this.busy.set(false); this.toast.show(this.i18n.t('ws.expenses.saved')); void this.router.navigate(['/finance/expenses', e.id]); },
        error: (e) => this.failedWith(e),
      });
  }

  protected cancel(): void {
    const e = this.data();
    if (!e) return;
    this.busy.set(true);
    this.http.post(`/api/workspace/expenses/${e.id}/cancel`, {}).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ws.expenses.cancelled')); this.reload(); },
      error: (err) => this.failedWith(err),
    });
  }
}
