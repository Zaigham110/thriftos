import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { HasUnsavedChanges, warnBeforeUnload } from '../../core/nav/unsaved-changes.guard';
import { AfterViewInit, Component, ElementRef, HostListener, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, LucideAngularModule, X } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { DEFAULT_LIST_STATE, ListClient } from '../../core/list/list-client';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsRecordActivityComponent, WsSideSheetComponent, WsStateComponent } from '../../shared/ui/workspace';
import { EXPENSE_CATEGORIES, EXPENSE_SECTIONS, PAYMENT_METHODS } from './lists';

/** GET /api/workspace/expenses/:id */
export interface Expense {
  id: string; day: string; category: string; amount: string; method: string; paidTo: string | null; note: string | null;
  createdAt: string; createdByName: string | null; cancelledAt: string | null; cancelledByName: string | null; cancelReason?: string | null;
}

/** Today in Pakistan (the business day), YYYY-MM-DD. */
const dayAgo = (n: number) => new Date(Date.now() + 5 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);

/** Server errors that carry a code are shown in the person's own language (v2 review). */
const ERROR_CODES = ['CASH_CLOSED', 'FUTURE_DAY', 'ALREADY_CANCELLED'];

/**
 * An expense (enterprise plan E3.6, v2 review): record one in a few taps — amount first, a category tile, today or
 * yesterday, how it was paid, and the bill photo on the same screen; "Save and add another" for a run of them.
 * The expense page shows it with its bill and history, can fix a mistake (Change) and cancel it with a reason.
 * Someone who records but cannot see Finance (the munshi) stays on the form after saving.
 */
