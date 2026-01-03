import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProcurementService } from '../../procurement.service';
import { IncomingBale, UpdateIncomingBaleRequest } from '../../procurement.models';
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
  selector: 'app-incoming-bale-edit',
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
  templateUrl: './incoming-bale-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingBaleEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly procurementService = inject(ProcurementService);
  private readonly tenantService = inject(TenantService);

  readonly bale = signal<IncomingBale | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly rawCategoriesSignal = signal<any[]>([]);
  readonly categoryOptions = computed(() =>
    this.rawCategoriesSignal()
      .filter((category: any) => category.isActive && (category.rawType === 'BALE' || category.rawType === 'BOTH'))
      .map((category: any) => ({ value: category.id, label: category.name })),
  );

  readonly canEdit = computed(() => {
    const b = this.bale();
    if (!b) return false;
    // Cannot edit if bale has been sorted
    if (b.sortSessions && b.sortSessions.length > 0) return false;
    // Cannot edit if PO is closed
    if (b.purchaseOrder?.status === 'CLOSED') return false;
    return true;
  });

  readonly editBlockedMessage = computed(() => {
    const b = this.bale();
    if (!b) return null;
    if (b.sortSessions && b.sortSessions.length > 0) {
      return 'Cannot edit: Bale has been sorted';
    }
    if (b.purchaseOrder?.status === 'CLOSED') {
      return 'Cannot edit: Purchase order is closed';
    }
    return null;
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const b = this.bale();
    const baleLabel = b?.baleCode || 'Loose Bale';
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Loose Bales', route: '/procurement/loose-bales' },
      { label: baleLabel, route: b ? `/procurement/loose-bales/${b.id}` : '/procurement/loose-bales' },
      { label: 'Edit', route: '' },
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

    this.loadBale();
  }

  loadBale(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Invalid bale ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.procurementService.getIncomingBale(id).subscribe({
      next: (bale) => {
        this.bale.set(bale);
        // Pre-populate form
        this.form.patchValue({
          rawCategoryId: bale.rawCategoryId || '',
          weightKg: bale.weightKg,
          cost: bale.cost || 0,
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load bale');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    const b = this.bale();
    if (!b || !this.canEdit()) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.actionLoading.set(true);

    const data: UpdateIncomingBaleRequest = {
      rawCategoryId: this.form.value.rawCategoryId,
      weightKg: Number(this.form.value.weightKg),
      cost: Number(this.form.value.cost),
    };

    this.procurementService.updateIncomingBale(b.id, data).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.router.navigate(['/procurement/loose-bales', b.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to update bale');
        this.actionLoading.set(false);
      },
    });
  }

  onCancel(): void {
    const b = this.bale();
    if (b) {
      this.router.navigate(['/procurement/loose-bales', b.id]);
      return;
    }
    this.router.navigate(['/procurement/loose-bales']);
  }
}
