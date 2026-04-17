import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProcurementService } from '../../procurement.service';
import {
  Container,
  ContainerStatus,
  CostBreakdown,
  ContainerCharge,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
import { CostBreakdownPanelComponent } from '../../shared/cost-breakdown-panel/cost-breakdown-panel';
import { RagListComponent } from '../../rags/rag-list';
import {
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppDataTableComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLinkComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSplitAsideComponent,
  AppSplitComponent,
  AppSplitMainComponent,
  AppStackComponent,
  type DataTableColumn,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-container-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppSplitComponent,
    AppSplitMainComponent,
    AppSplitAsideComponent,
    AppBreadcrumbComponent,
    AppCardComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppDialogComponent,
    AppDataTableComponent,
    AppLinkComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    CostBreakdownPanelComponent,
    RagListComponent,
  ],
  templateUrl: './container-detail.html',
  styleUrl: './container-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly procurementService = inject(ProcurementService);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  readonly container = signal<Container | null>(null);
  readonly costBreakdown = signal<CostBreakdown | null>(null);
  readonly charges = signal<ContainerCharge[]>([]);
  readonly loading = signal(true);
  readonly costLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly showStatusModal = signal(false);
  readonly selectedStatus = signal<ContainerStatus | null>(null);

  readonly showDeleteChargeConfirm = signal(false);
  readonly deletingChargeId = signal<string | null>(null);

  readonly canEdit = signal(false);

  // Phase 2.5: Tabs for container detail
  readonly activeTab = signal<string>('overview');
  readonly tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'costs', label: 'Costs' },
    { id: 'rags', label: 'Rags / Bales' },
  ];

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const contNumber = this.container()?.containerNumber || 'Loading…';
    const id = this.container()?.id;
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Containers', route: '/procurement/containers' },
      { label: contNumber, route: id ? `/procurement/containers/${id}` : '/procurement/containers' },
    ];
  });

  readonly isEditable = computed(() => {
    const container = this.container();
    return container?.status !== 'CLOSED';
  });

  readonly isReadOnly = computed(() => {
    const container = this.container();
    return container?.status === 'CLOSED';
  });

  readonly statusOptions = [
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'ARRIVED', label: 'Arrived' },
    { value: 'CLEARED', label: 'Cleared' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly chargeColumns: DataTableColumn[] = [
    { key: 'chargeType', label: 'Type', sortable: true, filterable: true },
    { key: 'description', label: 'Description', sortable: true, filterable: true },
    { key: 'amount', label: 'Amount', align: 'right', sortable: true, getValue: (row) => (row as ContainerCharge).amount },
  ];

  readonly currencyCode = computed(
    () =>
      this.container()?.purchaseOrder?.currency ||
      this.costBreakdown()?.currency ||
      this.tenantService.tenant()?.currencyCode ||
      '—',
  );

  ngOnInit(): void {
    this.checkPermissions();
    this.loadContainer();
    this.tenantService.loadTenant().subscribe();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    const isSuperAdmin = this.authService.isSuperAdmin();
    this.canEdit.set(permissions.includes('container.update') || isSuperAdmin);
  }

  loadContainer(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Invalid container ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.procurementService.getContainer(id).subscribe({
      next: (container) => {
        this.container.set(container);
        this.loading.set(false);
        this.loadCostBreakdown(id);
        this.loadCharges(id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load container');
        this.loading.set(false);
      },
    });
  }

  private loadCostBreakdown(containerId: string): void {
    this.costLoading.set(true);
    this.procurementService.getContainerCostBreakdown(containerId).subscribe({
      next: (breakdown) => {
        this.costBreakdown.set(breakdown);
        this.costLoading.set(false);
      },
      error: () => {
        this.costLoading.set(false);
      },
    });
  }

  private loadCharges(containerId: string): void {
    this.procurementService.getContainerCharges(containerId).subscribe({
      next: (charges) => {
        this.charges.set(charges);
      },
    });
  }


  openStatusModal(status: ContainerStatus): void {
    this.selectedStatus.set(status);
    this.showStatusModal.set(true);
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedStatus.set(null);
  }

  confirmStatusChange(): void {
    const container = this.container();
    const status = this.selectedStatus();
    if (!container || !status) return;

    this.actionLoading.set(true);
    this.showStatusModal.set(false);

    this.procurementService.updateContainerStatus(container.id, { status }).subscribe({
      next: (updated) => {
        this.container.set(updated);
        this.actionLoading.set(false);
        this.selectedStatus.set(null);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to update container status');
        this.actionLoading.set(false);
        this.selectedStatus.set(null);
      },
    });
  }

  confirmDeleteCharge(chargeId: string): void {
    this.deletingChargeId.set(chargeId);
    this.showDeleteChargeConfirm.set(true);
  }

  cancelDeleteCharge(): void {
    this.showDeleteChargeConfirm.set(false);
    this.deletingChargeId.set(null);
  }

  executeDeleteCharge(): void {
    const chargeId = this.deletingChargeId();
    if (!chargeId) return;
    this.showDeleteChargeConfirm.set(false);
    this.deleteCharge(chargeId);
    this.deletingChargeId.set(null);
  }


  deleteCharge(chargeId: string): void {
    const container = this.container();
    if (!container) return;

    this.procurementService.deleteContainerCharge(container.id, chargeId).subscribe({
      next: () => {
        this.loadCharges(container.id);
        this.loadCostBreakdown(container.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to delete charge');
      },
    });
  }

  getStatusVariant(status: ContainerStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<ContainerStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      IN_TRANSIT: 'warning',
      ARRIVED: 'primary',
      CLEARED: 'success',
      CLOSED: 'default',
    };
    return variants[status] || 'default';
  }

  getStatusLabel(status: ContainerStatus | null | undefined): string {
    if (!status) return '';
    return status.replace('_', ' ');
  }

  getNextStatus(): ContainerStatus | null {
    const current = this.container()?.status;
    if (current === 'IN_TRANSIT') return 'ARRIVED';
    if (current === 'ARRIVED') return 'CLEARED';
    if (current === 'CLEARED') return 'CLOSED';
    return null;
  }

  private normalizeDate(value?: string | null): string | undefined {
    return value ? value : undefined;
  }

  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
  }
}
