/**
 * Purchase Order Add Bale Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/pos/:id/bales/create
 * 
 * Form to register a loose bale intake linked to a specific purchase order with flexible pricing options.
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
  Package,
  Layers,
  Scale,
  DollarSign,
  Calculator,
  Tag,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { PurchaseOrder, CreateIncomingBaleRequest } from '../../procurement.models';
import { TenantService } from '../../../../core/tenant/tenant.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../../shared/ui';

export type PriceType = 'WHOLE' | 'PER_UNIT';

@Component({
  selector: 'app-purchase-order-add-bale',
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
  ],
  templateUrl: './purchase-order-add-bale.html',
  styleUrl: './purchase-order-add-bale.scss',
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

  readonly priceType = signal<PriceType>('WHOLE');
  readonly rawCategoriesSignal = signal<any[]>([]);

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Package,
    Layers,
    Scale,
    DollarSign,
    Calculator,
    Tag,
  };

  readonly breadcrumbs = computed(() => {
    const po = this.purchaseOrder();
    const poLabel = po?.poNumber || 'Purchase Order';
    return [
      { label: 'Procurement', route: '/app/procurement' },
      { label: 'Purchase Orders', route: '/app/procurement/pos' },
      { label: poLabel, route: po ? `/app/procurement/pos/${po.id}` : '/app/procurement/pos' },
      { label: 'Add Bale' },
    ];
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.tenantService.loadRawCategories().subscribe((categories) => {
      this.rawCategoriesSignal.set(categories);
    });
    this.loadPurchaseOrder();
  }

  private initForm(): void {
    this.form = this.fb.group({
      rawCategoryId: ['', Validators.required],
      weightKg: [0, [Validators.required, Validators.min(0.01)]],
      pricePerKg: [0, [Validators.min(0)]],
      cost: [0, [Validators.required, Validators.min(0)]],
    });

    // Recalculate cost dynamically when weight or price per kg changes
    this.form.get('weightKg')?.valueChanges.subscribe(() => this.recalculatePricing());
    this.form.get('pricePerKg')?.valueChanges.subscribe(() => {
      if (this.priceType() === 'PER_UNIT') {
        this.recalculatePricing();
      }
    });
    this.form.get('cost')?.valueChanges.subscribe(() => {
      if (this.priceType() === 'WHOLE') {
        this.recalculatePricing();
      }
    });
  }

  setPriceType(type: PriceType): void {
    this.priceType.set(type);
    this.recalculatePricing();
  }

  private recalculatePricing(): void {
    const weight = Number(this.form.get('weightKg')?.value) || 0;

    if (this.priceType() === 'PER_UNIT') {
      const pricePerKg = Number(this.form.get('pricePerKg')?.value) || 0;
      const totalCost = Number((weight * pricePerKg).toFixed(2));
      this.form.get('cost')?.setValue(totalCost, { emitEvent: false });
    } else {
      const totalCost = Number(this.form.get('cost')?.value) || 0;
      const pricePerKg = weight > 0 ? Number((totalCost / weight).toFixed(4)) : 0;
      this.form.get('pricePerKg')?.setValue(pricePerKg, { emitEvent: false });
    }
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
        this.router.navigate(['/app/procurement/pos', po.id]);
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
      this.router.navigate(['/app/procurement/pos', po.id]);
      return;
    }
    this.router.navigate(['/app/procurement/pos']);
  }
}
