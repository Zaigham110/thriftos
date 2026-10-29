/**
 * Sales Index Component
 * Phase 2: Sales & Wholesale Orders Module UI
 * 
 * High-density directory table and KPI summary cards for Wholesale & Retail Sales.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ShoppingBag,
  Plus,
  RefreshCw,
  Eye,
  XCircle,
  DollarSign,
  TrendingUp,
  CreditCard,
  UserCheck,
  CheckCircle2,
  Clock,
} from 'lucide-angular';

import { SalesService } from '../sales.service';
import type { SaleListItem, SaleStatus } from '../sales.models';
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

type SalesTab = 'ALL' | 'DRAFTS' | 'ISSUED' | 'PAID';

@Component({
  selector: 'app-sales-index',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './sales-index.page.html',
  styleUrl: './sales-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesIndexPage implements OnInit {
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sales', route: '/sell/records' },
    { label: 'Orders Directory' },
  ];

  readonly icons = {
    ShoppingBag,
    Plus,
    RefreshCw,
    Eye,
    XCircle,
    DollarSign,
    TrendingUp,
    CreditCard,
    UserCheck,
    CheckCircle2,
    Clock,
  };

  // State
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly sales = signal<SaleListItem[]>([]);
  readonly activeTab = signal<SalesTab>('ALL');

  // Cancel confirmation modal state
  readonly confirmCancelOpen = signal<boolean>(false);
  readonly cancelling = signal<boolean>(false);
  readonly saleToCancel = signal<SaleListItem | null>(null);

  // Computed KPI Metrics
  readonly totalSalesCount = computed(() => this.sales().length);
  readonly activeDraftsCount = computed(() => this.sales().filter((s) => s.status === 'DRAFT').length);
  readonly totalRevenue = computed(() => {
    return this.sales()
      .filter((s) => s.status !== 'CANCELLED')
      .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  });
  readonly totalProfit = computed(() => {
    return this.sales()
      .filter((s) => s.status !== 'CANCELLED')
      .reduce((sum, s) => sum + Number(s.totalProfit || 0), 0);
  });

  // Filtered rows for current active tab
  readonly visibleSales = computed(() => {
    const tab = this.activeTab();
    const rows = this.sales();

    if (tab === 'DRAFTS') return rows.filter((s) => s.status === 'DRAFT');
    if (tab === 'PAID') return rows.filter((s) => s.status === 'PAID');
    if (tab === 'ISSUED') return rows.filter((s) => s.status === 'ISSUED' || s.status === 'PARTIALLY_PAID');
    return rows;
  });

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales(): void {
    this.loading.set(true);
    this.error.set(null);

    this.salesService.list().subscribe({
      next: (rows) => {
        this.sales.set(rows || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load sales orders');
        this.loading.set(false);
      },
    });
  }

  selectTab(tab: SalesTab): void {
    this.activeTab.set(tab);
  }

  createOrder(): void {
    this.router.navigate(['/sell/records/new']);
  }

  openOrder(sale: SaleListItem): void {
    this.router.navigate(['/sell/records', sale.id]);
  }

  openCancel(sale: SaleListItem, event: Event): void {
    event.stopPropagation();
    if (sale.status !== 'DRAFT') return;
    this.saleToCancel.set(sale);
    this.confirmCancelOpen.set(true);
  }

  closeCancel(): void {
    if (this.cancelling()) return;
    this.confirmCancelOpen.set(false);
    this.saleToCancel.set(null);
  }

  confirmCancel(): void {
    const sale = this.saleToCancel();
    if (!sale) return;

    this.cancelling.set(true);
    this.salesService.cancel(sale.id).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.confirmCancelOpen.set(false);
        this.saleToCancel.set(null);
        this.loadSales();
      },
      error: (err) => {
        this.cancelling.set(false);
        this.error.set(err?.message || 'Failed to cancel sale order');
        this.confirmCancelOpen.set(false);
        this.saleToCancel.set(null);
      },
    });
  }

  paidAmountForRow(sale: SaleListItem): number {
    const payments = sale.payments || [];
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }

  balanceAmountForRow(sale: SaleListItem): number {
    return Number(sale.totalAmount || 0) - this.paidAmountForRow(sale);
  }

  saleCode(sale: SaleListItem): string {
    if (sale.saleNumber) return sale.saleNumber;
    return `SO-${String(sale.id).slice(0, 8).toUpperCase()}`;
  }
}
