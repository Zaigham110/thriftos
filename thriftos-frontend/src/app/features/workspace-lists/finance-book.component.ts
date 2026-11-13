import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { NavService } from '../../core/nav/nav.service';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { TenantService } from '../../core/tenant/tenant.service';
import { ToastService } from '../../shared/floor/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import {
  WsColumn,
  WsCommandBarComponent,
  WsDataGridComponent,
  WsDateRange,
  WsDateRangeComponent,
  WsKpiCardComponent,
  WsPageHeaderComponent,
  WsReportActionsComponent,
  WsRow,
  WsStateComponent,
  rangeFor,
} from '../../shared/ui/workspace';
import { PAYMENT_METHODS } from './lists';

export interface BookLine { at: string; day: string; kind: 'RECEIPT' | 'EXPENSE' | 'MOVE' | 'CLOSE' | 'SUPPLIER'; id: string; ref: string | null; party: string | null; link?: { type: 'sale' | 'customer' | 'supplier'; id: string } | null; in: string; out: string; balance?: string }
/** GET /api/workspace/finance/book */
export interface Book { method: string; opening: string; in: string; out: string; closing: string; lines: BookLine[] }

/** Describes one book line in words (shared with the cash close page). */
export function lineDetails(i18n: I18nService, l: BookLine): string {
  if (l.kind === 'RECEIPT') return i18n.t('ws.book.receipt', { party: l.party ?? '—', ref: l.ref ?? '' }).trim();
  if (l.kind === 'SUPPLIER') return i18n.t('ws.book.supplier', { party: l.party ?? '—', ref: l.ref ?? '' }).trim();
  if (l.kind === 'EXPENSE') return [i18n.t(`ws.expenseCategory.${l.ref}`), l.party].filter(Boolean).join(' · ');
  // Cash out of the drawer or into it (v2 review): "Paid into the bank · Meezan Bank".
  if (l.kind === 'MOVE') return [i18n.t(`ws.close.move.${(l.ref ?? '').replace(':', '.')}`), l.party].filter(Boolean).join(' · ');
  return i18n.t(+l.in > 0 ? 'ws.book.over' : 'ws.book.short');
}

/**
 * Cash and bank book (enterprise plan E3.6): for one payment method, money in (payments received) and out
 * (expenses; for cash also the day-close difference) with the running balance, for any period.
 */
