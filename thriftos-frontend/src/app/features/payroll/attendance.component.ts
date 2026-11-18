import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';

type Status = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY';
interface DayRow { id: string; name: string; jobTitle: string | null; status: Status | null; note: string | null }
interface MonthRow { id: string; name: string; jobTitle: string | null; counts: Record<Status, number> }
type View = 'day' | 'month' | 'leave';
interface LeaveRow { id: string; workerId: string; fromDay: string; toDay: string; days: number; reason: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; worker: { name: string; jobTitle: string | null } }
interface Staff { id: string; name: string; isActive: boolean }

const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY'];
/** Today in Pakistan, YYYY-MM-DD. */
const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const shift = (day: string, by: number) => new Date(Date.parse(`${day}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

/**
 * Attendance (owner, 2026-11-17: Employee Management): one day with every employee and one tap each (or "All
 * present" for those not marked yet), and the month's counts. Days present pay staff paid by the day; absences
 * show beside a monthly salary on the pay sheet.
 */
@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [FormsModule, RouterLink, I18N],
  template: `
    <section class="floor att">
      <header class="floor-head"><h1>{{ 'pay.att.title' | t }}</h1></header>
      <div class="bar">
        <div class="seg" role="tablist">
          <button type="button" role="tab" [class.on]="view() === 'day'" [attr.aria-selected]="view() === 'day'" (click)="show('day')">{{ 'pay.att.day' | t }}</button>
          <button type="button" role="tab" [class.on]="view() === 'month'" [attr.aria-selected]="view() === 'month'" (click)="show('month')">{{ 'pay.att.month' | t }}</button>
          <button type="button" role="tab" [class.on]="view() === 'leave'" [attr.aria-selected]="view() === 'leave'" (click)="show('leave')">{{ 'pay.lv.tab' | t }}@if (waiting()) { ({{ waiting() }}) }</button>
        </div>
        @if (view() !== 'leave') {
        <div class="when">
          <button type="button" class="btn" [attr.aria-label]="'pay.att.before' | t" (click)="move(-1)">‹</button>
          <input type="date" [attr.aria-label]="'ws.col.date' | t" [max]="max" [ngModel]="day()" (ngModelChange)="pick($event)" />
          <button type="button" class="btn" [attr.aria-label]="'pay.att.after' | t" [disabled]="day() >= max" (click)="move(1)">›</button>
        </div>
        }
      </div>
      @if (error(); as e) { <p class="notice error" role="alert">{{ e }}</p> }

      @if (view() === 'day') {
        @if (rows(); as list) {
          @if (!list.length) {
            <p class="notice empty">{{ 'pay.att.none' | t }} <a routerLink="/people">{{ 'pay.title' | t }}</a></p>
          } @else {
            <p class="sum" aria-live="polite">{{ summary() }}</p>
            @if (unmarked() > 0) { <button type="button" class="btn primary all" [disabled]="busy()" (click)="allPresent()">{{ 'pay.att.allPresent' | t: { n: unmarked() } }}</button> }
            <ul class="list">
              @for (r of list; track r.id) {
                <li class="row emp">
                  <span class="who"><strong>{{ r.name }}</strong>@if (r.jobTitle) { <small>{{ r.jobTitle }}</small> }</span>
                  <span class="chips" role="radiogroup" [attr.aria-label]="r.name">
                    @for (s of statuses; track s) {
                      <button type="button" class="chip" role="radio" [class.on]="r.status === s" [attr.data-s]="s" [attr.aria-checked]="r.status === s" [disabled]="busy()" (click)="mark(r, r.status === s ? null : s)">{{ ('pay.att.s.' + s) | t }}</button>
                    }
                  </span>
                </li>
              }
            </ul>
          }
        }
      } @else if (view() === 'leave') {
        <form class="card form" (ngSubmit)="askLeave()">
          <span class="field-label">{{ 'pay.lv.new' | t }}</span>
          <label class="field">{{ 'pay.name' | t }}
            <select name="who" required [(ngModel)]="lvWho">
              <option value="" disabled>{{ 'pay.lv.pick' | t }}</option>
              @for (s of staff(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
            </select>
          </label>
          <div class="two">
            <label class="field">{{ 'pay.from' | t }}<input name="lfrom" type="date" required [(ngModel)]="lvFrom" /></label>
            <label class="field">{{ 'pay.to' | t }}<input name="lto" type="date" required [(ngModel)]="lvTo" /></label>
          </div>
          <label class="field">{{ 'pay.lv.reason' | t }} · {{ 'common.optional' | t }}<input name="lreason" maxlength="200" [(ngModel)]="lvReason" /></label>
          <label class="check"><input type="checkbox" name="lnow" [(ngModel)]="lvNow" /> {{ 'pay.lv.giveNow' | t }}</label>
          <button type="submit" class="btn primary" [disabled]="busy() || !lvWho || !lvFrom || !lvTo">{{ (lvNow ? 'pay.lv.give' : 'pay.lv.ask') | t }}</button>
        </form>
        <ul class="list" [attr.aria-label]="'pay.lv.tab' | t">
          @for (r of leaves(); track r.id) {
            <li class="row emp leave" [attr.data-status]="r.status">
              <span class="who"><strong>{{ r.worker.name }}</strong><small>{{ span(r) }} · {{ 'pay.lv.days' | t: { n: r.days } }}@if (r.reason) { · {{ r.reason }} }</small></span>
              <span class="chips">
                <span class="ws-status" [attr.data-tone]="tone(r.status)">{{ ('pay.lv.s.' + r.status) | t }}</span>
                @if (r.status === 'PENDING') {
                  <button type="button" class="btn primary" [disabled]="busy()" (click)="decide(r, 'approve')">{{ 'pay.lv.approve' | t }}</button>
                  <button type="button" class="btn" [disabled]="busy()" (click)="decide(r, 'reject')">{{ 'pay.lv.reject' | t }}</button>
                }
                @if (r.status === 'APPROVED') { <button type="button" class="btn" [disabled]="busy()" (click)="decide(r, 'cancel')">{{ 'pay.lv.cancel' | t }}</button> }
              </span>
            </li>
          } @empty { <li class="notice empty">{{ 'pay.lv.none' | t }}</li> }
        </ul>
      } @else if (month(); as m) {
        <table class="table">
          <caption class="sr-only">{{ 'pay.att.month' | t }}</caption>
          <thead><tr><th scope="col">{{ 'pay.name' | t }}</th>@for (s of statuses; track s) { <th scope="col" class="num">{{ ('pay.att.s.' + s) | t }}</th> }</tr></thead>
          <tbody>
            @for (r of m; track r.id) {
              <tr><td>{{ r.name }}@if (r.jobTitle) { <small> · {{ r.jobTitle }}</small> }</td>@for (s of statuses; track s) { <td class="num">{{ r.counts[s] || '' }}</td> }</tr>
            } @empty { <tr><td [attr.colspan]="statuses.length + 1" class="notice empty">{{ 'pay.att.none' | t }}</td></tr> }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [`
    @media (min-width: 1024px) { .floor.att { max-width:960px; } .att .btn.primary.all { justify-self:start; width:auto; padding-inline:20px; } }
    .bar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .seg { display:inline-flex; border:1px solid var(--tos-line); border-radius:12px; overflow:hidden; }
    .seg button { min-height:44px; padding:0 14px; border:0; background:var(--tos-card); font:inherit; font-weight:700; cursor:pointer; }
    .seg button.on { background:var(--tos-primary); color:#fff; }
    .when { display:flex; gap:6px; align-items:center; }
    .when input { min-height:44px; padding:0 10px; border:1px solid var(--tos-line); border-radius:10px; background:var(--tos-card); font:inherit; }
    .when .btn { min-width:44px; padding:0; }
    .sum { margin:0 0 8px; color:var(--tos-ink-soft); font-weight:600; }
    .all { margin-bottom:10px; }
    .emp { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; }
    .who { display:grid; min-width:120px; }
    .who small { color:var(--tos-ink-soft); }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chip.on[data-s='ABSENT'] { background:var(--tos-danger, #b3261e); border-color:var(--tos-danger, #b3261e); color:#fff; }
    .form { display:grid; gap:10px; margin-bottom:12px; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; }
    .check { display:flex; gap:8px; align-items:center; font-weight:600; }
    .leave[data-status='REJECTED'], .leave[data-status='CANCELLED'] { opacity:.65; }
    .notice.empty { padding-inline:0; background:transparent; color:var(--tos-ink-soft); font-weight:500; }
    .table { width:100%; border-collapse:collapse; background:var(--tos-card); border:1px solid var(--tos-line); border-radius:12px; }
    .table th, .table td { padding:10px 12px; border-bottom:1px solid var(--tos-line); text-align:start; }
    .table .num { text-align:end; font-variant-numeric:tabular-nums; }
    .table small { color:var(--tos-ink-soft); }
  `],
})
export class AttendanceComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  protected readonly statuses = STATUSES;
  protected readonly max = today();
  protected readonly view = signal<View>('day');
  protected readonly day = signal(today());
  protected readonly rows = signal<DayRow[] | null>(null);
  protected readonly month = signal<MonthRow[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly leaves = signal<LeaveRow[]>([]);
  protected readonly staff = signal<Staff[]>([]);
  protected readonly waiting = computed(() => this.leaves().filter((l) => l.status === 'PENDING').length);
  protected lvWho = '';
  protected lvFrom = '';
  protected lvTo = '';
  protected lvReason = '';
  protected lvNow = false;
  protected readonly unmarked = computed(() => (this.rows() ?? []).filter((r) => !r.status).length);
  /** "6 present · 1 absent · 2 not marked". */
  protected readonly summary = computed(() => {
    const list = this.rows() ?? [];
    const parts = STATUSES.map((s) => ({ s, n: list.filter((r) => r.status === s).length })).filter((p) => p.n).map((p) => `${this.i18n.num(p.n)} ${this.i18n.t(`pay.att.s.${p.s}`).toLowerCase()}`);
    if (this.unmarked()) parts.push(this.i18n.t('pay.att.notMarked', { n: this.i18n.num(this.unmarked()) }));
    return parts.join(' · ');
  });

  constructor() {
    this.load();
    this.loadLeave();
  }

  protected tone(s: LeaveRow['status']): string {
    return s === 'APPROVED' ? 'good' : s === 'PENDING' ? 'warn' : 'muted';
  }

  /** "18 Nov – 22 Nov". */
  protected span(r: LeaveRow): string {
    const d = (v: string) => new Date(`${v}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return r.fromDay === r.toDay ? d(r.fromDay) : `${d(r.fromDay)} – ${d(r.toDay)}`;
  }

  private loadLeave(): void {
    this.http.get<LeaveRow[]>('/api/payroll/leave').subscribe({ next: (r) => this.leaves.set(r), error: (e) => this.fail(e) });
  }

  /** Leave asked for over days: it waits, or is given at once. */
  protected askLeave(): void {
    this.busy.set(true);
    this.error.set(null);
    this.http.post('/api/payroll/leave', { workerId: this.lvWho, fromDay: this.lvFrom, toDay: this.lvTo, ...(this.lvReason.trim() ? { reason: this.lvReason.trim() } : {}), approve: this.lvNow }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t(this.lvNow ? 'pay.lv.given' : 'pay.lv.asked'));
        this.lvWho = '';
        this.lvFrom = '';
        this.lvTo = '';
        this.lvReason = '';
        this.lvNow = false;
        this.loadLeave();
      },
      error: (e) => this.fail(e),
    });
  }

  protected decide(r: LeaveRow, decision: 'approve' | 'reject' | 'cancel'): void {
    this.busy.set(true);
    this.error.set(null);
    this.http.post(`/api/payroll/leave/${r.id}/${decision}`, {}).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t(`pay.lv.done.${decision}`)); this.loadLeave(); },
      error: (e) => this.fail(e),
    });
  }

  protected show(v: View): void {
    this.view.set(v);
    this.load();
  }

  protected pick(day: string): void {
    if (!day || day > this.max) return;
    this.day.set(day);
    this.load();
  }

  /** A day back or forward; in the month view, a month. */
  protected move(by: number): void {
    if (this.view() === 'day') return this.pick(shift(this.day(), by));
    const d = new Date(`${this.day().slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + by);
    const next = d.toISOString().slice(0, 10);
    this.pick(next > this.max ? this.max : next);
  }

  private fail(e: HttpErrorResponse): void {
    this.busy.set(false);
    const m = e.error?.message;
    this.error.set(Array.isArray(m) ? m.join(', ') : m ?? this.i18n.t('common.couldNotSave'));
  }

  protected load(): void {
    this.error.set(null);
    if (this.view() === 'leave') {
      this.loadLeave();
      if (!this.staff().length) this.http.get<Staff[]>('/api/payroll/workers').subscribe({ next: (w) => this.staff.set(w), error: (e) => this.fail(e) });
      return;
    }
    if (this.view() === 'day') {
      this.http.get<{ employees: DayRow[] }>('/api/payroll/attendance', { params: { day: this.day() } }).subscribe({ next: (r) => this.rows.set(r.employees), error: (e) => this.fail(e) });
    } else {
      this.http.get<{ employees: MonthRow[] }>('/api/payroll/attendance/month', { params: { month: this.day().slice(0, 7) } }).subscribe({ next: (r) => this.month.set(r.employees), error: (e) => this.fail(e) });
    }
  }

  private save(marks: { workerId: string; status: Status | null }[]): void {
    this.busy.set(true);
    this.error.set(null);
    this.http.put<{ employees: DayRow[] }>('/api/payroll/attendance', { day: this.day(), marks }).subscribe({
      next: (r) => { this.busy.set(false); this.rows.set(r.employees); },
      error: (e) => this.fail(e),
    });
  }

  /** One tap marks; the same tap again clears. */
  protected mark(r: DayRow, status: Status | null): void {
    this.save([{ workerId: r.id, status }]);
  }

  /** Everybody not marked yet is present; those already marked keep their mark. */
  protected allPresent(): void {
    const marks = (this.rows() ?? []).filter((r) => !r.status).map((r) => ({ workerId: r.id, status: 'PRESENT' as const }));
    if (marks.length) this.save(marks);
    this.toast.show(this.i18n.t('pay.saved'));
  }
}
