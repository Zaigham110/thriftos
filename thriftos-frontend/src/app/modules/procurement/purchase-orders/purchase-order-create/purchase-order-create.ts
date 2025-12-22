/**
 * Purchase Order Create Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/purchase-orders/create
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProcurementService } from '../../procurement.service';
import { CreatePurchaseOrderRequest, PurchaseOrderType, Vendor } from '../../procurement.models';
import { VendorSelectComponent } from '../../shared/vendor-select/vendor-select';
import { TenantService } from '../../../../core/tenant/tenant.service';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SelectComponent,
  SelectOption,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    SelectComponent,
    VendorSelectComponent,
  ],
  templateUrl: './purchase-order-create.html',
  styleUrl: './purchase-order-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderCreateComponent implements OnInit {
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedVendorId = signal<string | null>(null);
  readonly tenant = signal<{ currency: string } | null>(null);
  readonly tenantCurrency = computed(() => this.tenant()?.currency ?? null);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Purchase Orders', link: '/app/procurement/purchase-orders' },
    { label: 'Create' },
  ];

  readonly poTypeOptions: SelectOption[] = [
    { value: 'CONTAINER', label: 'Container Procurement' },
    { value: 'LOOSE_BALE', label: 'Loose Bale Procurement' },
    { value: 'HYBRID', label: 'Mixed (Containers + Loose Bales)' },
  ];

  form!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly procurementService: ProcurementService,
    private readonly router: Router,
    private readonly tenantService: TenantService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.tenantService.loadTenant().subscribe();
    // Sync tenant signal from service
    this.tenant.set(this.tenantService.tenant());
  }

  private initForm(): void {
    this.form = this.fb.group({
      poType: ['CONTAINER', Validators.required],
    });
  }

  onVendorSelected(vendor: Vendor | null): void {
    this.selectedVendorId.set(vendor?.id || null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    const data: CreatePurchaseOrderRequest = {
      poType: this.form.value.poType as PurchaseOrderType,
      vendorId: this.selectedVendorId() || undefined,
    };

    this.procurementService.createPurchaseOrder(data).subscribe({
      next: (po) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/app/procurement/purchase-orders', po.id]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(err.message || 'Failed to create purchase order');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/app/procurement/purchase-orders']);
  }
}
