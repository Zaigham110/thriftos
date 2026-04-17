import { ChangeDetectionStrategy, Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProcurementService } from '../../procurement.service';
import { CreatePurchaseOrderRequest, PurchaseOrderType } from '../../procurement.models';
import { TenantService } from '../../../../core/tenant/tenant.service';
import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppErrorStateComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSelectComponent,
  AppStackComponent,
  type BreadcrumbItem,
  type SelectOption,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppSelectComponent,
    AppButtonComponent,
    AppErrorStateComponent,
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
  readonly vendorOptions = computed<SelectOption[]>(() => {
    const vs = this.vendors();
    return [
      { value: '', label: 'No vendor' },
      ...vs.map((v) => ({ value: v.id, label: v.name })),
    ];
  });

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Procurement', route: '/procurement/dashboard' },
    { label: 'Purchase Orders', route: '/procurement/pos' },
    { label: 'Create', route: '/procurement/pos/create' },
  ];

  readonly poTypeOptions = [
    { value: 'CONTAINER', label: 'Container Procurement' },
    { value: 'LOOSE_BALE', label: 'Loose Bale Procurement' },
    { value: 'HYBRID', label: 'Mixed (Containers + Loose Bales)' },
  ];

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

    const data: CreatePurchaseOrderRequest = {
      poType: this.form.value.poType as PurchaseOrderType,
      vendorId: vendorId ? vendorId : undefined,
    };

    this.procurementService.createPurchaseOrder(data).subscribe({
      next: (po) => {
        this.isSubmitting.set(false);
        this.router.navigate(['/procurement/pos', po.id]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(err.message || 'Failed to create purchase order');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/procurement/pos']);
  }
}
