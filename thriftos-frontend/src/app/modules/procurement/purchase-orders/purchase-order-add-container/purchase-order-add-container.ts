/**
 * Purchase Order Add Container Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/pos/:id/containers/create
 * 
 * Form to link an ocean freight container to a specific purchase order.
 * Automatically fetches registered Agent/Forwarder vendors and auto-saves new forwarders into Vendors.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Loader2,
  Truck,
  FileText,
  Anchor,
  Scale,
  Calendar,
  UserCheck,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { PurchaseOrder, CreateContainerRequest } from '../../procurement.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppAutocompleteComponent,
  type AutocompleteOption,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-add-container',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppAutocompleteComponent,
  ],
  templateUrl: './purchase-order-add-container.html',
  styleUrl: './purchase-order-add-container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderAddContainerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly procurementService = inject(ProcurementService);

  readonly purchaseOrder = signal<PurchaseOrder | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly vendors = this.procurementService.activeVendors;
  
  // Auto-fetch shipping agents and forwarders
  readonly agentVendors = computed(() => {
    const all = this.vendors();
    const shippers = all.filter((v) => v.vendorType === 'SHIPPER');
    return shippers.length > 0 ? shippers : all;
  });

  readonly agentOptions = computed<AutocompleteOption[]>(() => {
    return this.agentVendors().map((v) => ({
      value: v.name,
      label: v.name,
      sublabel: v.country ? `Origin Country: ${v.country}` : 'Registered Agent',
    }));
  });

  readonly containerTypeOptions = [
    { value: '20ft', label: '20ft Standard' },
    { value: '40ft', label: '40ft Standard' },
    { value: '40HC', label: '40ft High Cube' },
    { value: '45HC', label: '45ft High Cube' },
  ];

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Truck,
    FileText,
    Anchor,
    Scale,
    Calendar,
    UserCheck,
  };

  readonly breadcrumbs = computed(() => {
    const po = this.purchaseOrder();
    const poLabel = po?.poNumber || 'Purchase Order';
    return [
      { label: 'Procurement', route: '/app/procurement' },
      { label: 'Purchase Orders', route: '/app/procurement/pos' },
      { label: poLabel, route: po ? `/app/procurement/pos/${po.id}` : '/app/procurement/pos' },
      { label: 'Add Container' },
    ];
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.procurementService.loadVendors().subscribe();
    this.loadPurchaseOrder();
  }

  private initForm(): void {
    this.form = this.fb.group({
      referenceNumber: ['', Validators.maxLength(50)],
      containerType: ['40ft'],
      eta: [''],
      etd: [''],
      arrivedAt: [''],
      clearedAt: [''],
      releasedAt: [''],
      grossWeightKg: [0, [Validators.required, Validators.min(0)]],
      netWeightKg: [0, [Validators.required, Validators.min(0)]],
      tareWeightKg: [null, [Validators.min(0)]],
      billOfLadingNumber: ['', Validators.maxLength(50)],
      shipmentReference: ['', Validators.maxLength(50)],
      shippingLine: ['', Validators.maxLength(50)],
      vesselName: ['', Validators.maxLength(50)],
      portOfLoading: ['', Validators.maxLength(50)],
      portOfDischarge: ['', Validators.maxLength(50)],
      forwarder: ['', Validators.maxLength(50)],
      notes: ['', Validators.maxLength(500)],
    });
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
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load purchase order');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    const po = this.purchaseOrder();
    if (!po) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.actionLoading.set(true);

    const forwarderName = this.form.value.forwarder?.trim() || undefined;

    // Auto-save forwarder into Vendors database if it's a new agent name
    if (forwarderName) {
      const existingVendor = this.vendors().find(
        (v) => v.name.toLowerCase() === forwarderName.toLowerCase()
      );
      if (!existingVendor) {
        this.procurementService.createVendor({ name: forwarderName, vendorType: 'SHIPPER' }).subscribe();
      }
    }

    const rawTare = this.form.value.tareWeightKg;
    const tareWeightKg = rawTare === '' || rawTare === null || rawTare === undefined ? undefined : Number(rawTare);

    const data: CreateContainerRequest = {
      purchaseOrderId: po.id,
      referenceNumber: this.form.value.referenceNumber?.trim() || undefined,
      containerType: this.form.value.containerType || undefined,
      eta: this.normalizeDate(this.form.value.eta),
      etd: this.normalizeDate(this.form.value.etd),
      arrivedAt: this.normalizeDate(this.form.value.arrivedAt),
      clearedAt: this.normalizeDate(this.form.value.clearedAt),
      releasedAt: this.normalizeDate(this.form.value.releasedAt),
      grossWeightKg: Number(this.form.value.grossWeightKg),
      netWeightKg: Number(this.form.value.netWeightKg),
      tareWeightKg,
      billOfLadingNumber: this.form.value.billOfLadingNumber?.trim() || undefined,
      shipmentReference: this.form.value.shipmentReference?.trim() || undefined,
      shippingLine: this.form.value.shippingLine?.trim() || undefined,
      vesselName: this.form.value.vesselName?.trim() || undefined,
      portOfLoading: this.form.value.portOfLoading?.trim() || undefined,
      portOfDischarge: this.form.value.portOfDischarge?.trim() || undefined,
      forwarder: forwarderName,
      notes: this.form.value.notes?.trim() || undefined,
    };

    this.procurementService.createContainer(data).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.router.navigate(['/app/procurement/pos', po.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to create container');
        this.actionLoading.set(false);
      },
    });
  }

  onCancel(): void {
    const po = this.purchaseOrder();
    if (po) {
      this.router.navigate(['/app/procurement/pos', po.id]);
      return;
    }
    this.router.navigate(['/app/procurement/pos']);
  }

  private normalizeDate(value?: string | null): string | undefined {
    return value ? value : undefined;
  }
}
