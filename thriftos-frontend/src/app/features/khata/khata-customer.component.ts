import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, Camera, LucideAngularModule, MessageCircle, Pencil } from 'lucide-angular';
import { switchMap } from 'rxjs';

import { TenantService } from '../../core/tenant/tenant.service';
import { CustomersService } from '../../modules/sales/customers.service';
import { KhataService, Language, Ledger } from '../../modules/sales/khata.service';
import { PaymentMethod } from '../../modules/sales/sales.models';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank' },
  { value: 'RAAST', label: 'Raast' },
  { value: 'JAZZCASH', label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
];

/** Journey 6: one customer's khata. Payment received (amount, method, optional screenshot) and WhatsApp reminder. */
@Component({
  selector: 'app-khata-customer',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <section class="customer">
      <header>
        <a routerLink="/khata" aria-label="Back"><lucide-icon [img]="icons.ArrowLeft" [size]="20" /></a>
        <h1>{{ ledger()?.customer?.name }}</h1>
        <button type="button" class="icon" aria-label="Edit customer" (click)="startEdit()"><lucide-icon [img]="icons.Pencil" [size]="18" /></button>
      </header>
      @if (message(); as text) { <p class="notice" [class.error]="error()">{{ text }}</p> }

      @if (ledger(); as l) {
        <section class="balance card">
          <small>{{ +l.balance >= 0 ? 'Owes you' : 'Paid in advance' }}</small>
          <strong [class.owed]="+l.balance > 0">Rs {{ abs(l.balance) | number: '1.0-2' }}</strong>
          @if (l.overdueDays > 0) { <small>Oldest unpaid: {{ l.overdueDays }} days</small> }
          <div class="actions">
            <button type="button" class="primary" (click)="paying.set(!paying())">Payment received</button>
            <button type="button" class="secondary" [disabled]="+l.balance <= 0" (click)="remind()"><lucide-icon [img]="icons.MessageCircle" [size]="18" /> Remind</button>
          </div>
          <div class="lang"><button type="button" [class.on]="lang() === 'ur'" (click)="lang.set('ur')">اردو</button><button type="button" [class.on]="lang() === 'en'" (click)="lang.set('en')">English</button></div>
        </section>

        @if (editing()) {
          <form class="card" (ngSubmit)="saveEdit()">
            <label>Name<input name="name" [(ngModel)]="editName" required /></label>
            <label>WhatsApp number<input name="phone" type="tel" inputmode="tel" [(ngModel)]="editPhone" /></label>
            <label>City<input name="city" [(ngModel)]="editCity" /></label>
            <label>Opening balance (old udhaar, Rs)<input name="opening" type="number" inputmode="decimal" [(ngModel)]="editOpening" /></label>
            <button type="submit" class="primary" [disabled]="!editName.trim() || saving()">Save</button>
          </form>
        }

        @if (paying()) {
          <form class="card" (ngSubmit)="pay()">
            <label>Amount (Rs)<input name="amount" type="number" inputmode="decimal" min="0" [(ngModel)]="amount" required /></label>
            <div class="tiles">@for (m of methods; track m.value) { <button type="button" [class.on]="method() === m.value" (click)="method.set(m.value)">{{ m.label }}</button> }</div>
            <label class="photo"><lucide-icon [img]="icons.Camera" [size]="18" /> {{ photo ? photo.name : 'Add screenshot (optional)' }}<input type="file" accept="image/*,application/pdf" (change)="pickPhoto($event)" hidden /></label>
            <button type="submit" class="primary" [disabled]="!(amount && amount > 0) || saving()">{{ saving() ? 'Saving…' : 'Save payment' }}</button>
          </form>
        }

        <section class="card">
          <h2>Ledger</h2>
          <table>
            <tbody>
              @for (line of l.lines.slice().reverse(); track $index) {
                <tr>
                  <td><strong>{{ label(line.kind) }}</strong><small>{{ line.at | date: 'd MMM y' }} · {{ line.ref || '' }}@if (line.status && +line.due! > 0) { · due Rs {{ +line.due! | number: '1.0-0' }} }</small></td>
                  <td class="num" [class.debit]="+line.debit > 0">{{ +line.debit > 0 ? '+' + (+line.debit | number: '1.0-2') : '−' + (+line.credit | number: '1.0-2') }}</td>
                  <td class="num">{{ +line.balance | number: '1.0-2' }}</td>
                </tr>
              } @empty { <tr><td colspan="3" class="empty">Nothing yet.</td></tr> }
            </tbody>
          </table>
        </section>
      }
    </section>
  `,
  styles: [`
    .customer { display:grid; gap:14px; max-width:640px; margin:0 auto; }
    header { display:flex; align-items:center; gap:8px; }
    header a, .icon { width:48px; height:48px; display:grid; place-items:center; border:0; background:none; color:var(--flow-ink); }
    h1 { flex:1; margin:0; font-size:22px; }
    h2 { margin:0; font-size:17px; }
    .card { display:grid; gap:12px; padding:16px; border:1px solid var(--flow-line); border-radius:var(--flow-radius); background:#fff; }
    .balance { justify-items:center; text-align:center; }
    .balance > strong { font-size:32px; }
    .owed { color:var(--flow-clay); }
    small { display:block; color:var(--flow-ink-soft); font-size:13px; }
    .actions { width:100%; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .lang { display:flex; gap:6px; }
    .lang button { min-height:36px; padding:0 12px; border:1px solid var(--flow-line); border-radius:18px; background:#fff; font:inherit; font-size:13px; }
    .lang .on { border-color:var(--flow-teal); color:var(--flow-teal); font-weight:700; }
    label { display:grid; gap:6px; font-size:14px; font-weight:700; }
    input { min-height:48px; box-sizing:border-box; padding:0 12px; border:1px solid var(--flow-line); border-radius:10px; font:inherit; font-size:18px; }
    .photo { min-height:48px; display:flex; align-items:center; gap:8px; color:var(--flow-teal); cursor:pointer; }
    .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(90px,1fr)); gap:8px; }
    .tiles button { min-height:48px; border:1px solid var(--flow-line); border-radius:12px; background:#fff; font:inherit; font-weight:700; }
    .tiles .on { border:2px solid var(--flow-teal); background:var(--flow-teal-soft); color:var(--flow-teal); }
    .primary, .secondary { min-height:52px; display:flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; font:inherit; font-size:16px; font-weight:800; }
    .primary { border:0; background:var(--flow-teal); color:#fff; }
    .secondary { border:1px solid var(--flow-line); background:#fff; color:var(--flow-ink); }
    .primary:disabled, .secondary:disabled { opacity:.5; }
    table { width:100%; border-collapse:collapse; }
    td { padding:10px 0; border-top:1px solid var(--flow-line); vertical-align:top; }
    .num { text-align:right; white-space:nowrap; padding-left:10px; font-variant-numeric:tabular-nums; }
    .debit { color:var(--flow-clay); }
    .empty { text-align:center; color:var(--flow-ink-soft); }
    .notice { margin:0; padding:12px; border-radius:10px; background:var(--flow-teal-soft); color:var(--flow-teal); }
    .notice.error { background:var(--flow-clay-soft); color:var(--flow-clay); }
  `],
})
export class KhataCustomerComponent implements OnInit {
  /** Route parameter. */
  readonly id = input.required<string>();
  private readonly khata = inject(KhataService);
  private readonly customers = inject(CustomersService);
  protected readonly icons = { ArrowLeft, Camera, MessageCircle, Pencil };
  protected readonly methods = METHODS;
  protected readonly ledger = signal<Ledger | null>(null);
  protected readonly paying = signal(false);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly method = signal<PaymentMethod>('CASH');
  protected readonly lang = signal<Language>(inject(TenantService).tenant()?.defaultLanguage ?? 'ur');
  protected readonly message = signal('');
  protected readonly error = signal(false);
  protected amount: number | null = null;
  protected photo: File | null = null;
  protected editName = '';
  protected editPhone = '';
  protected editCity = '';
  protected editOpening: number | null = null;
  /** Kept until the payment is saved, so a retry records it once. */
  private paymentKey = crypto.randomUUID();

  ngOnInit(): void {
    this.load();
  }

  protected abs(value: string): number {
    return Math.abs(Number(value));
  }

  protected label(kind: string): string {
    return { OPENING: 'Opening balance', SALE: 'Sale', PAYMENT: 'Payment' }[kind] ?? kind;
  }

  protected pickPhoto(event: Event): void {
    this.photo = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected pay(): void {
    if (!this.amount || this.amount <= 0) return;
    this.saving.set(true);
    const amount = this.amount;
    const photo = this.photo;
    this.khata.recordPayment({ customerId: this.id(), amount, method: this.method() }, this.paymentKey).subscribe({
      next: (result) => {
        this.paymentKey = crypto.randomUUID();
        if (photo) this.khata.addPhoto(result.payment.id, photo).subscribe({ error: () => this.show('Payment saved, but the screenshot did not upload.', true) });
        this.saving.set(false);
        this.paying.set(false);
        this.amount = null;
        this.photo = null;
        this.show(`Rs ${amount.toLocaleString()} received. Balance now Rs ${Number(result.balance).toLocaleString()}.`);
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  protected remind(): void {
    this.khata.openWhatsapp(this.khata.reminder(this.id(), this.lang()), (e) => this.fail(e));
  }

  protected startEdit(): void {
    const c = this.ledger()?.customer;
    if (!c) return;
    this.editName = c.name;
    this.editPhone = c.phone || '';
    this.editCity = c.city || '';
    this.editOpening = Number(c.openingBalance);
    this.editing.set(!this.editing());
  }

  protected saveEdit(): void {
    this.saving.set(true);
    this.customers
      .update(this.id(), { name: this.editName.trim(), phone: this.editPhone.trim(), city: this.editCity.trim(), openingBalance: this.editOpening ?? 0 })
      .pipe(switchMap(() => this.khata.ledger(this.id())))
      .subscribe({
        next: (ledger) => {
          this.saving.set(false);
          this.editing.set(false);
          this.ledger.set(ledger);
        },
        error: (e) => this.fail(e),
      });
  }

  private load(): void {
    this.khata.ledger(this.id()).subscribe({ next: (l) => this.ledger.set(l), error: (e) => this.fail(e) });
  }

  private show(text: string, isError = false): void {
    this.error.set(isError);
    this.message.set(text);
  }

  private fail(e: any): void {
    this.saving.set(false);
    this.show(e?.error?.message || 'Something went wrong. Please try again.', true);
  }
}
