import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { WsColumn, WsDataGridComponent, WsPageHeaderComponent, WsRow, WsSideSheetComponent, WsStateComponent } from '../../shared/ui/workspace';
import { BookLine, lineDetails } from './finance-book.component';
import { withTones } from '../../shared/ui/workspace/status-tone';

/** GET /api/workspace/finance/close */
export interface CloseView {
  day: string; opening: string; in: string; out: string; movedIn: string; movedOut: string; expected: string;
  lines: BookLine[]; afterClose: BookLine[]; afterCloseTotal: string;
  close: { id: string; day: string; expected: string; counted: string; difference: string; note: string | null; closedByName: string | null; createdAt: string } | null;
  openDays: number; laterClosed: boolean; canReopen: boolean;
  /** Days with cash before this one that are still open and could be closed first. */
  earlierOpen?: string[];
  recent: { id: string; day: string; closed: boolean; skipped?: boolean; expected: string | null; counted: string | null; difference: string | null }[];
}

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
/** Pakistani notes, largest first; coins are counted as one amount. */
const NOTES = [5000, 1000, 500, 100, 50, 20, 10] as const;
const ERROR_CODES = ['CLOSED_ALREADY', 'NOT_STARTED', 'LATER_CLOSED', 'REASON_NEEDED', 'NOT_CLOSED', 'NOT_LATEST', 'CASH_CLOSED', 'FUTURE_DAY', 'ALREADY_CANCELLED', 'NOT_ENOUGH_CASH'];
type Direction = 'OUT' | 'IN';
type MoveKind = 'BANK' | 'OWNER' | 'OTHER';

/**
 * Daily cash close (enterprise plan E3.6; v2 review): what should be in the drawer (start of the day + cash
 * received − cash paid out ± cash taken out or put in), count it (by notes if wanted), close the day. Short or over
 * says why and is carried into the cash book; a closed day's cash is locked; the latest close can be reopened.
 */
