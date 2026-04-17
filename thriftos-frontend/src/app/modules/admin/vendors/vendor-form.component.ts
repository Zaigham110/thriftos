import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppTextareaComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { Vendor, CreateVendorRequest, UpdateVendorRequest } from '../admin.models';

@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppTextareaComponent,
    AppButtonComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>

        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">{{ isEditMode() ? 'Edit Vendor' : 'New Vendor' }}</h1>
          <p class="page-subtitle">Vendors are used as suppliers in procurement.</p>
        </app-stack>
      </app-page-header>

      <app-page-body>
        <app-section>
          <app-card>
            <app-form [formGroup]="form" (submitted)="onSubmit()">
              <app-form-field
                label="Name"
                [required]="true"
                [error]="form.get('name')?.hasError('required') && form.get('name')?.touched ? 'Name is required' : ''"
              >
                <app-input type="text" formControlName="name" placeholder="e.g., ABC Traders" />
              </app-form-field>

              <app-form-field label="Country">
                <app-input type="text" formControlName="country" placeholder="e.g., Pakistan" />
              </app-form-field>

              <app-form-field label="Contact Info">
                <app-textarea
                  formControlName="contactInfo"
                  placeholder="Optional notes: phone, email, address, contact person, terms, etc."
                  [rows]="4"
                ></app-textarea>
              </app-form-field>

              @if (isEditMode()) {
                <app-form-field label="Status">
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      formControlName="isActive"
                      class="form-checkbox h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <span class="text-sm">Active</span>
                  </label>
                  <div class="text-xs text-gray-500 mt-1">
                    Inactive vendors are hidden from selection in new procurement.
                  </div>
                </app-form-field>
              }

              <app-stack direction="horizontal" spacing="sm">
                <app-button variant="secondary" type="button" (clickEvent)="onCancel()">
                  Cancel
                </app-button>
                <app-button variant="primary" type="submit" [disabled]="form.invalid || submitting()">
                  {{ isEditMode() ? 'Update' : 'Create' }}
                </app-button>
              </app-stack>
            </app-form>
          </app-card>
        </app-section>
      </app-page-body>
    </app-page>
  `,
})
export class VendorFormComponent {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly vendor = signal<Vendor | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    country: [''],
    contactInfo: [''],
    isActive: [true],
  });

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/app/admin' },
    { label: 'Vendors', route: '/app/admin/vendors' },
    { label: 'New' },
  ]);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/app/admin' },
        { label: 'Vendors', route: '/app/admin/vendors' },
        { label: 'Edit' },
      ]);
      this.loadVendor(id);
    }
  }

  private loadVendor(id: string) {
    this.adminService.getVendor(id).subscribe({
      next: (data) => {
        this.vendor.set(data);
        this.form.patchValue({
          name: data.name,
          country: data.country || '',
          contactInfo: data.contactInfo || '',
          isActive: data.isActive,
        });
      },
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateVendorRequest = {
        name: raw.name || undefined,
        country: raw.country || undefined,
        contactInfo: raw.contactInfo || undefined,
        isActive: raw.isActive === true,
      };

      this.adminService.updateVendor(this.vendor()!.id, dto).subscribe({
        next: () => this.router.navigate(['/app/admin/vendors']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateVendorRequest = {
      name: raw.name!,
      country: raw.country || undefined,
      contactInfo: raw.contactInfo || undefined,
    };

    this.adminService.createVendor(dto).subscribe({
      next: () => this.router.navigate(['/app/admin/vendors']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/app/admin/vendors']);
  }
}
