import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProcurementService } from '../../procurement.service';
import { PurchaseOrder, CreateIncomingBaleRequest } from '../../procurement.models';
import { TenantService } from '../../../../core/tenant/tenant.service';

import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppErrorStateComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppStackComponent,
  AppSelectComponent,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-purchase-order-add-bale',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppStackComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppSelectComponent,
    AppInputComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './purchase-order-add-bale.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderAddBaleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly procurementService = inject(ProcurementService);
  private readonly tenantService = inject(TenantService);

  readonly purchaseOrder = signal<PurchaseOrder | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly rawCategoriesSignal = signal<any[]>([]);
  readonly categoryOptions = computed(() =>
    this.rawCategoriesSignal()
      .filter((category: any) => category.isActive && (category.rawType === 'BALE' || category.rawType === 'BOTH'))
      .map((category: any) => ({ value: category.id, label: category.name })),
  );

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const po = this.purchaseOrder();
    const poLabel = po?.poNumber || 'Purchase Order';
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Purchase Orders', route: '/procurement/pos' },
      { label: poLabel, route: po ? `/procurement/pos/${po.id}` : '/procurement/pos' },
      { label: 'Add bale', route: '' },
    ];
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      rawCategoryId: ['', Validators.required],
      weightKg: [0, [Validators.required, Validators.min(0.01)]],
      cost: [0, [Validators.required, Validators.min(0)]],
    });

    this.tenantService.loadRawCategories().subscribe((categories) => {
      this.rawCategoriesSignal.set(categories);
    });

    this.loadPurchaseOrder();
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

    const data: CreateIncomingBaleRequest = {
      purchaseOrderId: po.id,
      vendorId: po.vendorId || undefined,
      rawCategoryId: this.form.value.rawCategoryId,
      weightKg: Number(this.form.value.weightKg),
      cost: Number(this.form.value.cost),
    };

    this.procurementService.createIncomingBale(data).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.router.navigate(['/procurement/pos', po.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to create loose bale');
        this.actionLoading.set(false);
      },
    });
  }

  onCancel(): void {
    const po = this.purchaseOrder();
    if (po) {
      this.router.navigate(['/procurement/pos', po.id]);
      return;
    }
    this.router.navigate(['/procurement/pos']);
  }
}
