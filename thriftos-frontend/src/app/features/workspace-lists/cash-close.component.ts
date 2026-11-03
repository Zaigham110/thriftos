import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsColumn, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsRow, WsStateComponent } from '../../shared/ui/workspace';
import { BookLine, lineDetails } from './finance-book.component';

/** GET /api/workspace/finance/close */
export interface CloseView {
  day: string; opening: string; in: string; out: string; expected: string; lines: BookLine[];
  close: { id: string; day: string; expected: string; counted: string; difference: string; note: string | null; closedByName: string | null; createdAt: string } | null;
  recent: { id: string; day: string; expected: string; counted: string; difference: string }[];
}

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Daily cash close (enterprise plan E3.6): what should be in the drawer (opening + cash received − cash paid
 * out), count it, close the day. Short or over is carried into the cash book; a closed day's cash is locked.
 */
@Component({
  selector: 'app-cash-close',
  standalone: true,
  imports: [FormsModule, TPipe, WsDataGridComponent, WsKpiCardComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.close.title' | t" [subtitle]="'ws.close.subtitle' | t">
        <label actions class="day">{{ 'ws.col.date' | t }}<input type="date" [max]="maxDay" [ngModel]="day()" (ngModelChange)="day.set($event || maxDay)" /></label>
      </ws-page-header>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as v) {
        <section class="kpis">
          <ws-kpi-card [label]="'ws.book.opening' | t" [value]="i18n.money(v.opening)" />
          <ws-kpi-card [label]="'ws.close.in' | t" [value]="i18n.money(v.in)" />
          <ws-kpi-card [label]="'ws.close.out' | t" [value]="i18n.money(v.out)" />
          <ws-kpi-card [label]="'ws.close.expected' | t" [value]="i18n.money(v.expected)" />
        </section>
        @if (v.close; as c) {
          <p class="done" [class.bad]="+c.difference < 0" role="status">
            {{ 'ws.close.closed' | t: { counted: i18n.money(c.counted), by: c.closedByName ?? '—' } }}
            {{ diffWords(+c.difference) }}
            @if (c.note) { · {{ c.note }} }
          </p>
        } @else if (can('cash.close')) {
          <form class="count" (ngSubmit)="close()">
            <label>{{ 'ws.close.counted' | t }}<input name="counted" type="number" min="0" step="1" required [(ngModel)]="counted" /></label>
            <label class="grow">{{ 'ws.customer.note' | t }}<input name="note" maxlength="300" [(ngModel)]="note" /></label>
            @if (counted !== null) {
              <span class="diff" [class.bad]="counted - +v.expected < 0">{{ differenceText(+v.expected) }}</span>
            }
            <button type="submit" class="ws-btn primary" [disabled]="busy() || counted === null || counted < 0">{{ 'ws.close.closeDay' | t }}</button>
          </form>
        }
        <div class="two">
          <ws-data-grid [caption]="'ws.close.today' | t" [columns]="lineColumns()" [rows]="lineRows()" [emptyHeading]="'ws.close.nothing' | t" />
          <ws-data-grid [caption]="'ws.close.recent' | t" [columns]="recentColumns()" [rows]="recentRows()" [emptyHeading]="'ws.close.noneYet' | t" [clickable]="true" (rowClick)="day.set($any($event)['day'])" />
        </div>
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--ws-3); }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:var(--ws-4); align-items:start; }
    .day { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    input { height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .count { display:flex; flex-wrap:wrap; align-items:end; gap:var(--ws-3); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .count label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .grow { flex:1 1 240px; }
    .diff { align-self:center; font-weight:600; color:var(--ws-good, #15803d); }
    .diff.bad, .done.bad { color:var(--ws-bad); }
    .done { margin:0; padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); font-weight:600; }
  `],
})
export class CashCloseComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly maxDay = today();
  protected readonly day = signal(today());
  protected readonly data = signal<CloseView | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected counted: number | null = null;
  protected note = '';

  protected readonly lineColumns = computed<WsColumn[]>(() => [
    { key: 'details', label: this.i18n.t('ws.statement.details') },
    { key: 'in', label: this.i18n.t('ws.book.in'), format: 'money', total: true },
    { key: 'out', label: this.i18n.t('ws.book.out'), format: 'money', total: true },
  ]);
  protected readonly lineRows = computed<WsRow[]>(() =>
    (this.data()?.lines ?? []).map((l) => ({ id: `${l.kind}:${l.id}`, details: lineDetails(this.i18n, l), in: +l.in ? l.in : null, out: +l.out ? l.out : null })),
  );
  protected readonly recentColumns = computed<WsColumn[]>(() => [
    { key: 'date', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'expected', label: this.i18n.t('ws.close.expected'), format: 'money' },
    { key: 'counted', label: this.i18n.t('ws.close.counted'), format: 'money' },
    { key: 'difference', label: this.i18n.t('ws.close.difference'), format: 'money', total: true },
  ]);
  protected readonly recentRows = computed<WsRow[]>(() => (this.data()?.recent ?? []).map((r) => ({ ...r, date: r.day + 'T12:00:00Z' })));

  constructor() {
    effect(() => {
      this.day();
      untracked(() => {
        this.counted = null;
        this.note = '';
        this.load();
      });
    });
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }

  protected differenceText(expected: number): string {
    return this.diffWords((this.counted ?? 0) - expected);
  }

  protected diffWords(d: number): string {
    if (d === 0) return this.i18n.t('ws.close.exact');
    return d < 0 ? this.i18n.t('ws.close.shortBy', { amount: this.i18n.money(-d) }) : this.i18n.t('ws.close.overBy', { amount: this.i18n.money(d) });
  }

  protected load(): void {
    this.failed.set(false);
    this.http.get<CloseView>('/api/workspace/finance/close', { params: new HttpParams().set('day', this.day()) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (v) => this.data.set(v),
      error: () => this.failed.set(true),
    });
  }

  protected close(): void {
    if (this.counted === null) return;
    this.busy.set(true);
    this.http.post('/api/workspace/finance/close', { day: this.day(), counted: this.counted, note: this.note.trim() || undefined }).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ws.close.saved')); this.load(); },
      error: (e: { status?: number; error?: { message?: string } }) => {
        this.busy.set(false);
        this.toast.show(e.status === 409 || e.status === 400 ? (e.error?.message ?? this.i18n.t('common.couldNotSave')) : this.i18n.t('common.couldNotSave'));
      },
    });
  }
}
