import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
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

export interface BookLine { at: string; day: string; kind: 'RECEIPT' | 'EXPENSE' | 'CLOSE'; id: string; ref: string | null; party: string | null; in: string; out: string; balance?: string }
/** GET /api/workspace/finance/book */
export interface Book { method: string; opening: string; in: string; out: string; closing: string; lines: BookLine[] }

/** Describes one book line in words (shared with the cash close page). */
export function lineDetails(i18n: I18nService, l: BookLine): string {
  if (l.kind === 'RECEIPT') return i18n.t('ws.book.receipt', { party: l.party ?? '—', ref: l.ref ?? '' }).trim();
  if (l.kind === 'EXPENSE') return [i18n.t(`ws.expenseCategory.${l.ref}`), l.party].filter(Boolean).join(' · ');
  return i18n.t(+l.in > 0 ? 'ws.book.over' : 'ws.book.short');
}

/**
 * Cash and bank book (enterprise plan E3.6): for one payment method, money in (payments received) and out
 * (expenses; for cash also the day-close difference) with the running balance, for any period.
 */
@Component({
  selector: 'app-finance-book',
  standalone: true,
  imports: [TPipe, WsCommandBarComponent, WsDataGridComponent, WsDateRangeComponent, WsKpiCardComponent, WsPageHeaderComponent, WsReportActionsComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.book.title' | t" [subtitle]="'ws.book.subtitle' | t">
        <ws-report-actions actions [columns]="columns()" [rows]="rows()" [filename]="'thriftos-book-' + method().toLowerCase()" />
      </ws-page-header>
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
    .methods { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .methods .on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand); }
  `],
})
export class FinanceBookComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly methods = PAYMENT_METHODS;
  protected readonly method = signal<string>('CASH');
  protected readonly range = signal<WsDateRange>(rangeFor('all'));
  protected readonly data = signal<Book | null>(null);
  protected readonly failed = signal(false);

  protected readonly columns = computed<WsColumn[]>(() => [
    { key: 'at', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'details', label: this.i18n.t('ws.statement.details') },
    { key: 'in', label: this.i18n.t('ws.book.in'), format: 'money', total: true },
    { key: 'out', label: this.i18n.t('ws.book.out'), format: 'money', total: true },
    { key: 'balance', label: this.i18n.t('ws.collections.balance'), format: 'money' },
  ]);
  protected readonly rows = computed<WsRow[]>(() =>
    [...(this.data()?.lines ?? [])].reverse().map((l) => ({ id: `${l.kind}:${l.id}`, at: l.at, details: lineDetails(this.i18n, l), in: +l.in ? l.in : null, out: +l.out ? l.out : null, balance: l.balance })),
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
    if (kind === 'EXPENSE') void this.router.navigate(['/finance/expenses', id]);
    if (kind === 'CLOSE') void this.router.navigate(['/finance/close']);
  }
}
