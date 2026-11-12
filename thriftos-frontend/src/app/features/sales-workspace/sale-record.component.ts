import { moduleOn } from '../../core/tenant/module-on';
import { ExportPackComponent } from './export-pack.component';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NavService } from '../../core/nav/nav.service';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { BookOpen, Coins, FileText, LucideAngularModule, MessageCircle, Printer, Receipt, Wallet } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { KhataService } from '../../modules/sales/khata.service';
import type { SaleDetail } from '../../modules/sales/sales.models';
import { SalesService } from '../../modules/sales/sales.service';
import { ToastService } from '../../shared/floor/toast.service';
import { PrintDocsService, PrintJob } from '../../core/print/print-docs.service';
import { PrintSheetComponent } from '../../shared/print/print-sheet.component';
import {
  WsColumn,
  WsDataGridComponent,
  WsPageHeaderComponent,
  WsRecordActivityComponent,
  WsRow,
  WsSmartButtonComponent,
  WsStateComponent,
  WsStatusPipelineComponent,
  WsTab,
  WsTabsComponent,
  WsSideSheetComponent,
} from '../../shared/ui/workspace';
import { FormsModule } from '@angular/forms';

/** Where a sale is in its life; a cancelled sale shows its own badge instead. */
const STEPS = ['ISSUED', 'PARTIALLY_PAID', 'PAID'] as const;
const UNIT_KEYS: Record<string, string> = { KG: 'unit.kgShort', BALE: 'unit.bale', PIECE: 'unit.piece' };

/**
 * A sale's record page in the workspace (enterprise plan E2): header with actions, status pipeline,
 * related amounts, lines and payments, and the activity panel (history, notes, files).
 */
