/**
 * Container Detail Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/containers/:id
 * 
 * Detailed view of an ocean container shipment, weight verification, shipping agent, charges, and cost breakdown.
 * Features an inline editable grid for container charges with save on enter.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Truck,
  Anchor,
  Scale,
  Calendar,
  DollarSign,
  Plus,
  Pencil,
  ArrowLeft,
  CheckCircle2,
  Lock,
  FileText,
  RefreshCw,
  UserCheck,
  Globe,
  Trash2,
  ShoppingBag,
  Check,
  X,
  Loader2,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import {
  Container,
  ContainerStatus,
  CostBreakdown,
  ContainerCharge,
  ChargeType,
  CreateContainerChargeRequest,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
import { MoneyPipe } from '../../../../core/money/money.pipe';
import { CostBreakdownPanelComponent } from '../../shared/cost-breakdown-panel/cost-breakdown-panel';
import { RagListComponent } from '../../rags/rag-list';
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

export interface DraftChargeRow {
  chargeType: ChargeType;
  description: string;
  amount: number | null;
}

@Component({
  selector: 'app-container-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
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

  // Inline Charge Grid State
  readonly isAddingChargeRow = signal(false);
  readonly isSavingInlineCharge = signal(false);
  readonly draftCharge = signal<DraftChargeRow>({
    chargeType: 'FREIGHT',
    description: '',
    amount: null,
  });

  readonly showDeleteChargeConfirm = signal(false);
  readonly deletingChargeId = signal<string | null>(null);

  readonly canEdit = signal(false);

  readonly activeTab = signal<string>('overview');
  readonly tabs = [
    { id: 'overview', label: 'Shipment Overview' },
    { id: 'costs', label: 'Charges & Financials' },
    { id: 'rags', label: 'Rags / Bales Intake' },
  ];

  readonly chargeTypeOptions: Array<{ value: ChargeType; label: string }> = [
    { value: 'CIF', label: 'CIF (Cost, Insurance, Freight)' },
    { value: 'FREIGHT', label: 'Ocean Freight' },
    { value: 'DUTY', label: 'Customs Duty' },
    { value: 'TAX', label: 'Import Tax' },
    { value: 'PORT_HANDLING', label: 'Port Handling' },
    { value: 'MISC', label: 'Miscellaneous' },
  ];

  readonly icons = {
    Truck,
    Anchor,
    Scale,
    Calendar,
    DollarSign,
    Plus,
    Pencil,
    ArrowLeft,
    CheckCircle2,
    Lock,
    FileText,
    RefreshCw,
    UserCheck,
    Globe,
    Trash2,
    ShoppingBag,
    Check,
    X,
    Loader2,
  };

  readonly breadcrumbs = computed(() => {
    const contNumber = this.container()?.containerNumber || 'Loading…';
    return [
      { label: 'Procurement', route: '/receive/records' },
      { label: 'Containers', route: '/receive/records/containers' },
      { label: contNumber },
    ];
  });

  readonly isEditable = computed(() => this.container()?.status !== 'CLOSED');
  readonly isReadOnly = computed(() => this.container()?.status === 'CLOSED');

  readonly currencyCode = computed(
    () =>
      this.container()?.purchaseOrder?.currency ||
      this.costBreakdown()?.currency ||
      this.tenantService.tenant()?.currencyCode ||
      'USD',
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
      error: () => this.costLoading.set(false),
    });
  }

  private loadCharges(containerId: string): void {
    this.procurementService.getContainerCharges(containerId).subscribe({
      next: (charges) => this.charges.set(charges),
    });
  }

  // Inline Charge Grid Operations
  toggleAddChargeRow(): void {
    if (this.isAddingChargeRow()) {
      this.cancelInlineCharge();
    } else {
      this.draftCharge.set({
        chargeType: 'FREIGHT',
        description: '',
        amount: null,
      });
      this.isAddingChargeRow.set(true);
    }
  }

  cancelInlineCharge(): void {
    this.isAddingChargeRow.set(false);
    this.draftCharge.set({
      chargeType: 'FREIGHT',
      description: '',
      amount: null,
    });
  }

  saveInlineCharge(): void {
    const container = this.container();
    const draft = this.draftCharge();
    if (!container || this.isSavingInlineCharge()) return;

    if (!draft.description.trim()) {
      this.error.set('Please enter a description for the charge');
      return;
    }

    if (draft.amount === null || draft.amount <= 0) {
      this.error.set('Please enter a valid charge amount greater than 0');
      return;
    }

    this.isSavingInlineCharge.set(true);
    this.error.set(null);

    const requestData: CreateContainerChargeRequest = {
      chargeType: draft.chargeType,
      description: draft.description.trim(),
      amount: Number(draft.amount),
    };

    this.procurementService.addContainerCharge(container.id, requestData).subscribe({
      next: () => {
        this.isSavingInlineCharge.set(false);
        this.cancelInlineCharge();
        this.loadCharges(container.id);
        this.loadCostBreakdown(container.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to add charge entry');
        this.isSavingInlineCharge.set(false);
      },
    });
  }

  updateDraftField(field: keyof DraftChargeRow, value: any): void {
    this.draftCharge.update((prev) => ({
      ...prev,
      [field]: value,
    }));
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

  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
  }
}
