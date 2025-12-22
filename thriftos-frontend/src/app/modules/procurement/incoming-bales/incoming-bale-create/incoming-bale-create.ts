/**
 * Incoming Bale Create Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/incoming-bales/create
 */

import { Component, OnInit, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, ArrowLeft, Save, Package } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import { CreateIncomingBaleRequest } from '../../procurement.models';
import { TenantService } from '../../../../core/tenant/tenant.service';
import {
  CardComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  InputComponent,
  SelectComponent,
  SelectOption,
} from '../../../../shared/ui';

@Component({
  selector: 'app-incoming-bale-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    LucideAngularModule,
    CardComponent,
    AlertComponent,
    BreadcrumbComponent,
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './incoming-bale-create.html',
  styleUrl: './incoming-bale-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingBaleCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private procurementService = inject(ProcurementService);
  private tenantService = inject(TenantService);

  readonly icons = {
    ArrowLeft,
    Save,
    Package,
  };

  readonly tenant = this.tenantService.tenant;
  readonly rawCategoriesSignal = signal<any[]>([]);
  readonly categoryOptions = computed<SelectOption[]>(() =>
    this.rawCategoriesSignal()
      .filter((category: any) => category.isActive && (category.rawType === 'BALE' || category.rawType === 'BOTH'))
      .map((category: any) => ({ value: category.id, label: category.name })),
  );
  readonly tenantCurrency = computed(() => this.tenantService.tenant()?.currency || 'USD');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Incoming Bales', link: '/app/procurement/incoming-bales' },
    { label: 'Create' },
  ];

  form!: FormGroup;
  submitting = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.initForm();
    this.tenantService.loadRawCategories().subscribe((categories) => {
      this.rawCategoriesSignal.set(categories);
    });
    this.tenantService.loadTenant().subscribe();
  }

  private initForm(): void {
    this.form = this.fb.group({
      rawCategoryId: ['', Validators.required],
      weightKg: ['', [Validators.required, Validators.min(0.1)]],
      cost: ['', [Validators.required, Validators.min(0)]],
    });
  }

  get costPerKg(): number {
    const weight = parseFloat(this.form.get('weightKg')?.value || 0);
    const cost = parseFloat(this.form.get('cost')?.value || 0);
    if (weight > 0 && cost > 0) {
      return cost / weight;
    }
    return 0;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const data: CreateIncomingBaleRequest = {
      rawCategoryId: this.form.get('rawCategoryId')?.value,
      weightKg: parseFloat(this.form.get('weightKg')?.value),
      cost: parseFloat(this.form.get('cost')?.value),
    };

    this.procurementService.createIncomingBale(data).subscribe({
      next: (bale) => {
        this.submitting.set(false);
        this.router.navigate(['/app/procurement/incoming-bales', bale.id]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to create incoming bale');
      },
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.tenantCurrency(),
    }).format(amount);
  }
}
