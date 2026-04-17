import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  type DataTableColumn,
  type DataTableState,
  AppDialogComponent,
} from '../../../shared/ui';
import { MoneyPipe } from '../../../core/money/money.pipe';

import { SalesService } from '../sales.service';
import type { SaleListItem, SaleStatus } from '../sales.models';

type SalesTab = 'DRAFTS' | 'ISSUED' | 'PAID';

@Component({
  selector: 'app-sales-index',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
    MoneyPipe,
  ],
  templateUrl: './sales-index.page.html',
  styleUrl: './sales-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesIndexPage implements OnInit {
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesService);

  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly sales = signal<SaleListItem[]>([]);

  readonly activeTab = signal<SalesTab>('DRAFTS');

  // Cancel confirmation
  readonly confirmCancelOpen = signal<boolean>(false);
  readonly cancelling = signal<boolean>(false);
  readonly saleToCancel = signal<SaleListItem | null>(null);

  readonly visibleSales = computed(() => {
    const tab = this.activeTab();
    const rows = this.sales();

    if (tab === 'DRAFTS') return rows.filter((s) => s.status === 'DRAFT');
    if (tab === 'PAID') return rows.filter((s) => s.status === 'PAID');

    // ISSUED tab (includes issued + partially paid + cancelled)
    return rows.filter((s) => s.status !== 'DRAFT' && s.status !== 'PAID');
  });

  readonly tableColumns: DataTableColumn[] = [
    { key: 'saleNumber', label: 'Sale #', sortable: true, width: '130px' },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      width: '170px',
      getValue: (row: any) => new Date((row as SaleListItem).createdAt).toISOString(),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true,
      width: '220px',
      getValue: (row: any) => (row as SaleListItem).customer?.name ?? '—',
    },
    { key: 'type', label: 'Type', sortable: true, width: '120px' },
    { key: 'status', label: 'Status', sortable: true, width: '140px' },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      align: 'right',
      width: '140px',
      getValue: (row: any) => (row as SaleListItem).totalAmount,
    },
    {
      key: 'paid',
      label: 'Paid',
      sortable: true,
      align: 'right',
      width: '140px',
      getValue: (row: any) => this.paidAmountForRow(row as SaleListItem),
    },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      align: 'right',
      width: '140px',
      getValue: (row: any) => this.balanceAmountForRow(row as SaleListItem),
    },
  ];

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales(): void {
    this.loading.set(true);
    this.error.set(null);

    this.salesService.list().subscribe({
      next: (rows) => {
        this.sales.set(rows ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load sales');
        this.loading.set(false);
      },
    });
  }

  onTableStateChange(_state: DataTableState): void {
    // Server-side pagination isn’t implemented for sales yet; keep table in client mode.
  }

  selectTab(tab: SalesTab): void {
    this.activeTab.set(tab);
  }

  onRowClick(row: SaleListItem): void {
    this.router.navigate(['/app/sales', row.id]);
  }

  openCancel(row: SaleListItem): void {
    if (row.status !== 'DRAFT') return;
    this.saleToCancel.set(row);
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
        this.error.set(err?.message ?? 'Failed to cancel sale');
        this.confirmCancelOpen.set(false);
        this.saleToCancel.set(null);
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

  paidAmountForRow(sale: SaleListItem): number {
    const payments = sale.payments ?? [];
    return payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }

  balanceAmountForRow(sale: SaleListItem): number {
    return Number(sale.totalAmount ?? 0) - this.paidAmountForRow(sale);
  }
}
