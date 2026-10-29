/**
 * Purchase Order List Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/pos
 * 
 * Manages procurement purchase orders, vendor assignments, containers, and loose bale intakes.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ShoppingBag,
  Plus,
  RefreshCw,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Archive,
  Store,
  DollarSign,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { PurchaseOrder, PurchaseOrderStatus } from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { MoneyPipe } from '../../../../core/money/money.pipe';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
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

  readonly searchQuery = signal('');
  readonly statusFilter = signal<string>('ALL');

  readonly breadcrumbs = [
    { label: 'Procurement', route: '/receive/records' },
    { label: 'Purchase Orders' },
  ];

  readonly icons = {
    ShoppingBag,
    Plus,
    RefreshCw,
    Search,
    Eye,
    CheckCircle2,
    Clock,
    Archive,
    Store,
    DollarSign,
  };

  // KPI Calculations
  readonly openPosCount = computed(
    () => this.purchaseOrders().filter((po) => po.status === 'OPEN').length
  );
  readonly receivedPosCount = computed(
    () => this.purchaseOrders().filter((po) => po.status === 'RECEIVED').length
  );
  readonly closedPosCount = computed(
    () => this.purchaseOrders().filter((po) => po.status === 'CLOSED').length
  );

  readonly filteredPurchaseOrders = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();

    return this.purchaseOrders().filter((po) => {
      const matchesQuery =
        !query ||
        po.poNumber.toLowerCase().includes(query) ||
        (po.vendor?.name || '').toLowerCase().includes(query);

      const matchesStatus = status === 'ALL' || po.status === status;

      return matchesQuery && matchesStatus;
    });
  });

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
    const status = this.statusFilter();
    const filterStatus = status === 'ALL' ? undefined : (status as PurchaseOrderStatus);
    this.procurementService.loadPurchaseOrders({ page, limit: 50, status: filterStatus }).subscribe();
  }

  refresh(): void {
    this.loadPurchaseOrders(this.currentPage());
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    const filterStatus = status === 'ALL' ? undefined : (status as PurchaseOrderStatus);
    this.procurementService.loadPurchaseOrders({ page: 1, limit: 50, status: filterStatus }).subscribe();
  }

  navigateToDetail(po: PurchaseOrder): void {
    this.router.navigate(['/receive/records/pos', po.id]);
  }

  getPoTypeLabel(type: string): string {
    return type === 'CONTAINER' ? 'Container' : type === 'HYBRID' ? 'Mixed' : 'Loose Bale';
  }
}
