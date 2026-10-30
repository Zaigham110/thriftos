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
    this.router.navigate(['/sell/new']);
  }

  openOrder(sale: SaleListItem): void {
    this.router.navigate(['/sell/records', sale.id]);
  }

  saleCode(sale: SaleListItem): string {
    if (sale.saleNumber) return sale.saleNumber;
    return `SO-${String(sale.id).slice(0, 8).toUpperCase()}`;
  }
}
