/**
 * Sale Invoice Component
 * Phase 2: Sales Module UI
 * 
 * Commercial customer invoice and payment recording view.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  MessageCircle,
  Printer,
  ArrowLeft,
  DollarSign,
  CreditCard,
  UserCheck,
  CheckCircle2,
  FileText,
  Plus,
} from 'lucide-angular';

import { switchMap } from 'rxjs';
import { KhataService } from '../khata.service';
import { SalesService } from '../sales.service';
import type { PaymentMethod, SaleDetail, SaleStatus } from '../sales.models';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

@Component({
  selector: 'app-sale-invoice',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './sale-invoice.page.html',
  styleUrl: './sale-invoice.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleInvoicePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesService);
  private readonly khata = inject(KhataService);

  readonly icons = {
    MessageCircle,
    Printer,
    ArrowLeft,
    DollarSign,
    CreditCard,
    UserCheck,
    CheckCircle2,
    FileText,
    Plus,
  };

  readonly saleId = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly sale = signal<SaleDetail | null>(null);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const s = this.sale();
    const code = s ? (s.saleNumber || `SO-${String(s.id).slice(0, 8).toUpperCase()}`) : 'Invoice';
    return [
      { label: 'Sales', route: '/sell/records' },
      { label: 'Orders', route: '/sell/records' },
      { label: code, route: s ? `/sell/records/${s.id}` : undefined },
      { label: 'Commercial Invoice' },
    ];
  });

  readonly payments = computed(() => this.sale()?.payments || []);

  // Payment form
  readonly paymentAmount = new FormControl<string>('0', { nonNullable: true });
  readonly paymentMethod = new FormControl<string>('CASH', { nonNullable: true });

  readonly paidAmount = computed(() => {
    const s = this.sale();
    const payments = s?.payments || [];
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  });

  readonly balanceAmount = computed(() => {
    const s = this.sale();
    return Number(s?.totalAmount || 0) - this.paidAmount();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/sell/records']);
      return;
    }
    this.saleId.set(id);
    this.loadSale();
  }

  loadSale(): void {
    const id = this.saleId();
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    this.salesService.getById(id).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load invoice');
        this.loading.set(false);
      },
    });
  }

  canAddPayment(): boolean {
    const s = this.sale();
    if (!s) return false;
    return s.status === 'ISSUED' || s.status === 'PARTIALLY_PAID' || s.status === 'PAID';
  }

  addPayment(): void {
    const s = this.sale();
    if (!s || !this.canAddPayment()) return;

    const amount = Number(this.paymentAmount.value || '0');
    const method = String(this.paymentMethod.value || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      this.error.set('Payment amount must be greater than zero');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.khata.recordPayment({ customerId: s.customerId, saleId: s.id, amount, method: method as PaymentMethod }).pipe(switchMap(() => this.salesService.getById(s.id))).subscribe({
      next: (updated) => {
        this.sale.set(updated);
        this.paymentAmount.setValue('0', { emitEvent: false });
        this.paymentMethod.setValue('CASH', { emitEvent: false });
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message || 'Failed to record payment');
      },
    });
  }

  shareWhatsapp(): void {
    const s = this.sale();
    if (!s) return;
    this.khata.openWhatsapp(this.khata.billMessage(s.id), () => this.error.set('Could not open WhatsApp'));
  }

  printInvoice(): void {
    window.print();
  }

  goBack(): void {
    const id = this.saleId();
    if (id) {
      this.router.navigate(['/sell/records', id]);
    } else {
      this.router.navigate(['/sell/records']);
    }
  }

  saleCode(s: SaleDetail | null): string {
    if (!s) return '—';
    return s.saleNumber || `SO-${String(s.id).slice(0, 8).toUpperCase()}`;
  }
}
