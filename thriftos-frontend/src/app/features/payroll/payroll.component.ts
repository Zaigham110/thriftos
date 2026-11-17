import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, MessageCircle, Plus } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { TenantService } from '../../core/tenant/tenant.service';
import { ToastService } from '../../shared/floor/toast.service';
import { localPhone, whatsappUrl } from '../../shared/phone';

type PayType = 'KG' | 'PIECE' | 'DAY' | 'MONTH';
interface Worker {
  id: string; name: string; phone: string | null; payType: PayType; rate: string; isActive: boolean;
  jobTitle?: string | null; cnic?: string | null; joinedOn?: string | null; leftOn?: string | null; address?: string | null; emergencyContact?: string | null; note?: string | null;
  /** What is left on their loans; paid leave days a year and those taken this year. */
  loanLeft?: string; leaveAllowance?: number; leaveTaken?: number;
}
interface WorkerForm { leaveAllowance: number | null; id: string | null; name: string; phone: string; payType: PayType; rate: number | null; isActive: boolean; jobTitle: string; cnic: string; joinedOn: string; leftOn: string; address: string; emergencyContact: string; note: string }
interface SheetRow { id: string; periodStart: string; periodEnd: string; status: 'DRAFT' | 'PAID'; total: string; workers: number }
interface Line { id: string; workerId: string; payType: PayType; rate: string; kg: string; pieces: number; days: string | number; absentDays?: string; loan?: string; gross: string; advances: string; deductions: string; net: string; note: string | null; worker: { id: string; name: string; phone: string | null } }
interface Sheet { id: string; periodStart: string; periodEnd: string; status: 'DRAFT' | 'PAID'; total: string; paidAt: string | null; lines: Line[] }
interface Prod { from: string; to: string; topGrade: string | null; workers: { id: string; name: string; kg: string; pieces: number; days: number; kgPerDay: string; piecesPerDay: number; topGradePercent: number | null }[] }
type Tab = 'workers' | 'sheets' | 'productivity';

const PAY_TYPES: PayType[] = ['KG', 'PIECE', 'DAY', 'MONTH'];
const ymd = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Employees (owner, 2026-11-17; it took the place of Sorter pay): everybody who works here, with or without a
 * login: their record (job, CNIC, joining date, address), how they are paid (month, day, kg or piece), advances,
 * pay sheets for a week or a month (paid in cash as one expense; each payslip to WhatsApp). Counting what each
 * sorter sorts is a choice; with it on, pay by kg or piece is worked out from sorting and there is a tab for it.
 */
