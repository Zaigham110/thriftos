/**
 * Purchase Order Detail Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/pos/:id
 * 
 * Detailed overview of a purchase order and its containers.
 */

import { ChangeDetectionStrategy, Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  ShoppingBag,
  Truck,
  Package,
  Store,
  DollarSign,
  Calendar,
  CheckCircle2,
  Lock,
  Plus,
  Eye,
  Pencil,
  RefreshCw,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { PurchaseOrder, PurchaseOrderStatus, Container } from '../../procurement.models';
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
  AppDialogComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-detail',
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
    AppDialogComponent,
  ],
  templateUrl: './purchase-order-detail.html',
  styleUrl: './purchase-order-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly procurementService = inject(ProcurementService);
  private readonly authService = inject(AuthService);

  readonly purchaseOrder = signal<PurchaseOrder | null>(null);
  readonly containers = signal<Container[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly showConfirmModal = signal(false);
  readonly confirmAction = signal<'receive' | 'close' | null>(null);

  readonly canEdit = signal(false);
  readonly canUpdate = signal(false);

  readonly icons = {
    ArrowLeft,
    ShoppingBag,
    Truck,
    Package,
    Store,
    DollarSign,
    Calendar,
    CheckCircle2,
    Lock,
    Plus,
    Eye,
    Pencil,
    RefreshCw,
  };

  // Visibility rules based on procurement type
  readonly showContainerSection = computed(() => {
    const po = this.purchaseOrder();
    if (!po) return false;
    return po.poType === 'CONTAINER' || po.poType === 'HYBRID';
  });

  readonly breadcrumbs = computed(() => {
    const poNumber = this.purchaseOrder()?.poNumber || 'Loading…';
    return [
      { label: 'Procurement', route: '/receive/records' },
      { label: 'Purchase Orders', route: '/receive/records/pos' },
      { label: poNumber },
    ];
  });

  readonly isReadOnly = computed(() => this.purchaseOrder()?.status === 'CLOSED');
  readonly isEditable = computed(() => !this.isReadOnly() && this.canEdit());

  ngOnInit(): void {
    this.checkPermissions();
    this.loadPurchaseOrder();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    const isSuper = this.authService.isSuperAdmin();

    this.canEdit.set(permissions.includes('po.create') || isSuper);
    this.canUpdate.set(permissions.includes('po.update') || isSuper);
  }

  loadPurchaseOrder(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Invalid purchase order ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.procurementService.getPurchaseOrder(id).subscribe({
      next: (po) => {
        this.purchaseOrder.set(po);
        this.loadRelatedItems(po.id, po.poType);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load purchase order');
        this.loading.set(false);
      },
    });
  }

  private loadRelatedItems(poId: string, poType: string): void {
    if (poType === 'CONTAINER' || poType === 'HYBRID') {
      this.procurementService.loadContainers({ purchaseOrderId: poId }).subscribe({
        next: (res) => this.containers.set(res.data || []),
      });
    }

    this.loading.set(false);
  }

  openConfirmModal(action: 'receive' | 'close'): void {
    this.confirmAction.set(action);
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
  }

  confirmStatusChange(): void {
    const po = this.purchaseOrder();
    const action = this.confirmAction();
    if (!po || !action) return;

    this.actionLoading.set(true);

    const request = action === 'receive'
      ? this.procurementService.receivePurchaseOrder(po.id)
      : this.procurementService.closePurchaseOrder(po.id);

    request.subscribe({
      next: (updated: PurchaseOrder) => {
        this.purchaseOrder.set(updated);
        this.actionLoading.set(false);
        this.closeConfirmModal();
      },
      error: (err: { message?: string }) => {
        this.error.set(err.message || 'Failed to update status');
        this.actionLoading.set(false);
        this.closeConfirmModal();
      },
    });
  }

  getPoTypeLabel(type: string): string {
    return type === 'CONTAINER' ? 'Container Procurement' : type === 'HYBRID' ? 'Mixed Procurement' : 'Loose Bale Procurement';
  }

}