@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, LucideAngularModule, TPipe, WsPageHeaderComponent, WsRecordActivityComponent, WsSideSheetComponent, WsStateComponent],
  template: `
    <ng-template #form>
      <form class="form card-like" (ngSubmit)="save(false)" (input)="touched = true" (change)="touched = true">
        <label class="amount">{{ 'ws.expenses.amount' | t }}
          <span class="rs"><span aria-hidden="true">{{ 'ws.expenses.rs' | t }}</span><input #amountBox name="amount" type="number" inputmode="numeric" min="1" step="1" required [(ngModel)]="amount" dir="ltr" /></span>
        </label>
        <fieldset>
          <legend>{{ 'ws.container.category' | t }}</legend>
          <!-- Grouped as Profit and loss shows them: employee costs, running expenses, petty cash. -->
          @for (g of groups; track g.key) {
            <p class="group">{{ 'ws.pnl.section.' + g.key | t }}</p>
            <div class="chips">
              @for (c of g.categories; track c) {
                <label class="chip" [class.on]="category === c"><input type="radio" name="category" [value]="c" [(ngModel)]="category" />{{ 'ws.expenseCategory.' + c | t }}</label>
              }
            </div>
          }
        </fieldset>
        <fieldset>
          <legend>{{ 'ws.col.date' | t }}</legend>
          <div class="chips">
            <label class="chip" [class.on]="dayChoice === 'today'"><input type="radio" name="dayChoice" value="today" [(ngModel)]="dayChoice" (ngModelChange)="pickDay()" />{{ 'ws.expenses.today' | t }}</label>
            <label class="chip" [class.on]="dayChoice === 'yesterday'"><input type="radio" name="dayChoice" value="yesterday" [(ngModel)]="dayChoice" (ngModelChange)="pickDay()" />{{ 'ws.expenses.yesterday' | t }}</label>
            <label class="chip" [class.on]="dayChoice === 'other'"><input type="radio" name="dayChoice" value="other" [(ngModel)]="dayChoice" (ngModelChange)="pickDay()" />{{ 'ws.expenses.otherDay' | t }}</label>
          </div>
          @if (dayChoice === 'other') {
            <input class="day" name="day" type="date" required [max]="maxDay" [(ngModel)]="day" [attr.aria-label]="'ws.col.date' | t" />
          }
          <small class="muted">{{ dayWords(day) }}</small>
        </fieldset>
        <fieldset>
          <legend>{{ 'ws.expenses.paidBy' | t }}</legend>
          <div class="chips">
            @for (m of methods; track m) {
              <label class="chip" [class.on]="method === m"><input type="radio" name="method" [value]="m" [(ngModel)]="method" />{{ 'method.' + m | t }}</label>
            }
          </div>
        </fieldset>
        <label>{{ 'ws.expenses.col.paidTo' | t }}<input name="paidTo" maxlength="120" list="expense-paid-to" autocomplete="off" [(ngModel)]="paidTo" /></label>
        <datalist id="expense-paid-to">@for (p of paidToNames(); track p) { <option [value]="p"></option> }</datalist>
        <label>{{ 'ws.customer.note' | t }}<input name="note" maxlength="300" [(ngModel)]="note" /></label>
        @if (!editing()) {
          <div class="photo">
            @if (photo(); as f) {
              <span class="file">{{ f.name }}</span>
              <button type="button" class="ws-btn sm" (click)="photo.set(null)" [attr.aria-label]="'ws.expenses.removePhoto' | t"><lucide-icon [img]="icons.X" [size]="14" aria-hidden="true" /></button>
            } @else {
              <label class="ws-btn pick"><lucide-icon [img]="icons.Camera" [size]="16" aria-hidden="true" />{{ 'ws.expenses.addPhoto' | t }}
                <input type="file" accept="image/*,application/pdf" capture="environment" (change)="pickPhoto($event)" />
              </label>
            }
          </div>
        }
        <div class="btns">
          @if (editing()) {
            <button type="submit" class="ws-btn primary" [disabled]="busy() || !ready()">{{ 'ws.expenses.saveChanges' | t }}</button>
            <button type="button" class="ws-btn" (click)="editing.set(false)">{{ 'common.cancel' | t }}</button>
          } @else {
            <button type="submit" class="ws-btn primary" [disabled]="busy() || !ready()">{{ (seesFinance() ? 'ws.expenses.save' : 'ws.expenses.saveOnly') | t }}</button>
            @if (seesFinance()) {
              <button type="button" class="ws-btn" [disabled]="busy() || !ready()" (click)="save(true)">{{ 'ws.expenses.saveAnother' | t }}</button>
            }
          }
        </div>
        @if (!ready()) { <p class="hint" role="status">{{ 'ws.expenses.needs' | t }}</p> }
      </form>
    </ng-template>

    @if (!id()) {
      <div class="page narrow">
        <ws-page-header [heading]="'ws.expenses.new' | t" [subtitle]="'ws.expenses.newHint' | t" />
        <ng-container *ngTemplateOutlet="form" />
      </div>
    } @else if (failed()) {
      <ws-state kind="error" [heading]="'ws.expenses.notFound' | t" (retry)="reload()" />
    } @else if (data(); as e) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="('ws.expenseCategory.' + e.category | t) + ' · ' + i18n.money(e.amount)" [subtitle]="subtitle()">
            @if (!e.cancelledAt && can('expense.create') && !editing()) {
              <span actions class="btns">
                <button type="button" class="ws-btn" [disabled]="busy()" (click)="startEdit(e)">{{ 'ws.expenses.change' | t }}</button>
                <button type="button" class="ws-btn" [disabled]="busy()" (click)="cancelling.set(true)">{{ 'ws.expenses.cancel' | t }}</button>
              </span>
            }
          </ws-page-header>
          @if (e.cancelledAt) {
            <p class="badge" role="status">{{ 'ws.expenses.cancelledBy' | t: { name: e.cancelledByName ?? '—' } }}@if (e.cancelReason) { <span class="why">{{ 'ws.expenses.reasonWas' | t: { reason: e.cancelReason } }}</span> }</p>
          }
          @if (editing()) {
            <ng-container *ngTemplateOutlet="form" />
          } @else {
            <dl class="facts">
              <div><dt>{{ 'ws.col.date' | t }}</dt><dd>{{ date(e.day) }}</dd></div>
              <div><dt>{{ 'ws.container.category' | t }}</dt><dd>{{ 'ws.expenseCategory.' + e.category | t }}</dd></div>
              <div><dt>{{ 'ws.sale.amount' | t }}</dt><dd>{{ i18n.money(e.amount) }}</dd></div>
              <div><dt>{{ 'ws.expenses.paidBy' | t }}</dt><dd>{{ 'method.' + e.method | t }}</dd></div>
              <div><dt>{{ 'ws.expenses.col.paidTo' | t }}</dt><dd>{{ e.paidTo ?? '—' }}</dd></div>
              <div><dt>{{ 'ws.customer.note' | t }}</dt><dd>{{ e.note ?? '—' }}</dd></div>
              <div><dt>{{ 'ws.col.createdBy' | t }}</dt><dd>{{ e.createdByName ?? '—' }}</dd></div>
            </dl>
          }
        </div>
        <aside class="side"><ws-record-activity type="expense" [recordId]="e.id" /></aside>
      </div>
      <ws-side-sheet [open]="cancelling()" [heading]="'ws.expenses.cancelTitle' | t" (close)="cancelling.set(false)">
        <div class="sheet-form">
          <p class="sheet-text">{{ 'ws.expenses.cancelText' | t: { amount: i18n.money(e.amount) } }}</p>
          <label>{{ 'ws.expenses.reason' | t }}<input name="reason" maxlength="200" [(ngModel)]="reason" [placeholder]="'ws.expenses.reasonHint' | t" /></label>
        </div>
        <ng-container footer>
          <button type="button" class="ws-btn" (click)="cancelling.set(false)">{{ 'ws.expenses.keep' | t }}</button>
          <button type="button" class="ws-btn danger" [disabled]="busy() || reason.trim().length < 2" (click)="cancel()">{{ 'ws.expenses.cancel' | t }}</button>
        </ng-container>
      </ws-side-sheet>
    } @else {
      <ws-state kind="loading" />
    }
  `,
  styles: [`
    .group { margin:var(--ws-2) 0 4px; color:var(--ws-ink-2); font-size:var(--ws-text-xs, 12px); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
    .page, .record { max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .page { display:grid; gap:var(--ws-4); }
    .narrow { max-width:640px; }
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); align-items:start; }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .form { display:grid; gap:var(--ws-4); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .form label, legend { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    legend { margin-block-end:6px; padding:0; }
    fieldset { display:grid; gap:6px; margin:0; padding:0; border:0; min-width:0; }
    .form input:not([type=radio]):not([type=file]) { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .rs { display:flex; align-items:center; gap:var(--ws-2); }
    .rs > span { color:var(--ws-ink-2); font-weight:600; }
    .amount input { font-size:22px !important; font-weight:600; min-height:48px !important; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip { display:inline-flex !important; align-items:center; min-height:36px; padding:0 12px; border:1px solid var(--ws-line); border-radius:999px; background:var(--ws-surface); color:var(--ws-ink) !important; font-size:var(--ws-text-sm); cursor:pointer; user-select:none; }
    .chip input { position:absolute; opacity:0; width:1px; height:1px; pointer-events:none; }
    .chip.on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand) !important; font-weight:600; }
    .chip:has(input:focus-visible) { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:1px; }
    .day { max-width:220px; }
    .muted { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .photo { display:flex; align-items:center; gap:var(--ws-2); }
    .photo .pick { position:relative; display:inline-flex; color:var(--ws-ink); cursor:pointer; }
    .photo .pick input { position:absolute; inset:0; opacity:0; cursor:pointer; }
    .photo .file { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--ws-text-sm); }
    .btns { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .hint { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .badge { justify-self:start; display:grid; gap:2px; margin:0; padding:var(--ws-1) var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-bad-soft); color:var(--ws-bad); font-weight:600; }
    .badge .why { font-weight:400; }
    .facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:var(--ws-3); margin:0; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .facts dt { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .facts dd { margin:2px 0 0; }
    .sheet-form { display:grid; gap:var(--ws-3); }
    .sheet-form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .sheet-form input { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .sheet-text { margin:0; }
    .ws-btn.danger { border-color:var(--ws-bad); background:var(--ws-bad); color:#fff; }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
  `],
})
export class ExpenseComponent implements HasUnsavedChanges, AfterViewInit {
  /** Something was typed in the new expense and not saved yet (leaving asks first). */
  protected touched = false;
  hasUnsavedChanges(): boolean {
    return (!this.id() || this.editing()) && this.touched;
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.hasUnsavedChanges());
  }
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly lists = inject(ListClient);
  private readonly toast = inject(ToastService);
  protected readonly icons = { Camera, X };
  /** Absent on /finance/expenses/new. */
  readonly id = input<string | undefined>();
  private readonly nav = inject(NavService);
  private readonly amountBox = viewChild<ElementRef<HTMLInputElement>>('amountBox');
  /** The breadcrumb and browser tab name this record once it has loaded. */
  private readonly crumbName = effect(() => {
    const d = this.data();
    const id = this.id();
    if (d && id) this.nav.setName(id, this.i18n.t('ws.expenseCategory.' + d.category) + ' · ' + this.i18n.money(d.amount));
  });
  protected readonly categories = EXPENSE_CATEGORIES;
  /** Petty cash first (the small daily costs), then running expenses, then employee costs; each most-used first. */
  protected readonly groups = (['petty', 'running', 'employee'] as const).map((key) => ({ key, categories: EXPENSE_CATEGORIES.filter((c) => (EXPENSE_SECTIONS[key] as readonly string[]).includes(c)) }));
  protected readonly methods = PAYMENT_METHODS;
  protected readonly maxDay = dayAgo(0);
  protected readonly data = signal<Expense | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly photo = signal<File | null>(null);
  protected readonly paidToNames = signal<string[]>([]);
  private readonly reloads = signal(0);
  /** No category until one is tapped, so nothing lands in "Other" by itself. */
  protected category = '';
  protected amount: number | null = null;
  protected dayChoice: 'today' | 'yesterday' | 'other' = 'today';
  protected day = dayAgo(0);
  protected method: string = 'CASH';
  protected paidTo = '';
  protected note = '';
  protected reason = '';
  /** Ticks when a form field changes, so ready() is worked out again. */
  private readonly formTick = signal(0);
  protected readonly ready = computed(() => {
    this.formTick();
    return !!this.amount && this.amount >= 1 && !!this.category && !!this.day;
  });
  /** People who can see Finance open the expense after saving; the munshi stays on the form. */
  protected readonly seesFinance = computed(() => this.can('finance.view'));

  protected readonly subtitle = computed(() => {
    const e = this.data();
    return e ? [this.date(e.day), e.paidTo, this.i18n.t(`method.${e.method}`)].filter(Boolean).join(' · ') : '';
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
    // Names paid before, offered while typing "Paid to" (only for people who can see the expenses list).
    if (this.seesFinance()) {
      this.lists.page('expenses', { ...DEFAULT_LIST_STATE, groupBy: 'paidTo', pageSize: 200 }).pipe(takeUntilDestroyed()).subscribe({
        next: (r) => this.paidToNames.set((r.groups ?? []).map((g) => g.label ?? '').filter(Boolean).slice(0, 200)),
        error: () => undefined,
      });
    }
  }

  ngAfterViewInit(): void {
    if (!this.id()) setTimeout(() => this.amountBox()?.nativeElement.focus());
  }

  @HostListener('input') @HostListener('change')
  protected changed(): void {
    this.formTick.update((n) => n + 1);
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }
  /** A business day (YYYY-MM-DD) in words: "7 November 2026". */
  protected date(day: string): string {
    return new Date(day + 'T12:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  }
  protected dayWords(day: string): string {
    return day ? new Date(day + 'T12:00:00Z').toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' }) : '';
  }
  protected pickDay(): void {
    if (this.dayChoice === 'today') this.day = dayAgo(0);
    else if (this.dayChoice === 'yesterday') this.day = dayAgo(1);
    else if (this.day === dayAgo(0) || this.day === dayAgo(1)) this.day = dayAgo(2);
    this.changed();
  }
  protected pickPhoto(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.photo.set(input.files?.[0] ?? null);
    input.value = '';
  }
  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  private failedWith(e: { status?: number; error?: { message?: string | string[]; code?: string } }): void {
    this.busy.set(false);
    const code = e.error?.code;
    this.toast.show(code && ERROR_CODES.includes(code) ? this.i18n.t(`ws.expenses.err.${code}`) : this.i18n.t('common.couldNotSave'));
  }

  /** One key per entry: a double tap or a retry on a slow line saves it once (the server keeps the first answer). */
  private saveKey = crypto.randomUUID();

  private body() {
    return { category: this.category, amount: this.amount, day: this.day, method: this.method, paidTo: this.paidTo.trim(), note: this.note.trim() };
  }

  protected save(another: boolean): void {
    if (!this.ready()) return;
    if (this.editing()) return this.saveChanges();
    this.busy.set(true);
    const { paidTo, note, ...rest } = this.body();
    this.http.post<{ id: string }>('/api/workspace/expenses', { ...rest, paidTo: paidTo || undefined, note: note || undefined }, { headers: new HttpHeaders({ 'Idempotency-Key': this.saveKey }) }).subscribe({
      next: (e) => {
        this.saveKey = crypto.randomUUID();
        const photo = this.photo();
        const done = () => {
          this.busy.set(false);
          this.touched = false;
          this.toast.show(this.i18n.t('ws.expenses.saved'));
          if (another || !this.seesFinance()) this.reset();
          else void this.nav.replace(['/finance/expenses', e.id]);
        };
        if (!photo) return done();
        const form = new FormData();
        form.append('file', photo);
        this.http.post(`/api/records/expense/${e.id}/attachments`, form).subscribe({
          next: done,
          error: () => { this.toast.show(this.i18n.t('ws.expenses.photoFailed')); done(); },
        });
      },
      error: (err) => this.failedWith(err),
    });
  }

  /** A fresh form for the next expense: the day and method stay (a run of expenses is usually the same day). */
  private reset(): void {
    this.amount = null;
    this.category = '';
    this.paidTo = '';
    this.note = '';
    this.photo.set(null);
    this.touched = false;
    this.changed();
    setTimeout(() => this.amountBox()?.nativeElement.focus());
  }

  protected startEdit(e: Expense): void {
    this.category = e.category;
    this.amount = Number(e.amount);
    this.day = e.day;
    this.dayChoice = e.day === dayAgo(0) ? 'today' : e.day === dayAgo(1) ? 'yesterday' : 'other';
    this.method = e.method;
    this.paidTo = e.paidTo ?? '';
    this.note = e.note ?? '';
    this.touched = false;
    this.editing.set(true);
    this.changed();
  }

  private saveChanges(): void {
    const e = this.data();
    if (!e) return;
    this.busy.set(true);
    this.http.patch<Expense>(`/api/workspace/expenses/${e.id}`, this.body()).subscribe({
      next: (d) => { this.busy.set(false); this.touched = false; this.editing.set(false); this.data.set(d); this.toast.show(this.i18n.t('ws.expenses.changed')); },
      error: (err) => this.failedWith(err),
    });
  }

  protected cancel(): void {
    const e = this.data();
    if (!e) return;
    this.busy.set(true);
    this.http.post(`/api/workspace/expenses/${e.id}/cancel`, { reason: this.reason.trim() }).subscribe({
      next: () => { this.busy.set(false); this.cancelling.set(false); this.reason = ''; this.toast.show(this.i18n.t('ws.expenses.cancelled')); this.reload(); },
      error: (err) => this.failedWith(err),
    });
  }
}
