import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  LucideAngularModule,
  Building2,
  Save,
  ArrowLeft,
  Loader2,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-angular';

import { TenantsService } from '../tenants';
import { Tenant } from '../tenant.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AlertComponent,
} from '../../../../../shared/ui';

const CURRENCIES = [
  { value: 'USD', label: 'USD ($) - US Dollar' },
  { value: 'PKR', label: 'PKR (Rs) - Pakistani Rupee' },
  { value: 'EUR', label: 'EUR (€) - Euro' },
  { value: 'GBP', label: 'GBP (£) - British Pound' },
  { value: 'CAD', label: 'CAD ($) - Canadian Dollar' },
  { value: 'AUD', label: 'AUD ($) - Australian Dollar' },
  { value: 'NGN', label: 'NGN (₦) - Nigerian Naira' },
  { value: 'KES', label: 'KES (KSh) - Kenyan Shilling' },
  { value: 'ZAR', label: 'ZAR (R) - South African Rand' },
];

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-NG', label: 'English (Nigeria)' },
  { value: 'en-KE', label: 'English (Kenya)' },
  { value: 'en-ZA', label: 'English (South Africa)' },
  { value: 'fr-FR', label: 'French (FR)' },
];

const STATUSES = [
  { value: 'ACTIVE', label: 'Active (Allowed Login Access)' },
  { value: 'INACTIVE', label: 'Inactive (Restricted Access)' },
];


@Component({
  selector: 'app-tenant-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AlertComponent,
  ],
  templateUrl: './tenant-edit.component.html',
  styleUrl: './tenant-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantEditComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantsService = inject(TenantsService);

  protected readonly tenant = signal<Tenant | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form: FormGroup;

  protected readonly currencies = CURRENCIES;
  protected readonly locales = LOCALES;
  protected readonly statuses = STATUSES;

  readonly icons = {
    Building2,
    Save,
    ArrowLeft,
    Loader2,
    Globe,
    CheckCircle2,
    AlertTriangle,
  };

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      companyCode: [{ value: '', disabled: true }],
      currencyCode: ['USD', Validators.required],
      locale: ['en-US', Validators.required],
      status: ['ACTIVE', Validators.required],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTenant(id);
    }
  }

  loadTenant(id: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.tenantsService
      .getTenant(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (t) => {
          this.tenant.set(t);
          this.form.patchValue({
            name: t.name,
            companyCode: t.companyCode,
            currencyCode: t.currencyCode,
            locale: t.locale,
            status: t.status,
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.message || 'Failed to load tenant profile');
          this.loading.set(false);
        },
      });
  }

  onSubmit(): void {
    const t = this.tenant();
    if (!t || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.getRawValue();
    const request = {
      name: formValue.name,
      currencyCode: formValue.currencyCode,
      locale: formValue.locale,
      status: formValue.status,
    };

    this.tenantsService
      .updateTenant(t.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigate(['/admin/tenants', t.id]);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message || 'Failed to update tenant configuration');
        },
      });
  }
}