@Component({
  selector: 'app-finance-book',
  standalone: true,
  imports: [FormsModule, RouterLink, TPipe, WsCommandBarComponent, WsDataGridComponent, WsDateRangeComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.book.title' | t" [subtitle]="'ws.book.subtitle' | t">
        <ws-report-actions actions [columns]="columns()" [rows]="rows()" [filename]="'thriftos-book-' + method().toLowerCase()" />
        <!-- Cash is moved on Cash close (v2 review: nothing here pointed to it). -->
        @if (canMove()) { <a actions class="ws-btn" routerLink="/finance/close">{{ 'ws.close.moveCash' | t }}</a> }
        @if (canMove()) { <button actions type="button" class="ws-btn" (click)="startDrawer()">{{ 'ws.book.setDrawer' | t }}</button> }
      </ws-page-header>
      @if (drawer(); as dr) {
        <!-- One step to make the book say what is really in the drawer, without it counting as an expense or a loss. -->
        <form class="drawer" (ngSubmit)="saveDrawer()">
          <p>{{ 'ws.book.bookSays' | t: { amount: i18n.money(dr.expected) } }}</p>
          <label>{{ 'ws.book.really' | t }}<input name="really" type="number" min="0" step="1" required [(ngModel)]="really" /></label>
          <p class="hint">{{ drawerLine() }}</p>
          <div class="acts">
            <button type="button" class="ws-btn" (click)="drawer.set(null)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="ws-btn primary" [disabled]="busy() || really === null || really < 0 || diff() === 0">{{ (busy() ? 'common.saving' : 'common.save') | t }}</button>
          </div>
        </form>
      }
      <ws-command-bar>
        <div start class="methods" role="group" [attr.aria-label]="'ws.sale.method' | t">
          @for (m of methods; track m) {
            <button type="button" class="ws-btn" [class.on]="method() === m" [attr.aria-pressed]="method() === m" (click)="method.set(m)">{{ 'method.' + m | t }}</button>
          }
        </div>
        <ws-date-range end [allowAll]="true" [value]="range()" (valueChange)="range.set($event)" />
      </ws-command-bar>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as b) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.book.opening' | t" [value]="i18n.money(b.opening)" />
          <ws-kpi-card [label]="'ws.book.in' | t" [value]="i18n.money(b.in)" />
          <ws-kpi-card [label]="'ws.book.out' | t" [value]="i18n.money(b.out)" />
          <ws-kpi-card [label]="'ws.book.closing' | t" [value]="i18n.money(b.closing)" />
        </section>
        <ws-data-grid [caption]="'ws.book.title' | t" [columns]="columns()" [rows]="rows()" [clickable]="true" (rowClick)="open($event)" [emptyHeading]="'ws.book.empty' | t" />
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .drawer { display:grid; gap:var(--ws-2); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); max-width:640px; }
    .drawer p { margin:0; }
    .drawer label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .drawer input { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .drawer .hint { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .drawer .acts { display:flex; justify-content:flex-end; gap:var(--ws-2); }
    .methods { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .methods .on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); }
  `],
})
export class FinanceBookComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly nav = inject(NavService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly methods = PAYMENT_METHODS;
  protected readonly method = signal<string>('CASH');
  protected readonly range = signal<WsDateRange>(rangeFor('all'));
  protected readonly data = signal<Book | null>(null);
  protected readonly failed = signal(false);
  private readonly auth = inject(AuthService);
  private readonly tenants = inject(TenantService);
  private readonly toast = inject(ToastService);
  /** Moving cash and setting the drawer right need Cash close and its permission. */
  protected readonly canMove = computed(() => this.tenants.isModuleEnabled('CASH_CLOSE', this.tenants.tenant()) && (this.auth.isSuperAdmin() || this.auth.permissions().includes('cash.close')));
  protected readonly drawer = signal<{ expected: number } | null>(null);
  protected readonly busy = signal(false);
  protected really: number | null = null;
  /** What is really there minus what the book says: below zero comes off the book, above goes on. */
  protected diff(): number {
    const d = this.drawer();
    return d && this.really !== null ? Math.round((Number(this.really) - d.expected) * 100) / 100 : 0;
  }
  protected drawerLine(): string {
    const d = this.diff();
    if (this.really === null) return '';
    if (d === 0) return this.i18n.t('ws.book.matches');
    return this.i18n.t(d < 0 ? 'ws.book.willOut' : 'ws.book.willIn', { amount: this.i18n.money(Math.abs(d)) });
  }
  /** What should be in the drawer today, from the day's cash view. */
  protected startDrawer(): void {
    this.http.get<{ expected: string }>('/api/workspace/finance/close').subscribe({
      next: (v) => { this.really = null; this.drawer.set({ expected: Number(v.expected) }); },
      error: () => this.toast.show(this.i18n.t('common.couldNotLoad')),
    });
  }
  protected saveDrawer(): void {
    const d = this.diff();
    if (!d || this.busy()) return;
    this.busy.set(true);
    const body = { direction: d < 0 ? 'OUT' : 'IN', kind: 'OTHER', amount: Math.abs(d), note: this.i18n.t('ws.book.drawerNote') };
    this.http.post('/api/workspace/finance/cash-moves', body, { headers: new HttpHeaders({ 'Idempotency-Key': this.drawerKey }) }).subscribe({
      next: () => { this.drawerKey = crypto.randomUUID(); this.busy.set(false); this.drawer.set(null); this.toast.show(this.i18n.t('ws.book.drawerSaved')); this.method.set('CASH'); this.load(); },
      error: (e: { error?: { message?: string } }) => { this.busy.set(false); this.toast.show(e.error?.message ?? this.i18n.t('common.couldNotSave')); },
    });
  }
  private drawerKey = crypto.randomUUID();

  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'at', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'details', label: this.i18n.t('ws.statement.details') },
    { key: 'in', label: this.i18n.t('ws.book.in'), format: 'money', total: true },
    { key: 'out', label: this.i18n.t('ws.book.out'), format: 'money', total: true },
    { key: 'balance', label: this.i18n.t('ws.collections.balance'), format: 'money' },
  ]);
  protected readonly rows = computed<WsRow[]>(() =>
    // Oldest first, as a cash book is read: the balance grows down the page to the closing figure (v2 review).
    (this.data()?.lines ?? []).map((l) => ({ id: `${l.kind}:${l.id}`, _link: l.link ?? null, at: l.at, details: lineDetails(this.i18n, l), in: +l.in ? l.in : null, out: +l.out ? l.out : null, balance: l.balance })),
  );

  constructor() {
    effect(() => {
      this.method();
      this.range();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const r = this.range();
    let params = new HttpParams().set('method', this.method());
    if (r.from) params = params.set('from', r.from);
    if (r.to) params = params.set('to', r.to);
    this.failed.set(false);
    this.http.get<Book>('/api/workspace/finance/book', { params }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (b) => this.data.set(b), error: () => this.failed.set(true) });
  }

  protected open(row: WsRow): void {
    const [kind, id] = row.id.split(':');
    // A receipt opens its bill (or the customer, for money on account); a supplier payment opens the supplier.
    const link = row['_link'] as { type: string; id: string } | null;
    if (link?.type === 'sale') void this.nav.open(['/sell/records', link.id]);
    if (link?.type === 'customer') void this.nav.open(['/khata/records', link.id]);
    if (link?.type === 'supplier') void this.nav.open(['/receive/records/suppliers', link.id], { queryParams: { tab: 'payments' } });
    if (kind === 'EXPENSE') void this.nav.open(['/finance/expenses', id]);
    if (kind === 'CLOSE' || kind === 'MOVE') void this.nav.open(['/finance/close']);
  }
}