@Component({
  selector: 'app-sale-record',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    TPipe,
    WsDataGridComponent,
    WsPageHeaderComponent,
    WsRecordActivityComponent,
    WsSmartButtonComponent,
    WsStateComponent,
    WsStatusPipelineComponent,
    WsTabsComponent,
    WsSideSheetComponent,
    FormsModule,
    PrintSheetComponent,
    ExportPackComponent,
  ],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.sale.notFound' | t" (retry)="reload()" />
    } @else if (sale(); as s) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="s.saleNumber + ' · ' + (s.customer?.name ?? '')" [subtitle]="subtitle()">
            <!-- One Print (the bill: Bluetooth printer, print dialog or picture), the WhatsApp share and the customer's bill page (v2 review). -->
            @if (+s.due > 0 && s.status !== 'CANCELLED') {
              <button actions type="button" class="ws-btn primary" (click)="openReceive()"><lucide-icon [img]="icons.Wallet" [size]="16" aria-hidden="true" />{{ 'ws.customer.receive' | t }}</button>
            }
            <button actions type="button" class="ws-btn" (click)="share()"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.sale.share' | t }}</button>
            <button actions type="button" class="ws-btn" (click)="printThermal(s.id)"><lucide-icon [img]="icons.Printer" [size]="16" aria-hidden="true" />{{ 'ws.sale.print' | t }}</button>
            <a actions class="ws-btn" [routerLink]="['/bill', s.billToken]" target="_blank" rel="noopener"><lucide-icon [img]="icons.FileText" [size]="16" aria-hidden="true" />{{ 'ws.sp2.billPage' | t }}</a>
          </ws-page-header>

          @if (s.status === 'CANCELLED') {
            <p class="badge bad" role="status">{{ 'ws.status.CANCELLED' | t }}</p>
          } @else {
            <ws-status-pipeline [steps]="steps()" [current]="stepIndex()" [label]="'ws.col.status' | t" />
          }

          <section class="smart">
            <ws-smart-button [label]="'ws.col.total' | t" [value]="i18n.money(round(s.totalAmount))" [icon]="icons.Receipt" [link]="[]" />
            <ws-smart-button [label]="'ws.sale.paid' | t" [value]="i18n.money(round(s.paid))" [icon]="icons.Wallet" tone="good" [link]="[]" [query]="{ tab: 'payments' }" />
            <ws-smart-button [label]="'ws.sale.due' | t" [value]="i18n.money(round(s.due))" [icon]="icons.Coins" [tone]="+s.due > 0 ? 'bad' : 'plain'" [link]="[]" [query]="{ tab: 'payments' }" />
            @if (canSeeCost()) { <ws-smart-button [label]="'ws.col.profit' | t" [value]="i18n.money(round(s.totalProfit ?? 0))" [icon]="icons.Coins" [tone]="+(s.totalProfit ?? 0) >= 0 ? 'good' : 'bad'" [link]="[]" /> }
            <ws-smart-button [label]="'ws.sale.balance' | t" [value]="i18n.money(round(s.customerBalance))" [icon]="icons.BookOpen" [link]="['/khata/records', s.customerId]" />
          </section>

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="pickTab($event)" [label]="s.saleNumber" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()">
            @if (tab() === 'lines') {
              <ws-data-grid [caption]="'ws.sale.lines' | t" [columns]="lineColumns()" [rows]="lineRows()" />
            } @else if (tab() === 'export' && canExport()) {
              <app-export-pack [saleId]="s.id" [local]="!isExport()" (madeExport)="reload()" />
            } @else {
              <ws-data-grid [caption]="'ws.sale.payments' | t" [columns]="paymentColumns()" [rows]="paymentRows()" [emptyHeading]="'ws.sale.noPayments' | t" />
              <p class="hint">{{ 'ws.sp2.paymentsHint' | t }}</p>
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="sale" [recordId]="s.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
    }
    @if (sale(); as s) {
      <ws-side-sheet [open]="receiving()" [heading]="'ws.customer.receive' | t" (close)="receiving.set(false)">
        <form class="form" id="ws-sale-pay" (ngSubmit)="receive()">
          <p class="hint">{{ 'ws.sp2.receiveHint' | t: { due: i18n.money(round(s.due)), no: s.saleNumber } }}</p>
          <label>{{ 'ws.sale.amount' | t }}<input name="amount" type="number" min="1" step="1" required [(ngModel)]="payAmount" /></label>
          <label>{{ 'ws.sale.method' | t }}
            <select name="method" [(ngModel)]="payMethod">@for (m of methods; track m) { <option [value]="m">{{ 'method.' + m | t }}</option> }</select>
          </label>
          <label>{{ 'ws.sale.reference' | t }} · {{ 'common.optional' | t }}<input name="ref" maxlength="100" [(ngModel)]="payRef" /></label>
        </form>
        <ng-container footer>
          <button type="button" class="ws-btn" (click)="receiving.set(false)">{{ 'common.cancel' | t }}</button>
          <button type="submit" form="ws-sale-pay" class="ws-btn primary" [disabled]="busy() || !payAmount || payAmount < 1">{{ 'ws.customer.saveReceipt' | t }}</button>
        </ng-container>
      </ws-side-sheet>
    }
    @if (printJob(); as job) { <app-print-sheet [tickets]="job.tickets" [kind]="job.kind" [title]="job.title" (closed)="printJob.set(null)" /> }
  `,
  styles: [`
    .record { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; align-items:start; font-family:var(--ws-font); color:var(--ws-ink); }
    .main { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-4); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); }
    .smart { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:var(--ws-3); }
    .ws-btn { height:var(--ws-control-h); display:inline-flex; align-items:center; gap:6px; padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-weight:500; text-decoration:none; cursor:pointer; }
    .ws-btn:hover { background:var(--ws-surface-hover); }
    .ws-btn.primary { border-color:var(--ws-brand); background:var(--ws-brand); color:var(--ws-brand-ink); }
    .hint { margin:var(--ws-2) 0 0; color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
    .form { display:grid; gap:var(--ws-3); }
    .form label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .form input, .form select { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    .badge { justify-self:start; margin:0; padding:var(--ws-1) var(--ws-3); border-radius:var(--ws-r-md); font-weight:600; }
    .badge.bad { background:var(--ws-bad-soft); color:var(--ws-bad); }
    @media (max-width: 1199px) { .record { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
    @media print { .side, ws-tabs, .ws-btn { display:none !important; } }
  `],
})
export class SaleRecordComponent {
  protected readonly i18n = inject(I18nService);
  private readonly sales = inject(SalesService);
  private readonly khata = inject(KhataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  /** Route parameter (component input binding). */
  readonly id = input.required<string>();
  private readonly tabRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** The tab goes into the address (?tab=), so Back from a row opens this tab again. */
  protected pickTab(tab: string): void {
    void this.router.navigate([], { relativeTo: this.tabRoute, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected readonly nav = inject(NavService);
  /** The breadcrumb and browser tab name this record once it has loaded. */
  private readonly crumbName = effect(() => {
    const d = this.sale();
    const id = this.id();
    if (d && id) this.nav.setName(id, d.saleNumber);
  });
  /** ?tab=payments from a smart button. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { BookOpen, Coins, FileText, MessageCircle, Printer, Receipt, Wallet };
  protected readonly sale = signal<SaleDetail | null>(null);
  protected readonly failed = signal(false);
  private readonly reloads = signal(0);
  protected readonly chosenTab = signal<string | null>(null);
  protected readonly tab = computed(() => this.chosenTab() ?? (this.tabParam() === 'payments' ? 'payments' : this.tabParam() === 'export' ? 'export' : 'lines'));
  protected readonly canSeeCost = computed(() => this.auth.isSuperAdmin() || this.auth.permissions().includes('cost.view'));

  protected readonly steps = computed(() => STEPS.map((s) => this.i18n.t(`ws.status.${s}`)));
  protected readonly stepIndex = computed(() => Math.max(0, STEPS.indexOf((this.sale()?.status ?? 'ISSUED') as (typeof STEPS)[number])));
  protected readonly subtitle = computed(() => {
    const s = this.sale();
    if (!s) return '';
    const date = new Date(s.createdAt).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
    // Who made it is in the activity panel (the sale only carries the user id).
    return [date, this.i18n.t(`ws.mode.${s.paymentMode}`)].join(' · ');
  });
  protected readonly tabs = computed<WsTab[]>(() => [
    { id: 'lines', label: this.i18n.t('ws.sale.lines'), count: this.sale()?.lines.length ?? 0 },
    { id: 'payments', label: this.i18n.t('ws.sale.payments'), count: this.sale()?.paidBy?.length ?? 0 },
    // Phase 9.2: an export sale's pack (packing list, commercial invoice, bale records); a local sale can be made export there.
    ...(this.canExport() ? [{ id: 'export', label: this.i18n.t('xp.tab') }] : []),
  ]);
  private readonly on = moduleOn();
  protected readonly isExport = computed(() => (this.sale() as { type?: string } | null)?.type === 'EXPORT' && this.on('EXPORT'));
  protected readonly canExport = computed(() => this.isExport() || (this.on('EXPORT') && !!this.sale() && this.sale()!.status !== 'CANCELLED'));
  protected readonly lineColumns = computed<WsColumn[]>(() => [
    { key: 'description', label: this.i18n.t('ws.sale.item') },
    { key: 'unit', label: this.i18n.t('ws.sale.unit') },
    { key: 'quantity', label: this.i18n.t('ws.sale.quantity'), format: 'number' },
    { key: 'unitPrice', label: this.i18n.t('ws.sale.unitPrice'), format: 'money' },
    { key: 'lineTotal', label: this.i18n.t('ws.col.total'), format: 'money', total: true },
    ...(this.canSeeCost()
      ? [
          { key: 'lineCost', label: this.i18n.t('ws.col.cost'), format: 'money' as const, total: true, round: true },
          { key: 'profit', label: this.i18n.t('ws.col.profit'), format: 'money' as const, total: true, round: true, tone: 'sign' as const },
        ]
      : []),
  ]);
  protected readonly lineRows = computed<WsRow[]>(() =>
    (this.sale()?.lines ?? []).map((l) => ({ ...l, unit: this.i18n.t(UNIT_KEYS[l.unit] ?? '') || l.unit }) as unknown as WsRow),
  );
  /** Every payment that paid this bill: made with it, or a khata payment that cleared it (oldest bills first). */
  protected readonly paymentColumns = computed<WsColumn[]>(() => [
    { key: 'receivedAt', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'how', label: this.i18n.t('ws.sp2.how') },
    { key: 'method', label: this.i18n.t('ws.sale.method') },
    { key: 'reference', label: this.i18n.t('ws.sale.reference') },
    { key: 'payment', label: this.i18n.t('ws.sp2.payment'), format: 'money' },
    { key: 'applied', label: this.i18n.t('ws.sp2.applied'), format: 'money', total: true },
  ]);
  protected readonly paymentRows = computed<WsRow[]>(() =>
    (this.sale()?.paidBy ?? []).map((p, i) => ({
      id: `${p.id}-${i}`, receivedAt: p.receivedAt, method: this.i18n.t(`method.${p.method}`), reference: p.reference ?? null,
      how: this.i18n.t(p.withSale ? 'ws.sp2.withSale' : 'ws.sp2.onAccount'), payment: p.amount, applied: p.applied,
    }) as unknown as WsRow),
  );

  constructor() {
    // A smart button that opens ?tab=payments wins over the tab picked earlier.
    effect(() => {
      this.tabParam();
      untracked(() => this.chosenTab.set(null));
    });
    const request = computed(() => ({ id: this.id(), n: this.reloads() }));
    toObservable(request)
      .pipe(
        switchMap(({ id }) => this.sales.getById(id).pipe(map((s) => ({ ok: true as const, s })), catchError(() => of({ ok: false as const })))),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.failed.set(!x.ok);
        if (x.ok) this.sale.set(x.s);
      });
  }

  protected reload(): void {
    this.reloads.set(this.reloads() + 1);
  }

  protected share(): void {
    const s = this.sale();
    if (!s) return;
    this.khata.billMessage(s.id, this.i18n.lang()).subscribe({
      next: (m) => window.open(m.url, '_blank', 'noopener'),
      error: () => this.toast.show(this.i18n.t('common.couldNotLoad')),
    });
  }

  private readonly printDocs = inject(PrintDocsService);
  protected readonly printJob = signal<PrintJob | null>(null);

  /** The thermal bill (Bluetooth printer, print dialog or picture), v2 6.3. */
  protected printThermal(saleId: string): void {
    this.printDocs.bill(saleId).subscribe({ next: (job) => this.printJob.set(job), error: () => this.toast.show(this.i18n.t('common.couldNotLoad')) });
  }

  /** Whole rupees for totals (unit prices keep paisa). */
  protected round(v: string | number | null | undefined): number {
    return Math.round(Number(v ?? 0));
  }

  protected readonly methods = ['CASH', 'JAZZCASH', 'EASYPAISA', 'RAAST', 'BANK', 'OTHER'];
  protected readonly receiving = signal(false);
  protected readonly busy = signal(false);
  protected payAmount: number | null = null;
  protected payMethod = 'CASH';
  protected payRef = '';

  protected openReceive(): void {
    this.payAmount = this.round(this.sale()?.due);
    this.payMethod = 'CASH';
    this.payRef = '';
    this.receiving.set(true);
  }

  /** Payment for this bill: recorded with the sale, so it pays this bill first (the rest goes to older debt). */
  protected receive(): void {
    const s = this.sale();
    if (!s || !this.payAmount) return;
    this.busy.set(true);
    this.khata.recordPayment({ customerId: s.customerId, saleId: s.id, amount: Number(this.payAmount), method: this.payMethod as never, ...(this.payRef.trim() ? { reference: this.payRef.trim() } : {}) }).subscribe({
      next: () => {
        this.busy.set(false);
        this.receiving.set(false);
        this.toast.show(this.i18n.t('ws.customer.receiptSaved'));
        this.reload();
      },
      error: (e: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.toast.show(e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }
}
