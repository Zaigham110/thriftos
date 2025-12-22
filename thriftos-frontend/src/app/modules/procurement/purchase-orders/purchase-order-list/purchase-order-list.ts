/**
 * Purchase Order List Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/purchase-orders
 */

import { ChangeDetectionStrategy, Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseOrderFilters,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  BadgeComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  EmptyStateComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    BadgeComponent,
    SelectComponent,
    SkeletonComponent,
    EmptyStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './purchase-order-list.html',
  styleUrl: './purchase-order-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderListComponent implements OnInit {
  private procurementService = inject(ProcurementService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly icons = {
    Plus,
    ChevronLeft,
    ChevronRight,
    FileText,
  };

  readonly purchaseOrders = this.procurementService.purchaseOrders;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;
  readonly totalCount = this.procurementService.poTotalCount;
  readonly currentPage = this.procurementService.poCurrentPage;
  readonly totalPages = this.procurementService.poTotalPages;

  readonly statusFilter = signal<PurchaseOrderStatus | ''>('');
  readonly canCreate = signal(false);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Purchase Orders' },
  ];

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'RECEIVED', label: 'Received' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  ngOnInit(): void {
    this.checkPermissions();
    this.loadFromQueryParams();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    this.canCreate.set(
      permissions.includes('po.create') || this.authService.isSuperAdmin()
    );
  }

  private loadFromQueryParams(): void {
    const status = this.route.snapshot.queryParamMap.get('status') as PurchaseOrderStatus | null;
    if (status) {
      this.statusFilter.set(status);
    }
    this.loadPurchaseOrders();
  }

  loadPurchaseOrders(page = 1): void {
    const filters: PurchaseOrderFilters = {
      page,
      limit: 20,
    };

    if (this.statusFilter()) {
      filters.status = this.statusFilter() as PurchaseOrderStatus;
    }

    this.procurementService.loadPurchaseOrders(filters).subscribe();
  }

  onStatusFilterChange(status: string | number): void {
    this.statusFilter.set(status as PurchaseOrderStatus | '');
    this.loadPurchaseOrders(1);
  }

  onRowClick(po: PurchaseOrder): void {
    this.router.navigate(['/app/procurement/purchase-orders', po.id]);
  }

  onPageChange(page: number): void {
    this.loadPurchaseOrders(page);
  }

  getStatusVariant(status: PurchaseOrderStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<PurchaseOrderStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      OPEN: 'primary',
      RECEIVED: 'warning',
      CLOSED: 'success',
    };
    return variants[status] || 'default';
  }

  getPoTypeLabel(type: string): string {
    return type === 'CONTAINER' ? 'Container' : type === 'HYBRID' ? 'Mixed' : 'Loose Bale';
  }
}
