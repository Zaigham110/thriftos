/**
 * Tenant Form Drawer - Create/Edit tenant form in a drawer
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LucideAngularModule, X } from 'lucide-angular';
import { TenantsService } from '../tenants';
import { Tenant, TenantStatus } from '../tenant.models';
import { DrawerComponent } from '../../../../../shared/ui/drawer/drawer';
import { InputComponent } from '../../../../../shared/ui/input/input';
import { SelectComponent } from '../../../../../shared/ui/select/select';
import { ButtonComponent } from '../../../../../shared/ui/button/button';
import { AlertComponent } from '../../../../../shared/ui/alert/alert';

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
];

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-NG', label: 'English (Nigeria)' },
  { value: 'en-KE', label: 'English (Kenya)' },
  { value: 'en-ZA', label: 'English (South Africa)' },
  { value: 'fr-FR', label: 'French' },
];

const STATUSES: { value: TenantStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

@Component({
  selector: 'app-tenant-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    InputComponent,
    SelectComponent,
    ButtonComponent,
    AlertComponent,
  ],
  templateUrl: './tenant-form-drawer.html',
  styleUrl: './tenant-form-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantFormDrawerComponent implements OnInit {
  readonly tenant = input<Tenant | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly icons = { X };
  protected readonly currencies = CURRENCIES;
  protected readonly locales = LOCALES;
  protected readonly statuses = STATUSES;

  protected readonly form: FormGroup;
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly isEditMode = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly tenantsService: TenantsService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      companyCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]{2,20}$/)]],
      currency: ['USD', Validators.required],
      locale: ['en-US', Validators.required],
      status: ['ACTIVE', Validators.required],
      adminEmail: ['', [Validators.required, Validators.email]],
      adminName: ['', [Validators.required, Validators.minLength(2)]],
      adminPassword: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    const tenant = this.tenant();
    if (tenant) {
      this.isEditMode.set(true);
      this.form.patchValue({
        name: tenant.name,
        companyCode: tenant.companyCode,
        currency: tenant.currency,
        locale: tenant.locale,
        status: tenant.status,
      });
      // Disable company code in edit mode (immutable)
      this.form.get('companyCode')?.disable();
      // Remove admin fields for edit mode
      this.form.get('adminEmail')?.clearValidators();
      this.form.get('adminName')?.clearValidators();
      this.form.get('adminPassword')?.clearValidators();
      this.form.get('adminEmail')?.updateValueAndValidity();
      this.form.get('adminName')?.updateValueAndValidity();
      this.form.get('adminPassword')?.updateValueAndValidity();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    if (this.isEditMode()) {
      this.updateTenant();
    } else {
      this.createTenant();
    }
  }

  private createTenant(): void {
    const formValue = this.form.value;
    const request = {
      name: formValue.name,
      companyCode: formValue.companyCode,
      currency: formValue.currency,
      locale: formValue.locale,
      adminEmail: formValue.adminEmail,
      adminName: formValue.adminName,
      adminPassword: formValue.adminPassword,
    };

    this.tenantsService.createTenant(request).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.saved.emit();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message);
      },
    });
  }

  private updateTenant(): void {
    const tenant = this.tenant();
    if (!tenant) return;

    const formValue = this.form.getRawValue();
    const request = {
      name: formValue.name,
      currency: formValue.currency,
      locale: formValue.locale,
      status: formValue.status,
    };

    this.tenantsService.updateTenant(tenant.id, request).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.saved.emit();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message);
      },
    });
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }
}