@Component({
  selector: 'app-cash-close',
  standalone: true,
  imports: [FormsModule, TPipe, WsDataGridComponent, WsPageHeaderComponent, WsSideSheetComponent, WsStateComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.close.title' | t" [subtitle]="'ws.close.subtitle' | t">
        <label actions class="day">{{ 'ws.col.date' | t }}<input type="date" [max]="maxDay" [ngModel]="day()" (ngModelChange)="day.set($event || maxDay)" /></label>
      </ws-page-header>
      @if (failed()) {
        <ws-state kind="error" (retry)="load()" />
      } @else if (data(); as v) {
        <section class="sum" [attr.aria-label]="'ws.close.expected' | t">
          <div class="row"><span>{{ 'ws.close.opening' | t }}</span><span>{{ i18n.money(v.opening) }}</span></div>
          <div class="row"><span>+ {{ 'ws.close.in' | t }}</span><span>{{ i18n.money(v.in) }}</span></div>
          <div class="row"><span>− {{ 'ws.close.out' | t }}</span><span>{{ i18n.money(v.out) }}</span></div>
          @if (+v.movedOut) { <div class="row"><span>− {{ 'ws.close.movedOut' | t }}</span><span>{{ i18n.money(v.movedOut) }}</span></div> }
          @if (+v.movedIn) { <div class="row"><span>+ {{ 'ws.close.movedIn' | t }}</span><span>{{ i18n.money(v.movedIn) }}</span></div> }
          <div class="row total"><span>= {{ 'ws.close.expected' | t }}</span><strong>{{ i18n.money(v.close ? v.close.expected : v.expected) }}</strong></div>
        </section>

        @if (v.close; as c) {
          <div class="done" [class.bad]="+c.difference < 0" role="status">
            <p>
              {{ 'ws.close.closed' | t: { counted: i18n.money(c.counted), by: c.closedByName ?? '—' } }}
              {{ diffWords(+c.difference) }}
              @if (c.note) { · {{ c.note }} }
            </p>
            @if (v.canReopen && can('cash.close')) {
              <button type="button" class="ws-btn" (click)="reason = ''; reopening.set(true)">{{ 'ws.close.reopen' | t }}</button>
            }
          </div>
          @if (v.afterClose.length) {
            <p class="note-line" role="note">{{ 'ws.close.afterClose' | t: { amount: i18n.money(v.afterCloseTotal) } }}</p>
          }
        } @else if (can('cash.close')) {
          @if (v.laterClosed) {
            <p class="note-line" role="note">{{ 'ws.close.laterClosed' | t }}</p>
          } @else {
            @if (v.earlierOpen?.length) {
              <!-- Days close in order: say so before an older open day is locked out for good (v2 review). -->
              <p class="note-line" role="note">{{ 'ws.close.earlierOpen' | t: { days: dayList(v.earlierOpen!) } }}</p>
            }
            <form class="count" (ngSubmit)="close()">
              <div class="count-row">
                <label>{{ 'ws.close.counted' | t }}<input name="counted" type="number" inputmode="numeric" min="0" step="1" required [(ngModel)]="counted" (ngModelChange)="notesUsed.set(false)" /></label>
                @if (counted !== null) {
                  <span class="diff" [class.bad]="counted - +v.expected < 0" aria-live="polite">{{ differenceText(+v.expected) }}</span>
                }
                <button type="button" class="link" [attr.aria-expanded]="showNotes()" (click)="showNotes.set(!showNotes())">{{ 'ws.close.countNotes' | t }}</button>
              </div>
              @if (showNotes()) {
                <div class="notes" role="group" [attr.aria-label]="'ws.close.countNotes' | t">
                  @for (n of notes; track n; let i = $index) {
                    <label><span dir="ltr">{{ n }} ×</span><input type="number" inputmode="numeric" min="0" step="1" [name]="'note' + n" [ngModel]="noteCounts()[i]" (ngModelChange)="setNote(i, $event)" /></label>
                  }
                  <label><span>{{ 'ws.close.coins' | t }}</span><input type="number" inputmode="numeric" min="0" step="1" name="coins" [ngModel]="coins()" (ngModelChange)="setCoins($event)" /></label>
                </div>
              }
              @if (counted !== null && needsWhy(+v.expected)) {
                <label class="why">{{ 'ws.close.why' | t }}<input name="note" maxlength="300" required [(ngModel)]="note" [placeholder]="'ws.close.whyHint' | t" /></label>
              }
              <div class="btns">
                <button type="submit" class="ws-btn primary" [disabled]="busy() || counted === null || counted < 0 || (needsWhy(+v.expected) && note.trim().length < 2)">{{ 'ws.close.closeDay' | t }}</button>
                <button type="button" class="ws-btn" (click)="startMove()">{{ 'ws.close.moveCash' | t }}</button>
              </div>
              @if (counted !== null && needsWhy(+v.expected) && note.trim().length < 2) { <p class="hint">{{ 'ws.close.needWhy' | t }}</p> }
            </form>
          }
        }

        @if (moves().length) {
          <section class="moves" [attr.aria-label]="'ws.close.moved' | t">
            <h2>{{ 'ws.close.moved' | t }}</h2>
            @for (m of moves(); track m.id) {
              <div class="move">
                <span>{{ details(m) }}</span>
                <strong>{{ +m.out ? '−' : '+' }} {{ i18n.money(+m.out ? m.out : m.in) }}</strong>
                @if (!v.close && can('cash.close')) {
                  <button type="button" class="ws-btn small" [disabled]="busy()" (click)="removeMove(m)">{{ 'ws.close.moveRemove' | t }}</button>
                }
              </div>
            }
          </section>
        }

        <div class="two">
          <section class="block"><h2>{{ 'ws.close.today' | t }}</h2><ws-data-grid [caption]="'ws.close.today' | t" [columns]="lineColumns()" [rows]="lineRows()" [emptyHeading]="(moves().length ? 'ws.close.nothingButMoves' : 'ws.close.nothing') | t" /></section>
          <section class="block"><h2>{{ 'ws.close.recent' | t }}</h2><ws-data-grid [caption]="'ws.close.recent' | t" [columns]="recentColumns()" [rows]="recentRows()" [emptyHeading]="'ws.close.noneYet' | t" [clickable]="true" (rowClick)="day.set($any($event)['day'])" /></section>
        </div>

        <ws-side-sheet [open]="reopening()" [heading]="'ws.close.reopenTitle' | t" (close)="reopening.set(false)">
          <div class="sheet-form">
            <p class="sheet-text">{{ 'ws.close.reopenText' | t: { counted: i18n.money(v.close?.counted ?? 0) } }}</p>
            <label>{{ 'ws.close.reason' | t }}<input name="reason" maxlength="200" [(ngModel)]="reason" [placeholder]="'ws.close.reasonHint' | t" /></label>
          </div>
          <ng-container footer>
            <button type="button" class="ws-btn" (click)="reopening.set(false)">{{ 'ws.close.keep' | t }}</button>
            <button type="button" class="ws-btn primary" [disabled]="busy() || reason.trim().length < 2" (click)="reopen()">{{ 'ws.close.reopen' | t }}</button>
          </ng-container>
        </ws-side-sheet>

        <ws-side-sheet [open]="moving()" [heading]="'ws.close.moveTitle' | t" (close)="moving.set(false)">
          <div class="sheet-form">
            <div class="chips" role="radiogroup" [attr.aria-label]="'ws.close.moveTitle' | t">
              <label class="chip" [class.on]="direction === 'OUT'"><input type="radio" name="direction" value="OUT" [(ngModel)]="direction" />{{ 'ws.close.takeOut' | t }}</label>
              <label class="chip" [class.on]="direction === 'IN'"><input type="radio" name="direction" value="IN" [(ngModel)]="direction" />{{ 'ws.close.putIn' | t }}</label>
            </div>
            <div class="chips" role="radiogroup">
              @for (k of kinds; track k) {
                <label class="chip" [class.on]="kind === k"><input type="radio" name="kind" [value]="k" [(ngModel)]="kind" />{{ 'ws.close.move.' + direction + '.' + k | t }}</label>
              }
            </div>
            <label>{{ 'ws.close.amount' | t }}<input name="moveAmount" type="number" inputmode="numeric" min="1" step="1" [(ngModel)]="moveAmount" /></label>
            <label>{{ 'ws.customer.note' | t }}<input name="moveNote" maxlength="200" [(ngModel)]="moveNote" [placeholder]="'ws.close.moveNoteHint' | t" /></label>
            <p class="hint">{{ 'ws.close.moveHint' | t }}</p>
          </div>
          <ng-container footer>
            <button type="button" class="ws-btn" (click)="moving.set(false)">{{ 'common.cancel' | t }}</button>
            <button type="button" class="ws-btn primary" [disabled]="busy() || !kind || !moveAmount || moveAmount < 1" (click)="saveMove()">{{ 'common.save' | t }}</button>
          </ng-container>
        </ws-side-sheet>
      } @else {
        <ws-state kind="loading" />
      }
    </div>
  `,
  styles: [`
    .page { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .day { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    input { box-sizing:border-box; height:var(--ws-control-h); padding-inline:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .block { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-2); }
    .block h2 { margin:0; font-size:var(--ws-text-md, 15px); font-weight:600; }
    .note-line { max-width:720px; box-sizing:border-box; }
    .sum { display:grid; gap:6px; max-width:720px; box-sizing:border-box; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .sum .row { display:flex; justify-content:space-between; gap:var(--ws-3); color:var(--ws-ink-2); font-variant-numeric:tabular-nums; }
    .sum .row span:last-child { color:var(--ws-ink); }
    .sum .total { margin-top:4px; padding-top:8px; border-top:1px solid var(--ws-line); color:var(--ws-ink); font-weight:600; }
    .sum .total strong { font-size:22px; }
    .count { display:grid; gap:var(--ws-3); max-width:720px; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .count label, .sheet-form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .count-row { display:flex; flex-wrap:wrap; align-items:end; gap:var(--ws-3); }
    .count-row input { width:180px; font-size:18px; }
    .why input { width:100%; }
    .notes { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:var(--ws-2); }
    .notes label { grid-template-columns:auto minmax(0, 1fr); align-items:center; gap:6px; color:var(--ws-ink); }
    .notes input { width:100%; min-width:0; }
    .link { align-self:center; padding:0; border:0; background:none; color:var(--ws-brand); font:inherit; font-size:var(--ws-text-sm); font-weight:600; cursor:pointer; text-decoration:underline; }
    .btns { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .hint { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .diff { align-self:center; font-weight:600; color:var(--ws-good, #15803d); }
    .diff.bad, .done.bad p { color:var(--ws-bad); }
    .done { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--ws-3); padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .done p { margin:0; font-weight:600; }
    .note-line { margin:0; padding:var(--ws-3) var(--ws-4); border:1px solid var(--ws-warn-line, #f3d98b); border-radius:var(--ws-r-lg); background:var(--ws-warn-soft, #fffbeb); color:var(--ws-ink); }
    .moves { display:grid; gap:var(--ws-2); max-width:720px; }
    .moves h2 { margin:0; font-size:var(--ws-text-md); }
    .move { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-3); padding:var(--ws-2) var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); }
    .move span { flex:1 1 200px; }
    .ws-btn.small { min-height:32px; padding-inline:10px; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap:var(--ws-4); align-items:start; }
    .sheet-form { display:grid; gap:var(--ws-3); }
    .sheet-form input { width:100%; }
    .sheet-text { margin:0; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip { position:relative; display:inline-flex !important; align-items:center; min-height:36px; padding:0 12px; border:1px solid var(--ws-line); border-radius:999px; background:var(--ws-surface); color:var(--ws-ink) !important; font-size:var(--ws-text-sm); cursor:pointer; user-select:none; }
    .chip input { position:absolute; opacity:0; width:1px; height:1px; pointer-events:none; }
    .chip.on { border-color:var(--ws-brand); background:var(--ws-brand-soft); color:var(--ws-brand) !important; font-weight:600; }
    .chip:has(input:focus-visible) { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:1px; }
    @media (max-width: 640px) {
      .sum, .count { padding:var(--ws-3); }
      .count-row input { width:100%; }
      .count-row label { flex:1 1 100%; }
      .btns .ws-btn { flex:1 1 auto; }
    }
  `],
})
export class CashCloseComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly maxDay = today();
  /** ?day=YYYY-MM-DD opens that day (from Profit and loss: the day closed short or over). */
  protected readonly day = signal(((d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= this.maxDay ? d : today()))(inject(ActivatedRoute).snapshot.queryParamMap.get('day')));
  protected readonly data = signal<CloseView | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly notes = NOTES;
  protected readonly kinds: MoveKind[] = ['BANK', 'OWNER', 'OTHER'];
  protected counted: number | null = null;
  protected note = '';
  protected readonly showNotes = signal(false);
  protected readonly noteCounts = signal<(number | null)[]>(NOTES.map(() => null));
  protected readonly coins = signal<number | null>(null);
  /** Counted came from the note counter (typing in Counted takes over again). */
  protected readonly notesUsed = signal(false);
  protected readonly reopening = signal(false);
  protected reason = '';
  protected readonly moving = signal(false);
  protected direction: Direction = 'OUT';
  protected kind: MoveKind | null = null;
  protected moveAmount: number | null = null;
  protected moveNote = '';

  protected readonly moves = computed(() => (this.data()?.lines ?? []).filter((l) => l.kind === 'MOVE'));
  protected readonly lineColumns = computed<WsColumn[]>(() => [
    { key: 'details', label: this.i18n.t('ws.statement.details') },
    { key: 'in', label: this.i18n.t('ws.book.in'), format: 'money', total: true },
    { key: 'out', label: this.i18n.t('ws.book.out'), format: 'money', total: true },
  ]);
  protected readonly lineRows = computed<WsRow[]>(() =>
    [...(this.data()?.lines ?? []).filter((l) => l.kind !== 'MOVE'), ...(this.data()?.afterClose ?? [])].map((l) => ({
      id: `${l.kind}:${l.id}`,
      details: this.details(l) + (this.data()?.afterClose.includes(l) ? ` · ${this.i18n.t('ws.close.afterCloseShort')}` : ''),
      in: +l.in ? l.in : null,
      out: +l.out ? l.out : null,
    })),
  );
  protected readonly recentColumns = computed<WsColumn[]>(() => [
    { key: 'date', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'status', label: this.i18n.t('ws.close.status') },
    { key: 'counted', label: this.i18n.t('ws.close.counted'), format: 'money' },
    // A total only once a day has been closed (it read "Total Rs 0" over a list of open days).
    { key: 'difference', label: this.i18n.t('ws.close.difference'), format: 'money', total: (this.data()?.recent ?? []).some((r) => r.closed) },
  ]);
  protected readonly recentRows = computed<WsRow[]>(() =>
    (this.data()?.recent ?? []).map((r) => withTones({ ...r, date: r.day + 'T12:00:00Z', status: this.i18n.t(r.closed ? 'ws.close.closedShort' : r.skipped ? 'ws.close.notCounted' : 'ws.close.notClosed') }, { status: r.closed ? 'DONE' : r.skipped ? 'CLOSED' : 'OPEN_DAY' })),
  );

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      const day = this.day();
      untracked(() => {
        // The day is kept in the address, so a refresh or Back returns to it (today has no ?day=).
        void this.router.navigate([], { relativeTo: this.route, queryParams: { day: day === this.maxDay ? null : day }, queryParamsHandling: 'merge', replaceUrl: true });
        this.resetCount();
        this.load();
      });
    });
  }

  /** "11 Nov, 13 Nov" for the note about earlier open days. */
  protected dayList(days: string[]): string {
    return days.map((d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', numberingSystem: 'latn' })).join(', ');
  }

  /** An empty count: nothing typed, no notes. */
  private resetCount(): void {
    this.counted = null;
    this.note = '';
    this.noteCounts.set(NOTES.map(() => null));
    this.coins.set(null);
    this.notesUsed.set(false);
    this.showNotes.set(false);
  }

  protected can(code: string): boolean {
    return this.auth.isSuperAdmin() || this.auth.permissions().includes(code);
  }

  protected details(l: BookLine): string {
    return lineDetails(this.i18n, l);
  }

  protected needsWhy(expected: number): boolean {
    return this.counted !== null && this.counted - expected !== 0;
  }

  protected differenceText(expected: number): string {
    return this.diffWords((this.counted ?? 0) - expected);
  }

  protected diffWords(d: number): string {
    if (d === 0) return this.i18n.t('ws.close.exact');
    return d < 0 ? this.i18n.t('ws.close.shortBy', { amount: this.i18n.money(-d) }) : this.i18n.t('ws.close.overBy', { amount: this.i18n.money(d) });
  }

  protected setNote(i: number, v: number | null): void {
    this.noteCounts.update((c) => c.map((x, j) => (j === i ? (v === null || (v as unknown) === '' ? null : Math.max(0, Math.floor(+v))) : x)));
    this.fromNotes();
  }

  protected setCoins(v: number | null): void {
    this.coins.set(v === null || (v as unknown) === '' ? null : Math.max(0, Math.floor(+v)));
    this.fromNotes();
  }

  /** Counted = the notes and coins added up. */
  private fromNotes(): void {
    const total = this.noteCounts().reduce<number>((t, c, i) => t + (c ?? 0) * NOTES[i], 0) + (this.coins() ?? 0);
    this.counted = total;
    this.notesUsed.set(true);
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
      error: (e) => this.failedWith(e),
    });
  }

  protected reopen(): void {
    this.busy.set(true);
    this.http.post(`/api/workspace/finance/close/${this.day()}/reopen`, { reason: this.reason.trim() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.reopening.set(false);
        this.resetCount();
        this.toast.show(this.i18n.t('ws.close.reopened'));
        this.load();
      },
      error: (e) => this.failedWith(e),
    });
  }

  protected startMove(): void {
    this.direction = 'OUT';
    this.kind = null;
    this.moveAmount = null;
    this.moveNote = '';
    this.moving.set(true);
  }

  /** One key per entry: a double tap or a retry on a slow line saves it once (the server keeps the first answer). */
  private saveKey = crypto.randomUUID();

  protected saveMove(): void {
    if (!this.kind || !this.moveAmount) return;
    this.busy.set(true);
    this.http.post('/api/workspace/finance/cash-moves', { day: this.day(), direction: this.direction, kind: this.kind, amount: this.moveAmount, note: this.moveNote.trim() || undefined }, { headers: new HttpHeaders({ 'Idempotency-Key': this.saveKey }) }).subscribe({
      next: () => { this.saveKey = crypto.randomUUID(); this.busy.set(false); this.moving.set(false); this.toast.show(this.i18n.t('ws.close.moveSaved')); this.load(); },
      error: (e) => this.failedWith(e),
    });
  }

  protected removeMove(m: BookLine): void {
    this.busy.set(true);
    this.http.post(`/api/workspace/finance/cash-moves/${m.id}/cancel`, {}).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ws.close.moveRemoved')); this.load(); },
      error: (e) => this.failedWith(e),
    });
  }

  private failedWith(e: { error?: { code?: string } }): void {
    this.busy.set(false);
    const code = e?.error?.code;
    this.toast.show(code && ERROR_CODES.includes(code) ? this.i18n.t(`ws.close.err.${code}`) : this.i18n.t('common.couldNotSave'));
  }
}
