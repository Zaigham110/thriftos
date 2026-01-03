import { ChangeDetectionStrategy, Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProcurementService } from '../../procurement.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  Container,
  IncomingBale,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import {
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppDataTableComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
  type DataTableColumn,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppCardComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppDialogComponent,
    AppDataTableComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './purchase-order-detail.html',
  styleUrl: './purchase-order-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private procurementService = inject(ProcurementService);
  private authService = inject(AuthService);

  readonly purchaseOrder = signal<PurchaseOrder | null>(null);
  readonly containers = signal<Container[]>([]);
  readonly incomingBales = signal<IncomingBale[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly showConfirmModal = signal(false);
  readonly confirmAction = signal<'receive' | 'close' | null>(null);

  readonly canEdit = signal(false);
  readonly canUpdate = signal(false);

  // Visibility rules based on procurement type
  readonly showContainerSection = computed(() => {
    const po = this.purchaseOrder();
    if (!po) return false;
    return po.poType === 'CONTAINER' || po.poType === 'HYBRID';
  });

  readonly showLooseBaleSection = computed(() => {
    const po = this.purchaseOrder();
    if (!po) return false;
    return po.poType === 'LOOSE_BALE' || po.poType === 'HYBRID';
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const poNumber = this.purchaseOrder()?.poNumber || 'Loading…';
    const id = this.purchaseOrder()?.id;
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Purchase Orders', route: '/procurement/pos' },
      { label: poNumber, route: id ? `/procurement/pos/${id}` : '/procurement/pos' },
    ];
  });

  readonly isEditable = computed(() => {
    const po = this.purchaseOrder();
    return po?.status === 'OPEN';
  });

  readonly isReadOnly = computed(() => {
    const po = this.purchaseOrder();
    return po?.status === 'CLOSED';
  });

  canEditBale(bale: IncomingBale): boolean {
    // Cannot edit if bale has been sorted
    if (bale.sortSessions && bale.sortSessions.length > 0) return false;
    // Cannot edit if PO is closed
    const po = this.purchaseOrder();
    if (po?.status === 'CLOSED') return false;
    return true;
  }

  readonly containerTypeOptions = [
    { value: '20ft', label: '20ft Standard' },
    { value: '40ft', label: '40ft Standard' },
    { value: '40HC', label: '40ft High Cube' },
    { value: '45HC', label: '45ft High Cube' },
  ];

  readonly baleColumns: DataTableColumn[] = [
    { key: 'baleCode', label: 'Bale Code', sortable: true, filterable: true },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      filterable: true,
      getValue: (row) => {
        const b = row as IncomingBale;
        return b.rawCategory?.name || b.categoryGuess || 'Uncategorized';
      },
    },
    { key: 'weightKg', label: 'Weight (kg)', align: 'right', sortable: true, getValue: (row) => (row as IncomingBale).weightKg },
    { key: 'cost', label: 'Cost', align: 'right', sortable: true, getValue: (row) => (row as IncomingBale).cost },
  ];

  readonly containerColumns: DataTableColumn[] = [
    { key: 'containerNumber', label: 'Container #', sortable: true, filterable: true },
    { key: 'containerType', label: 'Type', sortable: true, filterable: true, getValue: (row) => (row as Container).containerType || '—' },
    { key: 'status', label: 'Status', sortable: true, filterable: true, getValue: (row) => (row as Container).status },
    { key: 'netWeight', label: 'Net Weight (kg)', align: 'right', sortable: true, getValue: (row) => (row as Container).netWeight },
  ];

  ngOnInit(): void {
    this.checkPermissions();
    this.loadPurchaseOrder();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    const isSuperAdmin = this.authService.isSuperAdmin();
    this.canEdit.set(permissions.includes('po.update') || isSuperAdmin);
    this.canUpdate.set(permissions.includes('container.create') || isSuperAdmin);
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
        this.loading.set(false);

        this.loadContainers(po.id);
        this.loadIncomingBales(po.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load purchase order');
        this.loading.set(false);
      },
    });
  }

  private loadContainers(poId: string): void {
    this.procurementService.loadContainers({ purchaseOrderId: poId, limit: 100 }).subscribe({
      next: (response) => {
        this.containers.set(response.data);
      },
    });
  }

  private loadIncomingBales(poId: string): void {
    this.procurementService.fetchIncomingBales({ purchaseOrderId: poId, limit: 100 }).subscribe({
      next: (response) => {
        this.incomingBales.set(response.data);
      },
    });
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
    this.showConfirmModal.set(false);

    const obs = action === 'receive'
      ? this.procurementService.receivePurchaseOrder(po.id)
      : this.procurementService.closePurchaseOrder(po.id);

    obs.subscribe({
      next: (updatedPO) => {
        this.purchaseOrder.set(updatedPO);
        this.actionLoading.set(false);
        this.confirmAction.set(null);
      },
      error: (err) => {
        this.error.set(err.message || `Failed to ${action} purchase order`);
        this.actionLoading.set(false);
        this.confirmAction.set(null);
      },
    });
  }


  getStatusVariant(status: PurchaseOrderStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<PurchaseOrderStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      OPEN: 'primary',
      RECEIVED: 'success',
      CLOSED: 'default',
    };
    return variants[status] || 'default';
  }

  getContainerStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      IN_TRANSIT: 'warning',
      ARRIVED: 'primary',
      CLEARED: 'success',
      CLOSED: 'default',
    };
    return variants[status] || 'default';
  }

  navigateToContainer(containerId: string): void {
    this.router.navigate(['/procurement/containers', containerId]);
  }

  getPoTypeLabel(type: string): string {
    if (type === 'CONTAINER') return 'Container';
    if (type === 'LOOSE_BALE') return 'Loose Bale';
    if (type === 'HYBRID') return 'Mixed';
    return type;
  }

}
