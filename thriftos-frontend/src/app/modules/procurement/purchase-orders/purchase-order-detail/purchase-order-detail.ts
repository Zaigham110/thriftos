/**
 * Purchase Order Detail Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/purchase-orders/:id
 */

import { ChangeDetectionStrategy, Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Check, Lock, Edit2, Plus, Box, ChevronRight, ArrowLeft, Package } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  Container,
  CreateContainerRequest,
  IncomingBale,
  CreateIncomingBaleRequest,
} from '../../procurement.models';
import { AuthService } from '../../../../core/auth/auth';
import { TenantService } from '../../../../core/tenant/tenant.service';
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
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    LucideAngularModule,
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
  ],
  templateUrl: './purchase-order-detail.html',
  styleUrl: './purchase-order-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private procurementService = inject(ProcurementService);
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);

  readonly icons = {
    Check,
    Lock,
    Edit2,
    Plus,
    Box,
    ChevronRight,
    ArrowLeft,
    Package,
  };

  readonly purchaseOrder = signal<PurchaseOrder | null>(null);
  readonly containers = signal<Container[]>([]);
  readonly incomingBales = signal<IncomingBale[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly showContainerDrawer = signal(false);
  readonly showBaleDrawer = signal(false);
  readonly showConfirmModal = signal(false);
  readonly confirmAction = signal<'receive' | 'close' | null>(null);

  readonly canEdit = signal(false);
  readonly canUpdate = signal(false);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Purchase Orders', link: '/app/procurement/purchase-orders' },
    { label: this.purchaseOrder()?.poNumber || 'Loading...' },
  ]);

  readonly isEditable = computed(() => {
    const po = this.purchaseOrder();
    return po?.status === 'OPEN';
  });

  readonly isReadOnly = computed(() => {
    const po = this.purchaseOrder();
    return po?.status === 'CLOSED';
  });

  readonly containerTypeOptions: SelectOption[] = [
    { value: '20ft', label: '20ft Standard' },
    { value: '40ft', label: '40ft Standard' },
    { value: '40HC', label: '40ft High Cube' },
    { value: '45HC', label: '45ft High Cube' },
  ];

  containerForm!: FormGroup;
  baleForm!: FormGroup;
  readonly rawCategoriesSignal = signal<any[]>([]);
  readonly categoryOptions = computed<SelectOption[]>(() =>
    this.rawCategoriesSignal()
      .filter((category: any) => category.isActive && (category.rawType === 'BALE' || category.rawType === 'BOTH'))
      .map((category: any) => ({ value: category.id, label: category.name })),
  );
  readonly currencyCode = computed(() => this.purchaseOrder()?.currency || this.tenantService.tenant()?.currency || 'USD');

  ngOnInit(): void {
    this.initForms();
    this.checkPermissions();
    this.loadPurchaseOrder();
    this.tenantService.loadRawCategories().subscribe((categories) => {
      this.rawCategoriesSignal.set(categories);
    });
    this.tenantService.loadTenant().subscribe();
  }

  private initForms(): void {
    this.containerForm = this.fb.group({
      referenceNumber: ['', Validators.maxLength(50)],
      containerType: ['40ft'],
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

    this.baleForm = this.fb.group({
      rawCategoryId: ['', Validators.required],
      weightKg: [0, [Validators.required, Validators.min(0.01)]],
      cost: [0, [Validators.required, Validators.min(0)]],
    });
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

  openContainerDrawer(): void {
    this.containerForm.reset({
      containerType: '40ft',
      grossWeight: 0,
      netWeight: 0,
    });
    this.showContainerDrawer.set(true);
  }

  closeContainerDrawer(): void {
    this.showContainerDrawer.set(false);
  }

  openBaleDrawer(): void {
    this.baleForm.reset({
      weightKg: 0,
      cost: 0,
    });
    this.showBaleDrawer.set(true);
  }

  closeBaleDrawer(): void {
    this.showBaleDrawer.set(false);
  }

  createContainer(): void {
    const po = this.purchaseOrder();
    if (!po || this.containerForm.invalid) return;

    this.actionLoading.set(true);

    const data: CreateContainerRequest = {
      purchaseOrderId: po.id,
      referenceNumber: this.containerForm.value.referenceNumber?.trim() || undefined,
      containerType: this.containerForm.value.containerType || undefined,
      eta: this.normalizeDate(this.containerForm.value.eta),
      etd: this.normalizeDate(this.containerForm.value.etd),
      arrivedAt: this.normalizeDate(this.containerForm.value.arrivedAt),
      clearedAt: this.normalizeDate(this.containerForm.value.clearedAt),
      releasedAt: this.normalizeDate(this.containerForm.value.releasedAt),
      grossWeight: Number(this.containerForm.value.grossWeight),
      netWeight: Number(this.containerForm.value.netWeight),
      billOfLadingNumber: this.containerForm.value.billOfLadingNumber?.trim() || undefined,
      shipmentReference: this.containerForm.value.shipmentReference?.trim() || undefined,
      shippingLine: this.containerForm.value.shippingLine?.trim() || undefined,
      vesselName: this.containerForm.value.vesselName?.trim() || undefined,
      portOfLoading: this.containerForm.value.portOfLoading?.trim() || undefined,
      portOfDischarge: this.containerForm.value.portOfDischarge?.trim() || undefined,
      forwarder: this.containerForm.value.forwarder?.trim() || undefined,
      notes: this.containerForm.value.notes?.trim() || undefined,
    };

    this.procurementService.createContainer(data).subscribe({
      next: () => {
        this.showContainerDrawer.set(false);
        this.actionLoading.set(false);
        this.loadContainers(po.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to create container');
        this.actionLoading.set(false);
      },
    });
  }

  createLooseBale(): void {
    const po = this.purchaseOrder();
    if (!po || this.baleForm.invalid) return;

    this.actionLoading.set(true);

    const data: CreateIncomingBaleRequest = {
      purchaseOrderId: po.id,
      vendorId: po.vendorId || undefined,
      rawCategoryId: this.baleForm.value.rawCategoryId,
      weightKg: Number(this.baleForm.value.weightKg),
      cost: Number(this.baleForm.value.cost),
    };

    this.procurementService.createIncomingBale(data).subscribe({
      next: () => {
        this.showBaleDrawer.set(false);
        this.actionLoading.set(false);
        this.loadIncomingBales(po.id);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to create loose bale');
        this.actionLoading.set(false);
      },
    });
  }

  getStatusVariant(status: PurchaseOrderStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<PurchaseOrderStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      OPEN: 'primary',
      RECEIVED: 'warning',
      CLOSED: 'success',
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
    this.router.navigate(['/app/procurement/containers', containerId]);
  }

  getPoTypeLabel(type: string): string {
    if (type === 'CONTAINER') return 'Container';
    if (type === 'LOOSE_BALE') return 'Loose Bale';
    if (type === 'HYBRID') return 'Mixed';
    return type;
  }

  private normalizeDate(value?: string | null): string | undefined {
    return value ? value : undefined;
  }
}
