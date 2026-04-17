import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
} from '../../../shared/ui';
import { MoneyPipe } from '../../../core/money/money.pipe';

import { SalesService } from '../sales.service';
import type { SaleDetail, SaleStatus } from '../sales.models';

@Component({
  selector: 'app-sale-invoice',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppDialogComponent,
    MoneyPipe,
  ],
  templateUrl: './sale-invoice.page.html',
  styleUrl: './sale-invoice.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleInvoicePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesService);

  readonly saleId = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly sale = signal<SaleDetail | null>(null);

  readonly payments = computed(() => this.sale()?.payments ?? []);

  // Payment form (only allowed when issued)
  readonly paymentAmount = new FormControl<string>('0', { nonNullable: true });
  readonly paymentMethod = new FormControl<string>('cash', { nonNullable: true });

  // Cancel confirmation (DRAFT only — but invoice page should generally be for issued. Still keep safe.)
  readonly confirmCancelOpen = signal<boolean>(false);

  readonly paidAmount = computed(() => {
    const s = this.sale();
    const payments = s?.payments ?? [];
    return payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  });

  readonly balanceAmount = computed(() => {
    const s = this.sale();
    return Number(s?.totalAmount ?? 0) - this.paidAmount();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/app/sales']);
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
        this.error.set(err?.message ?? 'Failed to load invoice');
        this.loading.set(false);
      },
    });
  }

  getStatusVariant(status: SaleStatus): 'default' | 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'ISSUED':
        return 'warning';
      case 'PARTIALLY_PAID':
        return 'warning';
      case 'PAID':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'default';
    }
  }

  canAddPayment(): boolean {
    const s = this.sale();
    if (!s) return false;
    return s.status === 'ISSUED' || s.status === 'PARTIALLY_PAID' || s.status === 'PAID';
  }

  addPayment(): void {
    const s = this.sale();
    if (!s) return;
    if (!this.canAddPayment()) {
      this.error.set('Payments can only be recorded after issuing the invoice');
      return;
    }

    const amount = Number(this.paymentAmount.value ?? '0');
    const method = String(this.paymentMethod.value ?? '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      this.error.set('Payment amount must be > 0');
      return;
    }
    if (!method) {
      this.error.set('Payment method is required');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.salesService.addPayment(s.id, { amount, method }).subscribe({
      next: (updated) => {
        this.sale.set(updated);
        this.paymentAmount.setValue('0', { emitEvent: false });
        this.paymentMethod.setValue('cash', { emitEvent: false });
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message ?? 'Failed to add payment');
      },
    });
  }

  // Safety: allow cancel only if draft (should be hidden/disabled on invoice).
  openCancel(): void {
    const s = this.sale();
    if (!s || s.status !== 'DRAFT') return;
    this.confirmCancelOpen.set(true);
  }

  closeCancel(): void {
    if (this.saving()) return;
    this.confirmCancelOpen.set(false);
  }

  confirmCancel(): void {
    const s = this.sale();
    if (!s) return;
    if (s.status !== 'DRAFT') return;

    this.saving.set(true);
    this.salesService.cancel(s.id).subscribe({
      next: (updated) => {
        this.sale.set(updated);
        this.confirmCancelOpen.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.confirmCancelOpen.set(false);
        this.saving.set(false);
        this.error.set(err?.message ?? 'Failed to cancel sale');
      },
    });
  }
}
