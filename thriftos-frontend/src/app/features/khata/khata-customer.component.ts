import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Camera, CheckCircle2, LucideAngularModule, MessageCircle, Pencil, Printer } from 'lucide-angular';
import { PrintDocsService, PrintJob } from '../../core/print/print-docs.service';
import { PrintSheetComponent } from '../../shared/print/print-sheet.component';
import { switchMap } from 'rxjs';

import { I18nService, Lang } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { CustomersService } from '../../modules/sales/customers.service';
import { KhataService, Ledger } from '../../modules/sales/khata.service';
import { PaymentMethod } from '../../modules/sales/sales.models';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { ToastService } from '../../shared/floor/toast.service';
import { METHODS } from '../sell/sale.component';

/**
 * Journey 6: one customer's khata. "Payment received" (amount, method tiles, optional screenshot) works offline;
 * "Remind" opens WhatsApp with the balance in Urdu or English.
 */
@Component({
  selector: 'app-khata-customer',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, LucideAngularModule, I18N, NumberFieldComponent, PrintSheetComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/khata" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ ledger()?.customer?.name }}<span class="sub ltr">{{ ledger()?.customer?.phone || '' }}</span></h1>
        <button type="button" class="icon-btn" [attr.aria-label]="'common.edit' | t" (click)="startEdit()"><lucide-icon [img]="icons.Pencil" [size]="20" /></button>
      </header>

      @if (ledger(); as l) {
        <section class="card balance">
          <small>{{ (+l.balance >= 0 ? 'khata.owes' : 'khata.advance') | t }}</small>
          <strong class="big-number" [class.warn]="+l.balance > 0">{{ abs(l.balance) | rs }}</strong>
          @if (l.overdueDays > 0) { <small [class.warn]="l.overdueDays > 30">{{ 'khata.oldest' | t: { n: l.overdueDays } }}</small> }
          <div class="row2 actions">
            <button type="button" class="btn" [disabled]="+l.balance <= 0" (click)="remind()"><lucide-icon [img]="icons.MessageCircle" [size]="18" /> {{ 'khata.remind' | t }}</button>
            <div class="chips lang" role="group" [attr.aria-label]="'khata.reminderLang' | t">
              <button type="button" class="chip" [class.on]="remindLang() === 'ur'" (click)="remindLang.set('ur')">اردو</button>
              <button type="button" class="chip" [class.on]="remindLang() === 'en'" (click)="remindLang.set('en')">English</button>
            </div>
          </div>
        </section>

        @if (editing()) {
          <form class="card" (ngSubmit)="saveEdit()">
            <label class="field">{{ 'common.name' | t }}<input name="name" [(ngModel)]="editName" /></label>
            <label class="field">{{ 'common.phone' | t }}<input name="phone" type="tel" inputmode="tel" [(ngModel)]="editPhone" /></label>
            <label class="field">{{ 'common.city' | t }}<input name="city" [(ngModel)]="editCity" /></label>
            <tos-number label="khata.oldUdhaar" unit="Rs" [optional]="true" [(value)]="editOpening" />
            <button type="submit" class="btn primary" [disabled]="!editName.trim() || !editPhone.trim() || saving()">{{ 'common.save' | t }}</button>
          </form>
        }

        @if (lastPaymentId(); as pid) {
          <section class="card paid">
            <span><lucide-icon [img]="icons.CheckCircle2" [size]="20" class="good" /> {{ 'print.paymentSaved' | t }}</span>
            <button type="button" class="btn" (click)="printReceipt(pid)"><lucide-icon [img]="icons.Printer" [size]="18" /> {{ 'print.printReceipt' | t }}</button>
          </section>
        }

        @if (paying()) {
          <section class="card">
            <h2>{{ 'khata.paymentReceived' | t }}</h2>
            <tos-number label="khata.amount" unit="Rs" [(value)]="amount" />
            <div class="chips">@for (m of methods; track m) { <button type="button" class="chip" [class.on]="method() === m" (click)="method.set(m)">{{ 'method.' + m | t }}</button> }</div>
            <label class="photo"><lucide-icon [img]="icons.Camera" [size]="20" /> {{ photo ? photo.name : ('khata.screenshot' | t) }}<input type="file" accept="image/*,application/pdf" (change)="pickPhoto($event)" hidden /></label>
          </section>
        }

        <section class="card">
          <h2>{{ 'khata.ledger' | t }}</h2>
          <ul class="list">
            @for (line of l.lines.slice().reverse(); track $index) {
              <li class="row">
                <span><strong>{{ 'khata.kind.' + line.kind | t }}</strong><small><span class="ltr">{{ line.at | date: 'd MMM y' : undefined : 'en' }}</span> · <span class="ltr">{{ line.ref || '' }}</span>@if (line.status && +line.due! > 0) { · {{ 'bill.due' | t }} {{ line.due | rs }} }</small></span>
                <span class="amount"><span [class.warn]="+line.debit > 0">{{ +line.debit > 0 ? '+' : '−' }}{{ (+line.debit > 0 ? line.debit : line.credit) | num }}</span><small>{{ 'khata.balanceCol' | t }} {{ line.balance | num }}</small></span>
              </li>
            } @empty { <li class="empty">{{ 'common.empty' | t }}</li> }
          </ul>
        </section>

        <footer class="action-bar">
          @if (paying()) {
            <button type="button" class="btn primary" [disabled]="!amount() || saving()" (click)="pay()">{{ (saving() ? 'common.saving' : 'khata.savePayment') | t }}</button>
          } @else {
            <button type="button" class="btn primary" (click)="paying.set(true)">{{ 'khata.paymentReceived' | t }}</button>
          }
        </footer>
      }
    </section>
    @if (printJob(); as job) { <app-print-sheet [tickets]="job.tickets" [kind]="job.kind" [title]="job.title" (closed)="printJob.set(null)" /> }
  `,
  styles: [`
    .balance { justify-items:center; text-align:center; }
    .balance small { color:var(--tos-ink-soft); font-weight:600; }
    .actions { width:100%; align-items:center; }
    .lang { justify-content:center; }
    .photo { min-height:48px; display:flex; align-items:center; gap:8px; color:var(--tos-primary); font-weight:700; cursor:pointer; }
    .amount small { display:block; font-weight:600; }
    .paid { grid-template-columns:1fr auto; align-items:center; }
    .paid span { display:flex; align-items:center; gap:8px; font-weight:700; }
    .paid .good { color:var(--tos-good, #2f7d5b); }
  `],
})
export class KhataCustomerComponent implements OnInit {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly khata = inject(KhataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { ArrowLeft, Camera, CheckCircle2, MessageCircle, Pencil, Printer };
  private readonly printDocs = inject(PrintDocsService);
  protected readonly printJob = signal<PrintJob | null>(null);
  /** The payment just saved, so its receipt can be printed. */
  protected readonly lastPaymentId = signal<string | null>(null);
  protected readonly methods = METHODS;
  protected readonly ledger = signal<Ledger | null>(null);
  protected readonly paying = signal(false);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly method = signal<PaymentMethod>('CASH');
  protected readonly amount = signal<number | null>(null);
  protected readonly remindLang = signal<Lang>(this.i18n.lang());
  protected readonly editOpening = signal<number | null>(null);
  protected photo: File | null = null;
  protected editName = '';
  protected editPhone = '';
  protected editCity = '';
  /** Kept until the payment is saved, so a retry records it once. */
  private paymentKey = crypto.randomUUID();

  ngOnInit(): void {
    this.load();
  }

  protected abs(value: string): number {
    return Math.abs(Number(value));
  }

  protected pickPhoto(event: Event): void {
    this.photo = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected async pay(): Promise<void> {
    const amount = this.amount();
    if (!amount) return;
    this.saving.set(true);
    const photo = this.photo;
    try {
      const r = await this.queue.send<{ payment: { id: string }; balance: string }>({
        kind: 'payment',
        label: `${this.ledger()?.customer?.name ?? ''} · ${this.i18n.money(amount)}`,
        url: '/api/khata/payments',
        id: this.paymentKey,
        body: { customerId: this.id(), amount, method: this.method() },
      });
      this.paymentKey = crypto.randomUUID();
      this.paying.set(false);
      this.amount.set(null);
      this.photo = null;
      if (!r.saved) {
        this.toast.show(this.i18n.t('khata.receivedOffline', { rs: this.i18n.money(amount) }));
        return;
      }
      this.lastPaymentId.set(r.response.payment.id);
      if (photo) this.khata.addPhoto(r.response.payment.id, photo).subscribe({ error: () => this.toast.error(this.i18n.t('khata.photoFailed')) });
      this.toast.show(this.i18n.t('khata.received', { rs: this.i18n.money(amount), balance: this.i18n.money(r.response.balance) }));
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }

  protected printReceipt(paymentId: string): void {
    this.printDocs.receipt(paymentId).subscribe({ next: (job) => this.printJob.set(job), error: () => this.toast.error(this.i18n.t('common.couldNotLoad')) });
  }

  protected remind(): void {
    this.khata.openWhatsapp(this.khata.reminder(this.id(), this.remindLang()), (e: any) => this.toast.error(e?.error?.message || this.i18n.t('common.couldNotLoad')));
  }

  protected startEdit(): void {
    const c = this.ledger()?.customer;
    if (!c) return;
    this.editName = c.name;
    this.editPhone = c.phone || '';
    this.editCity = c.city || '';
    this.editOpening.set(Number(c.openingBalance) || null);
    this.editing.set(!this.editing());
  }

  protected saveEdit(): void {
    this.saving.set(true);
    this.customers
      .update(this.id(), { name: this.editName.trim(), phone: this.editPhone.trim(), city: this.editCity.trim(), openingBalance: this.editOpening() ?? 0 })
      .pipe(switchMap(() => this.khata.ledger(this.id())))
      .subscribe({
        next: (ledger) => {
          this.saving.set(false);
          this.editing.set(false);
          this.ledger.set(ledger);
          this.toast.show(this.i18n.t('khata.editSaved'));
        },
        error: (e) => {
          this.saving.set(false);
          this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
        },
      });
  }

  private load(): void {
    this.khata.ledger(this.id()).subscribe({ next: (l) => this.ledger.set(l), error: () => this.toast.error(this.i18n.t('common.couldNotLoad')) });
  }
}