const TABS: Tab[] = ['workers', 'sheets', 'productivity'];

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor payroll">
      <header class="floor-head"><h1>{{ 'pay.title' | t }}</h1></header>
      <div class="seg tabs" role="tablist">
        @for (t of shownTabs(); track t) {
          <button type="button" role="tab" [class.on]="tab() === t" [attr.aria-selected]="tab() === t" (click)="open(t)">{{ ('pay.tab.' + t) | t }}</button>
        }
      </div>
      @if (error(); as e) { <p class="notice error" role="alert">{{ e }}</p> }

      @if (tab() === 'workers') {
        <button type="button" class="btn primary add" (click)="newWorker()"><lucide-icon [img]="icons.Plus" [size]="18" /> {{ 'pay.addWorker' | t }}</button>
        @if (form(); as f) {
          <form class="card form" (ngSubmit)="saveWorker()">
            <label class="field">{{ 'pay.name' | t }}<input name="name" maxlength="80" required [(ngModel)]="f.name" /></label>
            <label class="field">{{ 'pay.phone' | t }} · {{ 'common.optional' | t }}<input name="phone" inputmode="tel" maxlength="30" dir="ltr" [(ngModel)]="f.phone" placeholder="0300 1234567" /></label>
            <span class="field-label">{{ 'pay.paidBy' | t }}</span>
            <div class="chips" role="group" [attr.aria-label]="'pay.paidBy' | t">
              @for (p of payTypes; track p) { <button type="button" class="chip" [class.on]="f.payType === p" [attr.aria-pressed]="f.payType === p" (click)="f.payType = p">{{ ('pay.type.' + p) | t }}</button> }
            </div>
            <label class="field">{{ ('pay.rateOf.' + f.payType) | t }}<input name="rate" type="number" min="0" step="0.01" required [(ngModel)]="f.rate" /></label>
            <label class="field">{{ 'pay.job' | t }} · {{ 'common.optional' | t }}<input name="job" maxlength="80" [(ngModel)]="f.jobTitle" [placeholder]="'pay.jobPlaceholder' | t" /></label>
            <details class="more">
              <summary>{{ 'pay.more' | t }}</summary>
              <div class="two">
                <label class="field">{{ 'pay.cnic' | t }}<input name="cnic" maxlength="20" dir="ltr" inputmode="numeric" [(ngModel)]="f.cnic" placeholder="42101-1234567-1" /></label>
                <label class="field">{{ 'pay.joinedOn' | t }}<input name="joined" type="date" [(ngModel)]="f.joinedOn" /></label>
              </div>
              <label class="field">{{ 'pay.address' | t }}<input name="address" maxlength="300" [(ngModel)]="f.address" /></label>
              <label class="field">{{ 'pay.emergency' | t }}<input name="emergency" maxlength="120" [(ngModel)]="f.emergencyContact" /></label>
              <label class="field">{{ 'pay.note' | t }}<input name="wnote" maxlength="500" [(ngModel)]="f.note" /></label>
              <label class="field">{{ 'pay.leaveAllowance' | t }}<input name="leave" type="number" min="0" max="366" step="1" [(ngModel)]="f.leaveAllowance" /><small class="hint">{{ 'pay.leaveHint' | t }}</small></label>
              @if (f.id && !f.isActive) { <label class="field">{{ 'pay.leftOn' | t }}<input name="left" type="date" [(ngModel)]="f.leftOn" /></label> }
            </details>
            @if (f.id) { <label class="check"><input name="active" type="checkbox" [(ngModel)]="f.isActive" /> {{ 'pay.active' | t }}</label> }
            <div class="row-btns">
              <button type="button" class="btn" (click)="form.set(null)">{{ 'common.cancel' | t }}</button>
              <button type="submit" class="btn primary" [disabled]="busy() || !f.name.trim() || f.rate === null">{{ 'common.save' | t }}</button>
            </div>
          </form>
        }
        @if (!workers().length && !form()) { <p class="notice empty">{{ 'pay.noWorkers' | t }}</p> }
        <ul class="list">
          @for (w of workers(); track w.id) {
            <li class="row worker" [class.off]="!w.isActive">
              <span>
                <strong>{{ w.name }}</strong>
                <small>@if (w.jobTitle) { {{ w.jobTitle }} · }{{ ('pay.rateText.' + w.payType) | t: { rs: i18n.money(w.rate) } }}@if (w.joinedOn && w.isActive) { · {{ 'pay.since' | t: { date: longDay(w.joinedOn) } }} }@if (w.leftOn && !w.isActive) { · {{ 'pay.left' | t: { date: longDay(w.leftOn) } }} }@if (w.phone) { · <span dir="ltr">{{ local(w.phone) }}</span> }@if (!w.isActive) { · {{ 'pay.inactive' | t }} }@if (w.leaveAllowance) { · {{ 'pay.leaveOf' | t: { taken: w.leaveTaken ?? 0, of: w.leaveAllowance } }} }@if (w.loanLeft && +w.loanLeft) { · <span class="owes">{{ 'pay.loanLeft' | t: { rs: i18n.money(w.loanLeft) } }}</span> }</small>
              </span>
              <span class="btns">
                <button type="button" class="link" (click)="edit(w)">{{ 'pay.edit' | t }}</button>
                @if (w.isActive) { <button type="button" class="link" (click)="startAdvance(w)">{{ 'pay.advance' | t }}</button> }
                @if (w.isActive) { <button type="button" class="link" (click)="startLoan(w, 'give')">{{ 'pay.loan' | t }}</button> }
                @if (w.loanLeft && +w.loanLeft) { <button type="button" class="link" (click)="startLoan(w, 'repay')">{{ 'pay.loanRepay' | t }}</button> }
              </span>
            </li>
            @if (loanFor()?.id === w.id) {
              <li>
                <form class="card form" (ngSubmit)="saveLoan(w)">
                  @if (loanFor()!.mode === 'give') {
                    <label class="field">{{ 'pay.loanAmount' | t: { name: w.name } }}<input name="lamount" type="number" min="1" step="1" required [(ngModel)]="loanAmount" /></label>
                    <label class="field">{{ 'pay.loanInstalment' | t }}<input name="linst" type="number" min="1" step="1" required [(ngModel)]="loanInstalment" /></label>
                    <label class="field">{{ 'pay.note' | t }} · {{ 'common.optional' | t }}<input name="lnote" maxlength="200" [(ngModel)]="loanNote" /></label>
                    <small class="hint">{{ 'pay.loanHint' | t }}</small>
                  } @else {
                    <label class="field">{{ 'pay.loanRepayAmount' | t: { name: w.name, rs: i18n.money(w.loanLeft ?? 0) } }}<input name="ramount" type="number" min="1" step="1" required [(ngModel)]="loanAmount" /></label>
                    <small class="hint">{{ 'pay.loanRepayHint' | t }}</small>
                  }
                  <div class="row-btns">
                    <button type="button" class="btn" (click)="loanFor.set(null)">{{ 'common.cancel' | t }}</button>
                    <button type="submit" class="btn primary" [disabled]="busy() || !(loanAmount > 0) || (loanFor()!.mode === 'give' && !(loanInstalment > 0))">{{ (loanFor()!.mode === 'give' ? 'pay.loanGive' : 'pay.loanRepay') | t }}</button>
                  </div>
                </form>
              </li>
            }
            @if (advanceFor() === w.id) {
              <li>
                <form class="card form" (ngSubmit)="giveAdvance(w)">
                  <label class="field">{{ 'pay.advanceAmount' | t: { name: w.name } }}<input name="amount" type="number" min="1" step="1" required [(ngModel)]="advance" /></label>
                  <label class="field">{{ 'pay.note' | t }} · {{ 'common.optional' | t }}<input name="anote" maxlength="200" [(ngModel)]="advanceNote" /></label>
                  <small class="hint">{{ 'pay.advanceHint' | t }}</small>
                  <div class="row-btns">
                    <button type="button" class="btn" (click)="advanceFor.set(null)">{{ 'common.cancel' | t }}</button>
                    <button type="submit" class="btn primary" [disabled]="busy() || !(advance > 0)">{{ 'pay.giveAdvance' | t }}</button>
                  </div>
                </form>
              </li>
            }
          }
        </ul>
        <a class="btn att" routerLink="/people/attendance">{{ 'pay.att.title' | t }}</a>
        <label class="check count"><input type="checkbox" [checked]="counting()" [disabled]="busy()" (change)="setCounting($any($event.target).checked)" /> <span>{{ 'pay.countSorting' | t }}<small>{{ 'pay.countSortingHint' | t }}</small></span></label>
      }

      @if (tab() === 'sheets') {
        @if (!sheet()) {
          <form class="card form" (ngSubmit)="makeSheet()">
            <span class="field-label">{{ 'pay.newSheet' | t }}</span>
            <div class="chips">
              <button type="button" class="chip" (click)="period('week')">{{ 'pay.thisWeek' | t }}</button>
              <button type="button" class="chip" (click)="period('lastWeek')">{{ 'pay.lastWeek' | t }}</button>
              <button type="button" class="chip" (click)="period('month')">{{ 'pay.thisMonth' | t }}</button>
              <button type="button" class="chip" (click)="period('lastMonth')">{{ 'pay.lastMonth' | t }}</button>
            </div>
            <div class="two">
              <label class="field">{{ 'pay.from' | t }}<input name="from" type="date" required [(ngModel)]="from" /></label>
              <label class="field">{{ 'pay.to' | t }}<input name="to" type="date" required [(ngModel)]="to" /></label>
            </div>
            <button type="submit" class="btn primary" [disabled]="busy() || !from || !to || !hasWorkers()">{{ 'pay.makeSheet' | t }}</button>
            @if (!hasWorkers()) { <p class="hint">{{ 'pay.needWorkers' | t }}</p> }
          </form>
          <ul class="list">
            @for (s of sheets(); track s.id) {
              <li><button type="button" class="row" (click)="openSheet(s.id)">
                <span><strong>{{ day(s.periodStart) }} – {{ day(s.periodEnd) }}</strong><small>{{ 'pay.workersN' | t: { n: s.workers } }} <span class="ws-status" [attr.data-tone]="s.status === 'PAID' ? 'good' : 'warn'">{{ (s.status === 'PAID' ? 'pay.paid' : 'pay.draft') | t }}</span></small></span>
                <span class="amount">{{ i18n.money(s.total) }}</span>
              </button></li>
            } @empty { <li class="notice empty">{{ 'pay.noSheets' | t }}</li> }
          </ul>
        } @else {
          @let s = sheet()!;
          <div class="card">
            <div class="sheet-head">
              <span><strong>{{ day(s.periodStart) }} – {{ day(s.periodEnd) }}</strong><small>{{ (s.status === 'PAID' ? 'pay.paidOn' : 'pay.draftHint') | t: { date: day(s.paidAt) } }}</small></span>
              <button type="button" class="link" (click)="sheet.set(null)">{{ 'pay.allSheets' | t }}</button>
            </div>
            <ul class="list lines">
              @for (l of s.lines; track l.id) {
                <li class="line">
                  <div class="lhead">
                    <strong>{{ l.worker.name }}</strong>
                    <span class="amount">{{ i18n.money(l.net) }}</span>
                  </div>
                  <small>{{ workText(l) }} = {{ i18n.money(l.gross) }}@if (l.absentDays && +l.absentDays) { · {{ 'pay.absentN' | t: { n: +l.absentDays } }} }@if (+l.advances) { · {{ 'pay.lessAdvance' | t: { rs: i18n.money(l.advances) } }} }@if (+l.deductions) { · {{ 'pay.lessDeduction' | t: { rs: i18n.money(l.deductions) } }} }@if (l.loan && +l.loan) { · {{ 'pay.lessLoan' | t: { rs: i18n.money(l.loan) } }} }@if (l.note) { · {{ l.note }} }</small>
                  @if (s.status === 'DRAFT') {
                    <div class="edit">
                      @if (l.payType === 'DAY') { <label>{{ 'pay.days' | t }}<input type="number" min="0" max="31" step="0.5" [value]="+l.days" (change)="saveLine(l, { days: +$any($event.target).value })" /></label> }
                      <label>{{ 'pay.deduction' | t }}<input type="number" min="0" [value]="+l.deductions || ''" (change)="saveLine(l, { deductions: +$any($event.target).value || 0 })" /></label>
                      @if (l.loan && +l.loan) { <label>{{ 'pay.loanOff' | t }}<input type="number" min="0" [value]="+l.loan" (change)="saveLine(l, { loan: +$any($event.target).value || 0 })" /></label> }
                      <label>{{ 'pay.note' | t }}<input maxlength="200" [value]="l.note ?? ''" (change)="saveLine(l, { note: $any($event.target).value })" /></label>
                    </div>
                  } @else if (l.worker.phone) {
                    <a class="link wa" [href]="slipLink(s, l)" target="_blank" rel="noopener"><lucide-icon [img]="icons.MessageCircle" [size]="16" /> {{ 'pay.sendSlip' | t }}</a>
                  }
                </li>
              }
            </ul>
            <div class="total"><span>{{ 'pay.total' | t }}</span><strong>{{ i18n.money(s.total) }}</strong></div>
            @if (s.status === 'DRAFT') {
              <div class="row-btns">
                <button type="button" class="btn" [disabled]="busy()" (click)="deleteSheet(s)">{{ 'pay.deleteSheet' | t }}</button>
                <button type="button" class="btn primary" [disabled]="busy()" (click)="paySheet(s)">{{ 'pay.markPaid' | t: { rs: i18n.money(s.total) } }}</button>
              </div>
              <small class="hint">{{ 'pay.markPaidHint' | t }}</small>
            }
          </div>
        }
      }

      @if (tab() === 'productivity') {
        <div class="two card">
          <label class="field">{{ 'pay.from' | t }}<input type="date" [(ngModel)]="pFrom" (change)="loadProd()" /></label>
          <label class="field">{{ 'pay.to' | t }}<input type="date" [(ngModel)]="pTo" (change)="loadProd()" /></label>
        </div>
        @if (prod(); as p) {
          <table class="table">
            <caption class="sr-only">{{ 'pay.tab.productivity' | t }}</caption>
            <thead><tr><th scope="col">{{ 'pay.name' | t }}</th><th scope="col" class="num">{{ 'pay.kgPerDay' | t }}</th><th scope="col" class="num">{{ 'pay.sortedKg' | t }}</th><th scope="col" class="num">{{ 'pay.daysWorked' | t }}</th><th scope="col" class="num">{{ 'pay.topShare' | t }}</th></tr></thead>
            <tbody>
              @for (w of p.workers; track w.id) {
                <tr><td>{{ w.name }}</td><td class="num">{{ i18n.kg(w.kgPerDay) }}@if (w.piecesPerDay) { <small>{{ 'ws.lf.piecesN' | t: { n: i18n.num(w.piecesPerDay) } }}</small> }</td><td class="num">{{ i18n.kg(w.kg) }}</td><td class="num">{{ w.days }}</td><td class="num">{{ w.topGradePercent === null ? '—' : w.topGradePercent + '%' }}</td></tr>
              } @empty { <tr><td colspan="5" class="notice empty">{{ 'pay.noWork' | t }}</td></tr> }
            </tbody>
          </table>
        }
      }
    </section>
  `,
  styles: [`
    /* On a laptop the screen uses the page, not a phone-width column (v2 review). */
    @media (min-width: 1024px) { .floor.payroll { max-width:960px; } .payroll .btn.primary.add, .payroll form .btn.primary { justify-self:start; width:auto; padding-inline:20px; } }
    /* An empty list is a quiet line, not a green success box. */
    .notice.empty { padding-inline:0; background:transparent; color:var(--tos-ink-soft); font-weight:500; }
    .payroll .tabs { display:inline-flex; border:1px solid var(--tos-line); border-radius:12px; overflow:hidden; margin-bottom:12px; }
    .payroll .tabs button { min-height:44px; padding:0 14px; border:0; background:var(--tos-card); font:inherit; font-weight:700; cursor:pointer; }
    .payroll .tabs button.on { background:var(--tos-primary); color:#fff; }
    .add { margin-bottom:10px; display:inline-flex; gap:6px; align-items:center; }
    .form { display:grid; gap:10px; margin-bottom:12px; }
    .two { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; }
    .row-btns { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
    .check { display:flex; gap:8px; align-items:center; font-weight:600; }
    .btn.att { justify-self:start; margin-top:10px; }
    .check.count { align-items:flex-start; margin-top:14px; }
    .check.count span { display:grid; gap:2px; }
    .check.count small { color:var(--tos-ink-soft); font-weight:500; }
    .owes { color:var(--tos-danger, #b3261e); font-weight:600; }
    details.more { display:grid; gap:10px; }
    details.more summary { cursor:pointer; font-weight:600; color:var(--tos-primary); min-height:36px; }
    details.more[open] summary { margin-bottom:10px; }
    .worker.off { opacity:.6; }
    .worker .btns { display:flex; gap:12px; }
    .link { border:0; background:none; color:var(--tos-primary); font:inherit; font-weight:700; cursor:pointer; padding:0; display:inline-flex; gap:4px; align-items:center; text-decoration:none; }
    .hint { color:var(--tos-ink-soft); }
    .sheet-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px; }
    .sheet-head span { display:grid; }
    .sheet-head small, .line small { color:var(--tos-ink-soft); }
    .line { display:grid; gap:4px; padding:10px 0; border-block-end:1px solid var(--tos-line); }
    .lhead { display:flex; justify-content:space-between; gap:8px; }
    .edit { display:flex; flex-wrap:wrap; gap:8px; }
    .edit label { display:grid; gap:2px; font-size:13px; font-weight:600; }
    .edit input { min-height:40px; width:110px; padding:4px 8px; border:1px solid var(--tos-line); border-radius:8px; font:inherit; }
    .total { display:flex; justify-content:space-between; padding:12px 0; font-size:18px; }
    .table { width:100%; border-collapse:collapse; }
    .table th, .table td { padding:8px 6px; border-block-end:1px solid var(--tos-line); text-align:start; }
    .table .num { text-align:end; }
    .table td small { display:block; color:var(--tos-ink-soft); }
  `],
})
export class PayrollComponent {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly tenants = inject(TenantService);
  protected readonly icons = { MessageCircle, Plus };
  protected readonly tabs: Tab[] = TABS;
  protected readonly payTypes = PAY_TYPES;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  /** ?tab= keeps the tab over a refresh or Back. */
  protected readonly tab = signal<Tab>(((t) => (TABS.includes(t as Tab) ? (t as Tab) : 'workers'))(this.route.snapshot.queryParamMap.get('tab') ?? (this.route.snapshot.data['tab'] as string | undefined) ?? null));
  /** Counting what each sorter sorts is a choice; its tab shows only with it on. */
  protected readonly counting = signal(false);
  protected readonly shownTabs = computed(() => this.tabs.filter((t) => t !== 'productivity' || this.counting()));
  /** A pay sheet needs somebody to pay. */
  protected readonly hasWorkers = computed(() => this.workers().some((w) => w.isActive !== false));
  protected readonly workers = signal<Worker[]>([]);
  protected readonly sheets = signal<SheetRow[]>([]);
  protected readonly sheet = signal<Sheet | null>(null);
  protected readonly prod = signal<Prod | null>(null);
  protected readonly form = signal<WorkerForm | null>(null);
  protected readonly advanceFor = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected advance = 0;
  protected advanceNote = '';
  protected from = '';
  protected to = '';
  protected pFrom = ymd(new Date(Date.now() - 6 * 86_400_000));
  protected pTo = ymd(new Date());
  protected readonly business = computed(() => this.tenants.tenant()?.name ?? '');

  constructor() {
    this.loadWorkers();
    this.http.get<{ trackSorterWork: boolean }>('/api/payroll/settings').subscribe({ next: (s) => this.counting.set(s.trackSorterWork), error: () => undefined });
    this.period('lastWeek');
    if (this.tab() === 'sheets') this.loadSheets();
    if (this.tab() === 'productivity') this.loadProd();
  }

  protected open(t: Tab): void {
    this.tab.set(t);
    // Employees and Pay have their own addresses (the menu has both); sorting work is a tab of Employees.
    void this.router.navigate([t === 'sheets' ? '/people/pay' : '/people'], { queryParams: t === 'productivity' ? { tab: t } : {}, replaceUrl: true });
    this.error.set(null);
    if (t === 'sheets') this.loadSheets();
    if (t === 'productivity') this.loadProd();
  }

  private fail(e: HttpErrorResponse): void {
    this.busy.set(false);
    const m = e.error?.message;
    this.error.set(Array.isArray(m) ? m.join(', ') : m ?? this.i18n.t('common.couldNotSave'));
  }

  protected longDay(v: string): string {
    return new Date(`${v.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  protected setCounting(on: boolean): void {
    this.busy.set(true);
    this.http.patch<{ trackSorterWork: boolean }>('/api/payroll/settings', { trackSorterWork: on }).subscribe({
      next: (s) => { this.busy.set(false); this.counting.set(s.trackSorterWork); this.toast.show(this.i18n.t('pay.saved')); },
      error: (e) => this.fail(e),
    });
  }

  protected local(p: string): string {
    return localPhone(p);
  }

  protected day(v: string | null): string {
    return v ? new Date(v.length === 10 ? `${v}T00:00:00Z` : v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  }

  // Workers
  private loadWorkers(): void {
    this.http.get<Worker[]>('/api/payroll/workers?all=1').subscribe({ next: (w) => this.workers.set(w), error: (e) => this.fail(e) });
  }

  protected newWorker(): void {
    // Most staff are on a monthly wage; per kg or piece is for a business that counts sorting.
    this.form.set({ id: null, name: '', phone: '', payType: this.counting() ? 'KG' : 'MONTH', rate: null, isActive: true, leaveAllowance: null, jobTitle: '', cnic: '', joinedOn: '', leftOn: '', address: '', emergencyContact: '', note: '' });
  }

  protected edit(w: Worker): void {
    this.form.set({
      id: w.id, name: w.name, phone: w.phone ? localPhone(w.phone) : '', payType: w.payType, rate: Number(w.rate), isActive: w.isActive,
      leaveAllowance: w.leaveAllowance || null, jobTitle: w.jobTitle ?? '', cnic: w.cnic ?? '', joinedOn: (w.joinedOn ?? '').slice(0, 10), leftOn: (w.leftOn ?? '').slice(0, 10), address: w.address ?? '', emergencyContact: w.emergencyContact ?? '', note: w.note ?? '',
    });
  }

  protected saveWorker(): void {
    const f = this.form();
    if (!f) return;
    this.busy.set(true);
    this.error.set(null);
    const body = {
      name: f.name.trim(), phone: f.phone.trim() || null, payType: f.payType, rate: Number(f.rate),
      leaveAllowance: Math.max(0, Math.round(Number(f.leaveAllowance) || 0)),
      jobTitle: f.jobTitle.trim() || null, cnic: f.cnic.trim() || null, address: f.address.trim() || null, emergencyContact: f.emergencyContact.trim() || null, note: f.note.trim() || null,
      ...(f.joinedOn ? { joinedOn: f.joinedOn } : f.id ? { joinedOn: null } : {}),
      ...(f.id ? { isActive: f.isActive, leftOn: !f.isActive && f.leftOn ? f.leftOn : null } : {}),
    };
    const req = f.id ? this.http.patch(`/api/payroll/workers/${f.id}`, body) : this.http.post('/api/payroll/workers', body);
    req.subscribe({
      next: () => { this.busy.set(false); this.form.set(null); this.toast.show(this.i18n.t('pay.saved')); this.loadWorkers(); },
      error: (e) => this.fail(e),
    });
  }

  /** One key per entry: a double tap or a retry on a slow line saves it once (the server keeps the first answer). */
  private saveKey = crypto.randomUUID();

  // Loans: lend (cash out, not an expense; an instalment comes off each pay) or take cash back.
  protected readonly loanFor = signal<{ id: string; mode: 'give' | 'repay' } | null>(null);
  protected loanAmount = 0;
  protected loanInstalment = 0;
  protected loanNote = '';

  protected startLoan(w: Worker, mode: 'give' | 'repay'): void {
    this.saveKey = crypto.randomUUID();
    this.loanAmount = 0;
    this.loanInstalment = 0;
    this.loanNote = '';
    this.advanceFor.set(null);
    this.loanFor.set({ id: w.id, mode });
  }

  protected saveLoan(w: Worker): void {
    const mode = this.loanFor()?.mode;
    if (!mode) return;
    this.busy.set(true);
    this.error.set(null);
    const headers = new HttpHeaders({ 'Idempotency-Key': this.saveKey });
    const req = mode === 'give'
      ? this.http.post(`/api/payroll/workers/${w.id}/loans`, { amount: Number(this.loanAmount), instalment: Number(this.loanInstalment), ...(this.loanNote.trim() ? { note: this.loanNote.trim() } : {}) }, { headers })
      : this.http.post(`/api/payroll/workers/${w.id}/loans/repay`, { amount: Number(this.loanAmount) }, { headers });
    req.subscribe({
      next: () => {
        this.busy.set(false);
        this.loanFor.set(null);
        this.toast.show(this.i18n.t(mode === 'give' ? 'pay.loanGiven' : 'pay.loanRepaid', { rs: this.i18n.money(this.loanAmount), name: w.name }));
        this.loadWorkers();
      },
      error: (e) => this.fail(e),
    });
  }

  protected startAdvance(w: Worker): void {
    this.loanFor.set(null);
    this.saveKey = crypto.randomUUID();
    this.advance = 0;
    this.advanceNote = '';
    this.advanceFor.set(w.id);
  }

  protected giveAdvance(w: Worker): void {
    this.busy.set(true);
    this.http.post(`/api/payroll/workers/${w.id}/advances`, { amount: Number(this.advance), ...(this.advanceNote.trim() ? { note: this.advanceNote.trim() } : {}) }, { headers: new HttpHeaders({ 'Idempotency-Key': this.saveKey }) }).subscribe({
      next: () => { this.busy.set(false); this.advanceFor.set(null); this.toast.show(this.i18n.t('pay.advanceGiven', { rs: this.i18n.money(this.advance), name: w.name })); },
      error: (e) => this.fail(e),
    });
  }

  // Pay sheets
  protected period(which: 'week' | 'lastWeek' | 'month' | 'lastMonth'): void {
    const now = new Date(Date.now() + 5 * 3_600_000);
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    // Weeks run Monday to Sunday.
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
    if (which === 'week') { this.from = iso(monday); this.to = iso(d); }
    if (which === 'lastWeek') { this.from = iso(new Date(monday.getTime() - 7 * 86_400_000)); this.to = iso(new Date(monday.getTime() - 86_400_000)); }
    if (which === 'month') { this.from = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))); this.to = iso(d); }
    if (which === 'lastMonth') { this.from = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))); this.to = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))); }
  }

  private loadSheets(): void {
    this.http.get<SheetRow[]>('/api/payroll/sheets').subscribe({ next: (s) => this.sheets.set(s), error: (e) => this.fail(e) });
  }

  protected makeSheet(): void {
    this.busy.set(true);
    this.error.set(null);
    this.http.post<Sheet>('/api/payroll/sheets', { periodStart: this.from, periodEnd: this.to }).subscribe({
      next: (s) => { this.busy.set(false); this.sheet.set(s); },
      error: (e) => this.fail(e),
    });
  }

  protected openSheet(id: string): void {
    this.http.get<Sheet>(`/api/payroll/sheets/${id}`).subscribe({ next: (s) => this.sheet.set(s), error: (e) => this.fail(e) });
  }

  protected saveLine(l: Line, body: { days?: number; deductions?: number; loan?: number; note?: string }): void {
    this.error.set(null);
    this.http.patch<Sheet>(`/api/payroll/lines/${l.id}`, body).subscribe({ next: (s) => this.sheet.set(s), error: (e) => this.fail(e) });
  }

  protected paySheet(s: Sheet): void {
    if (!window.confirm(this.i18n.t('pay.confirmPaid', { rs: this.i18n.money(s.total) }))) return;
    this.busy.set(true);
    this.http.post<Sheet>(`/api/payroll/sheets/${s.id}/pay`, {}).subscribe({
      next: (x) => { this.busy.set(false); this.sheet.set(x); this.toast.show(this.i18n.t('pay.paidDone')); },
      error: (e) => this.fail(e),
    });
  }

  protected deleteSheet(s: Sheet): void {
    if (!window.confirm(this.i18n.t('pay.confirmDelete'))) return;
    this.busy.set(true);
    this.http.delete(`/api/payroll/sheets/${s.id}`).subscribe({
      next: () => { this.busy.set(false); this.sheet.set(null); this.loadSheets(); },
      error: (e) => this.fail(e),
    });
  }

  /** "300 kg × Rs 10", "40 pcs × Rs 5", "6 days × Rs 1,500", "Monthly Rs 30,000". */
  protected workText(l: Line): string {
    const rate = this.i18n.money(l.rate);
    switch (l.payType) {
      case 'KG': return `${this.i18n.kg(l.kg)} × ${rate}`;
      case 'PIECE': return `${this.i18n.t('ws.lf.piecesN', { n: this.i18n.num(l.pieces) })} × ${rate}`;
      case 'DAY': return `${this.i18n.t('pay.daysN', { n: this.i18n.num(Number(l.days), 1).replace(/\.0$/, '') })} × ${rate}`;
      default: return this.i18n.t('pay.monthly', { rs: rate });
    }
  }

  /** The payslip as a WhatsApp message to the worker. */
  protected slipLink(s: Sheet, l: Line): string {
    const lines = [
      this.i18n.t('pay.slipHead', { business: this.business(), from: this.day(s.periodStart), to: this.day(s.periodEnd) }),
      `${l.worker.name}: ${this.workText(l)} = ${this.i18n.money(l.gross)}`,
      ...(+l.advances ? [this.i18n.t('pay.lessAdvance', { rs: this.i18n.money(l.advances) })] : []),
      ...(+l.deductions ? [this.i18n.t('pay.lessDeduction', { rs: this.i18n.money(l.deductions) })] : []),
      ...(l.loan && +l.loan ? [this.i18n.t('pay.lessLoan', { rs: this.i18n.money(l.loan) })] : []),
      this.i18n.t('pay.slipNet', { rs: this.i18n.money(l.net) }),
    ];
    return whatsappUrl(l.worker.phone!, lines.join('\n').replace(/[⁦-⁩]/g, ''));
  }

  // Productivity
  protected loadProd(): void {
    if (!this.pFrom || !this.pTo) return;
    this.http.get<Prod>(`/api/payroll/productivity?from=${this.pFrom}&to=${this.pTo}`).subscribe({ next: (p) => this.prod.set(p), error: (e) => this.fail(e) });
  }
}
