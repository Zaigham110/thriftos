import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  LucideAngularModule,
  Building2,
  Save,
  ArrowLeft,
  Loader2,
  Shield,
  Globe,
  UserCheck,
  CheckCircle2,
} from 'lucide-angular';

import { TenantsService } from '../tenants';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
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


@Component({
  selector: 'app-tenant-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AlertComponent,
  ],
  templateUrl: './tenant-create.component.html',
  styleUrl: './tenant-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantCreateComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly tenantsService = inject(TenantsService);
  private readonly router = inject(Router);

  protected readonly form: FormGroup;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currencies = CURRENCIES;
  protected readonly locales = LOCALES;

  readonly icons = {
    Building2,
    Save,
    ArrowLeft,
    Loader2,
    Shield,
    Globe,
    UserCheck,
    CheckCircle2,
  };

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      companyCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]{2,20}$/)]],
      currencyCode: ['USD', Validators.required],
      locale: ['en-US', Validators.required],
      adminEmail: ['', [Validators.required, Validators.email]],
      adminName: ['', [Validators.required, Validators.minLength(2)]],
      adminPassword: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.value;
    const request = {
      name: formValue.name,
      companyCode: formValue.companyCode,
      currencyCode: formValue.currencyCode,
      locale: formValue.locale,
      adminEmail: formValue.adminEmail,
      adminName: formValue.adminName,
      adminPassword: formValue.adminPassword,
    };

    this.tenantsService
      .createTenant(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenant: any) => {
          this.submitting.set(false);
          void this.router.navigate(['/admin/tenants', tenant.id || tenant.data?.id]);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message || 'Failed to provision tenant organization');
        },
      });
  }
}
