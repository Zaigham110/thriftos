import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProcurementService } from '../../procurement.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppErrorStateComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppStackComponent,
  AppBadgeComponent,
  type DataTableColumn,
  type DataTableState,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './purchase-order-list.html',
  styleUrl: './purchase-order-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderListComponent implements OnInit {
  private procurementService = inject(ProcurementService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly purchaseOrders = this.procurementService.purchaseOrders;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;
  readonly totalCount = this.procurementService.poTotalCount;
  readonly currentPage = this.procurementService.poCurrentPage;
  readonly totalPages = this.procurementService.poTotalPages;
  readonly canCreate = signal(false);

  readonly tableColumns: DataTableColumn[] = [
    { key: 'poNumber', label: 'PO Number', sortable: true, filterable: true },
    { key: 'poType', label: 'Type', sortable: true, filterable: true },
    {
      key: 'vendor',
      label: 'Vendor',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as PurchaseOrder).vendor?.name ?? '',
    },
    {
      key: 'totalCost',
      label: 'Total Cost',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as PurchaseOrder).totalCost,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: '', label: 'All' },
        { value: 'OPEN', label: 'OPEN' },
        { value: 'RECEIVED', label: 'RECEIVED' },
        { value: 'CLOSED', label: 'CLOSED' },
      ],
    },
    { key: 'createdAt', label: 'Created', sortable: true },
  ];

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Procurement', route: '/procurement/dashboard' },
    { label: 'Purchase Orders', route: '/procurement/pos' },
  ];

  ngOnInit(): void {
    this.checkPermissions();
    this.loadPurchaseOrders();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    this.canCreate.set(
      permissions.includes('po.create') || this.authService.isSuperAdmin()
    );
  }

  loadPurchaseOrders(page = 1): void {
    this.procurementService.loadPurchaseOrders({ page, limit: 20 }).subscribe();
  }

  onTableStateChange(state: DataTableState): void {
    const status = (state.filters['status'] || '').trim();
    this.procurementService
      .loadPurchaseOrders({
        page: state.pageIndex,
        limit: state.pageSize,
        status: status ? (status as PurchaseOrderStatus) : undefined,
      })
      .subscribe();
  }

  refresh(): void {
    this.loadPurchaseOrders(this.currentPage());
  }

  onRowClick(po: PurchaseOrder): void {
    this.router.navigate(['/procurement/pos', po.id]);
  }

  onPageChange(page: number): void {
    this.loadPurchaseOrders(page);
  }

  getStatusVariant(status: PurchaseOrderStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<PurchaseOrderStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      OPEN: 'primary',
      RECEIVED: 'warning',
      CLOSED: 'default',
    };
    return variants[status] || 'default';
  }

  getPoTypeLabel(type: string): string {
    return type === 'CONTAINER' ? 'Container' : type === 'HYBRID' ? 'Mixed' : 'Loose Bale';
  }
}
