/**
 * Purchase Order Create Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/pos/create
 * 
 * Form to initiate new procurement purchase orders with optional initial container & shipment logistics.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Loader2,
  ShoppingBag,
  Store,
  Truck,
  Package,
  Info,
  Anchor,
  Scale,
  Calendar,
  UserCheck,
  Globe,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { CreatePurchaseOrderRequest, PurchaseOrderType, CreateContainerRequest } from '../../procurement.models';
import { TenantService } from '../../../../core/tenant/tenant.service';
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
  selector: 'app-purchase-order-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppErrorStateComponent,
    AppAutocompleteComponent,
  ],
  templateUrl: './purchase-order-create.html',
  styleUrl: './purchase-order-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderCreateComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly vendors = this.procurementService.activeVendors;

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

  readonly breadcrumbs = [
    { label: 'Procurement', route: '/receive/records' },
    { label: 'Purchase Orders', route: '/receive/records/pos' },
    { label: 'New' },
  ];

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    ShoppingBag,
    Store,
    Truck,
    Package,
    Info,
    Anchor,
    Scale,
    Calendar,
    UserCheck,
    Globe,
  };

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.tenantService.loadTenant().subscribe();
    this.procurementService.loadVendors().subscribe();
  }

  private initForm(): void {
    this.form = this.fb.group({
      poType: ['CONTAINER', Validators.required],
      vendorId: [''],
      includeInitialContainer: [true],
      // Container Shipment Logistics Fields
      referenceNumber: ['', Validators.maxLength(50)],
      containerType: ['40ft'],
      forwarder: ['', Validators.maxLength(50)],
      billOfLadingNumber: ['', Validators.maxLength(50)],
      shippingLine: ['', Validators.maxLength(50)],
      vesselName: ['', Validators.maxLength(50)],
      portOfLoading: ['', Validators.maxLength(50)],
      portOfDischarge: ['', Validators.maxLength(50)],
      etd: [''],
      eta: [''],
      grossWeightKg: [0, [Validators.min(0)]],
      netWeightKg: [0, [Validators.min(0)]],
      tareWeightKg: [null, [Validators.min(0)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    const vendorId = (this.form.value.vendorId as string) || '';
    const poType = this.form.value.poType as PurchaseOrderType;
    const includeContainer = this.form.value.includeInitialContainer && (poType === 'CONTAINER' || poType === 'HYBRID');

    const poData: CreatePurchaseOrderRequest = {
      poType,
      vendorId: vendorId ? vendorId : undefined,
    };

    this.procurementService.createPurchaseOrder(poData).subscribe({
      next: (po) => {
        if (!includeContainer) {
          this.isSubmitting.set(false);
          this.router.navigate(['/receive/records/pos', po.id]);
          return;
        }

        // Auto-save forwarder into Vendors database if it's a new agent name
        const forwarderName = this.form.value.forwarder?.trim() || undefined;
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

        const containerData: CreateContainerRequest = {
          purchaseOrderId: po.id,
          referenceNumber: this.form.value.referenceNumber?.trim() || undefined,
          containerType: this.form.value.containerType || '40ft',
          forwarder: forwarderName,
          billOfLadingNumber: this.form.value.billOfLadingNumber?.trim() || undefined,
          shippingLine: this.form.value.shippingLine?.trim() || undefined,
          vesselName: this.form.value.vesselName?.trim() || undefined,
          portOfLoading: this.form.value.portOfLoading?.trim() || undefined,
          portOfDischarge: this.form.value.portOfDischarge?.trim() || undefined,
          etd: this.form.value.etd || undefined,
          eta: this.form.value.eta || undefined,
          grossWeightKg: Number(this.form.value.grossWeightKg) || 0,
          netWeightKg: Number(this.form.value.netWeightKg) || 0,
          tareWeightKg,
        };

        this.procurementService.createContainer(containerData).subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.router.navigate(['/receive/records/pos', po.id]);
          },
          error: (err) => {
            // PO created successfully, redirect to PO detail even if initial container failed
            this.isSubmitting.set(false);
            this.router.navigate(['/receive/records/pos', po.id]);
          },
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(err.message || 'Failed to create purchase order');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/receive/records/pos']);
  }
}
