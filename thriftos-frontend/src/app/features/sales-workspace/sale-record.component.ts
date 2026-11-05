import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BookOpen, Coins, FileText, LucideAngularModule, MessageCircle, Printer, Receipt, Wallet } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth';
import { I18nService, serverLang } from '../../core/i18n/i18n.service';
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
} from '../../shared/ui/workspace';

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
    PrintSheetComponent,
  ],
  template: `
    @if (failed()) {
      <ws-state kind="error" [heading]="'ws.sale.notFound' | t" (retry)="reload()" />
    } @else if (sale(); as s) {
      <div class="record">
        <div class="main">
          <ws-page-header [heading]="s.saleNumber + ' · ' + (s.customer?.name ?? '')" [subtitle]="subtitle()">
            <button actions type="button" class="ws-btn" (click)="share()"><lucide-icon [img]="icons.MessageCircle" [size]="16" aria-hidden="true" />{{ 'ws.sale.share' | t }}</button>
            <a actions class="ws-btn" [routerLink]="['/bill', s.billToken]"><lucide-icon [img]="icons.FileText" [size]="16" aria-hidden="true" />{{ 'ws.sale.bill' | t }}</a>
            <button actions type="button" class="ws-btn" (click)="print()"><lucide-icon [img]="icons.Printer" [size]="16" aria-hidden="true" />{{ 'ws.sale.print' | t }}</button>
            <button actions type="button" class="ws-btn" (click)="printThermal(s.id)"><lucide-icon [img]="icons.Receipt" [size]="16" aria-hidden="true" />{{ 'print.printBill' | t }}</button>
          </ws-page-header>

          @if (s.status === 'CANCELLED') {
            <p class="badge bad" role="status">{{ 'ws.status.CANCELLED' | t }}</p>
          } @else {
            <ws-status-pipeline [steps]="steps()" [current]="stepIndex()" [label]="'ws.col.status' | t" />
          }

          <section class="smart">
            <ws-smart-button [label]="'ws.col.total' | t" [value]="i18n.money(s.totalAmount)" [icon]="icons.Receipt" [link]="[]" />
            <ws-smart-button [label]="'ws.sale.paid' | t" [value]="i18n.money(s.paid)" [icon]="icons.Wallet" tone="good" [link]="[]" [query]="{ tab: 'payments' }" />
            <ws-smart-button [label]="'ws.sale.due' | t" [value]="i18n.money(s.due)" [icon]="icons.Coins" [tone]="+s.due > 0 ? 'bad' : 'plain'" [link]="[]" [query]="{ tab: 'payments' }" />
            @if (canSeeCost()) { <ws-smart-button [label]="'ws.col.profit' | t" [value]="i18n.money(s.totalProfit ?? 0)" [icon]="icons.Coins" [tone]="+(s.totalProfit ?? 0) >= 0 ? 'good' : 'bad'" [link]="[]" /> }
            <ws-smart-button [label]="'ws.sale.balance' | t" [value]="i18n.money(s.customerBalance)" [icon]="icons.BookOpen" [link]="['/khata', s.customerId]" />
          </section>

          <ws-tabs [tabs]="tabs()" [active]="tab()" (activeChange)="chosenTab.set($event)" [label]="s.saleNumber" />
          <div role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()">
            @if (tab() === 'lines') {
              <ws-data-grid [caption]="'ws.sale.lines' | t" [columns]="lineColumns()" [rows]="lineRows()" />
            } @else {
              <ws-data-grid [caption]="'ws.sale.payments' | t" [columns]="paymentColumns()" [rows]="paymentRows()" [emptyHeading]="'ws.sale.noPayments' | t" />
            }
          </div>
        </div>
        <aside class="side"><ws-record-activity type="sale" [recordId]="s.id" /></aside>
      </div>
    } @else {
      <ws-state kind="loading" />
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
  /** ?tab=payments from a smart button. */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly icons = { BookOpen, Coins, FileText, MessageCircle, Printer, Receipt, Wallet };
  protected readonly sale = signal<SaleDetail | null>(null);
  protected readonly failed = signal(false);
  private readonly reloads = signal(0);
  protected readonly chosenTab = signal<string | null>(null);
  protected readonly tab = computed(() => this.chosenTab() ?? (this.tabParam() === 'payments' ? 'payments' : 'lines'));
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
    { id: 'payments', label: this.i18n.t('ws.sale.payments'), count: this.sale()?.payments.length ?? 0 },
  ]);
  protected readonly lineColumns = computed<WsColumn[]>(() => [
    { key: 'description', label: this.i18n.t('ws.sale.item') },
    { key: 'unit', label: this.i18n.t('ws.sale.unit') },
    { key: 'quantity', label: this.i18n.t('ws.sale.quantity'), format: 'number' },
    { key: 'unitPrice', label: this.i18n.t('ws.sale.unitPrice'), format: 'money' },
    { key: 'lineTotal', label: this.i18n.t('ws.col.total'), format: 'money', total: true },
    ...(this.canSeeCost()
      ? [
          { key: 'lineCost', label: this.i18n.t('ws.col.cost'), format: 'money' as const, total: true },
          { key: 'profit', label: this.i18n.t('ws.col.profit'), format: 'money' as const, total: true },
        ]
      : []),
  ]);
  protected readonly lineRows = computed<WsRow[]>(() =>
    (this.sale()?.lines ?? []).map((l) => ({ ...l, unit: this.i18n.t(UNIT_KEYS[l.unit] ?? '') || l.unit }) as unknown as WsRow),
  );
  protected readonly paymentColumns = computed<WsColumn[]>(() => [
    { key: 'receivedAt', label: this.i18n.t('ws.col.date'), format: 'date' },
    { key: 'method', label: this.i18n.t('ws.sale.method') },
    { key: 'reference', label: this.i18n.t('ws.sale.reference') },
    { key: 'amount', label: this.i18n.t('ws.sale.amount'), format: 'money', total: true },
  ]);
  protected readonly paymentRows = computed<WsRow[]>(() =>
    (this.sale()?.payments ?? []).map((p) => ({ ...p, method: this.i18n.t(`method.${p.method}`) }) as unknown as WsRow),
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
    this.khata.billMessage(s.id, serverLang(this.i18n.lang())).subscribe({
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

  protected print(): void {
    window.print();
  }
}
