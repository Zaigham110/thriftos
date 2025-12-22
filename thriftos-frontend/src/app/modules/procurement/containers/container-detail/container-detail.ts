/**
 * Container Detail Component
 * Phase 2: Procurement UI
 * Phase 2.5: Added Rags/Bales tab for Container Breakdown
 * 
 * Route: /app/procurement/containers/:id
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, ArrowRight, Edit2, ExternalLink, Plus, Receipt, Trash2, Package } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import {
  Container,
  ContainerStatus,
  CostBreakdown,
  ContainerCharge,
  CreateContainerChargeRequest,
  ChargeType,
  UpdateContainerRequest,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
import { CostBreakdownPanelComponent } from '../../shared/cost-breakdown-panel/cost-breakdown-panel';
import { RagListComponent } from '../../rags/rag-list';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  BadgeComponent,
  ModalComponent,
  DrawerComponent,
  InputComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  TabsComponent,
  Tab,
} from '../../../../shared/ui';

@Component({
  selector: 'app-container-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    LucideAngularModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    BadgeComponent,
    ModalComponent,
    DrawerComponent,
    InputComponent,
    SelectComponent,
    SkeletonComponent,
    CostBreakdownPanelComponent,
    TabsComponent,
    RagListComponent,
  ],
  templateUrl: './container-detail.html',
  styleUrl: './container-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly procurementService = inject(ProcurementService);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  readonly icons = {
    ArrowRight,
    Edit2,
    ExternalLink,
    Plus,
    Receipt,
    Trash2,
    Package,
  };

  readonly container = signal<Container | null>(null);
  readonly costBreakdown = signal<CostBreakdown | null>(null);
  readonly charges = signal<ContainerCharge[]>([]);
  readonly loading = signal(true);
  readonly costLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly isEditMode = signal(false);
  readonly showChargeDrawer = signal(false);
  readonly showStatusModal = signal(false);
  readonly selectedStatus = signal<ContainerStatus | null>(null);

  readonly canEdit = signal(false);

  // Phase 2.5: Tabs for container detail
  readonly activeTab = signal<string>('overview');
  readonly tabs: Tab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rags', label: 'Rags / Bales' },
    { id: 'costs', label: 'Costs' },
  ];

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Containers', link: '/app/procurement/containers' },
    { label: this.container()?.containerNumber || 'Loading...' },
  ]);

  readonly isEditable = computed(() => {
    const container = this.container();
    return container?.status !== 'CLOSED';
  });

  readonly isReadOnly = computed(() => {
    const container = this.container();
    return container?.status === 'CLOSED';
  });

  readonly statusOptions: SelectOption[] = [
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'ARRIVED', label: 'Arrived' },
    { value: 'CLEARED', label: 'Cleared' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly chargeTypeOptions: SelectOption[] = [
    { value: 'CIF', label: 'CIF (Cost, Insurance, Freight)' },
    { value: 'FREIGHT', label: 'Freight' },
    { value: 'DUTY', label: 'Duty' },
    { value: 'TAX', label: 'Tax' },
    { value: 'PORT_HANDLING', label: 'Port Handling' },
    { value: 'MISC', label: 'Miscellaneous' },
  ];

  editForm!: FormGroup;
  chargeForm!: FormGroup;
  readonly currencyCode = computed(
    () => this.container()?.purchaseOrder?.currency || this.costBreakdown()?.currency || this.tenantService.tenant()?.currency || 'USD',
  );

  ngOnInit(): void {
    this.initForms();
    this.checkPermissions();
    this.loadContainer();
    this.tenantService.loadTenant().subscribe();
  }

  private initForms(): void {
    this.editForm = this.fb.group({
      referenceNumber: ['', Validators.maxLength(50)],
      containerType: [''],
      eta: [''],
      etd: [''],
      arrivedAt: [''],
      clearedAt: [''],
      releasedAt: [''],
      grossWeight: [0, [Validators.required, Validators.min(0)]],
      netWeight: [0, [Validators.required, Validators.min(0)]],
      billOfLadingNumber: ['', Validators.maxLength(50)],
      shipmentReference: ['', Validators.maxLength(50)],
      shippingLine: ['', Validators.maxLength(50)],
      vesselName: ['', Validators.maxLength(50)],
      portOfLoading: ['', Validators.maxLength(50)],
      portOfDischarge: ['', Validators.maxLength(50)],
      forwarder: ['', Validators.maxLength(50)],
      notes: ['', Validators.maxLength(500)],
    });

    this.chargeForm = this.fb.group({
      chargeType: ['CIF', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(200)]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
    });
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
        this.editForm.patchValue({
          referenceNumber: container.referenceNumber || '',
          containerType: container.containerType || '',
          eta: this.formatDate(container.eta),
          etd: this.formatDate(container.etd),
          arrivedAt: this.formatDate(container.arrivedAt),
          clearedAt: this.formatDate(container.clearedAt),
          releasedAt: this.formatDate(container.releasedAt),
          grossWeight: container.grossWeight,
          netWeight: container.netWeight,
          billOfLadingNumber: container.billOfLadingNumber || '',
          shipmentReference: container.shipmentReference || '',
          shippingLine: container.shippingLine || '',
          vesselName: container.vesselName || '',
          portOfLoading: container.portOfLoading || '',
          portOfDischarge: container.portOfDischarge || '',
          forwarder: container.forwarder || '',
          notes: container.notes || '',
        });
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

  toggleEditMode(): void {
    const container = this.container();
    if (container) {
      this.editForm.patchValue({
        referenceNumber: container.referenceNumber || '',
        containerType: container.containerType || '',
        eta: this.formatDate(container.eta),
        etd: this.formatDate(container.etd),
        arrivedAt: this.formatDate(container.arrivedAt),
        clearedAt: this.formatDate(container.clearedAt),
        releasedAt: this.formatDate(container.releasedAt),
        grossWeight: container.grossWeight,
        netWeight: container.netWeight,
        billOfLadingNumber: container.billOfLadingNumber || '',
        shipmentReference: container.shipmentReference || '',
        shippingLine: container.shippingLine || '',
        vesselName: container.vesselName || '',
        portOfLoading: container.portOfLoading || '',
        portOfDischarge: container.portOfDischarge || '',
        forwarder: container.forwarder || '',
        notes: container.notes || '',
      });
    }
    this.isEditMode.update((v) => !v);
  }

  saveChanges(): void {
    const container = this.container();
    if (!container || this.editForm.invalid) return;

    this.actionLoading.set(true);

    const data: UpdateContainerRequest = {
      referenceNumber: this.editForm.value.referenceNumber?.trim() || undefined,
      containerType: this.editForm.value.containerType?.trim() || undefined,
      eta: this.normalizeDate(this.editForm.value.eta),
      etd: this.normalizeDate(this.editForm.value.etd),
      arrivedAt: this.normalizeDate(this.editForm.value.arrivedAt),
      clearedAt: this.normalizeDate(this.editForm.value.clearedAt),
      releasedAt: this.normalizeDate(this.editForm.value.releasedAt),
      grossWeight: Number(this.editForm.value.grossWeight),
      netWeight: Number(this.editForm.value.netWeight),
      billOfLadingNumber: this.editForm.value.billOfLadingNumber?.trim() || undefined,
      shipmentReference: this.editForm.value.shipmentReference?.trim() || undefined,
      shippingLine: this.editForm.value.shippingLine?.trim() || undefined,
      vesselName: this.editForm.value.vesselName?.trim() || undefined,
      portOfLoading: this.editForm.value.portOfLoading?.trim() || undefined,
      portOfDischarge: this.editForm.value.portOfDischarge?.trim() || undefined,
      forwarder: this.editForm.value.forwarder?.trim() || undefined,
      notes: this.editForm.value.notes?.trim() || undefined,
    };

    this.procurementService.updateContainer(container.id, data).subscribe({
      next: (updated) => {
        this.container.set(updated);
        this.isEditMode.set(false);
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to update container');
        this.actionLoading.set(false);
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

  openChargeDrawer(): void {
    this.chargeForm.reset({
      chargeType: 'CIF',
      amount: 0,
    });
    this.showChargeDrawer.set(true);
  }

  closeChargeDrawer(): void {
    this.showChargeDrawer.set(false);
  }

  createCharge(): void {
    const container = this.container();
    if (!container || this.chargeForm.invalid) return;

    this.actionLoading.set(true);

    const data: CreateContainerChargeRequest = {
      chargeType: this.chargeForm.value.chargeType as ChargeType,
      description: this.chargeForm.value.description.trim(),
      amount: Number(this.chargeForm.value.amount),
    };

    this.procurementService.addContainerCharge(container.id, data).subscribe({
      next: () => {
        this.showChargeDrawer.set(false);
        this.actionLoading.set(false);
        this.loadCharges(container.id);
        this.loadCostBreakdown(container.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to add charge');
        this.actionLoading.set(false);
      },
    });
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

  private formatDate(value?: string | null): string {
    return value ? value.split('T')[0] : '';
  }

  private normalizeDate(value?: string | null): string | undefined {
    return value ? value : undefined;
  }

  // Phase 2.5: Tab change handler
  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
  }
}
