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
  AppButtonComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { Warehouse, CreateWarehouseRequest, UpdateWarehouseRequest } from '../admin.models';

@Component({
  selector: 'app-warehouse-form',
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
    AppButtonComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <div class="header-left-group">
          <div class="eyebrow-container">
            <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>
          </div>
          <h1 class="page-title">{{ isEditMode() ? 'Edit Warehouse' : 'New Warehouse' }}</h1>
          <p class="page-subtitle">Configure facility name, unique facility code, and location details.</p>
        </div>
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
                <app-input type="text" formControlName="name" placeholder="e.g., Main Warehouse" />
              </app-form-field>

              <app-form-field
                label="Code"
                [required]="true"
                [error]="form.get('code')?.hasError('required') && form.get('code')?.touched ? 'Code is required' : ''"
              >
                <app-input type="text" formControlName="code" placeholder="e.g., WH-MAIN" />
              </app-form-field>

              <app-form-field label="Location">
                <app-input type="text" formControlName="location" placeholder="Optional" />
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
                    Inactive warehouses are hidden from selection in new operations.
                  </div>
                </app-form-field>
              }

              <app-stack direction="horizontal" spacing="sm">
                <app-button variant="secondary" type="button" (clickEvent)="onCancel()">Cancel</app-button>
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
export class WarehouseFormComponent {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly warehouse = signal<Warehouse | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/app/admin' },
    { label: 'Warehouses', route: '/app/admin/warehouses' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    location: [''],
    isActive: [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/app/admin' },
        { label: 'Warehouses', route: '/app/admin/warehouses' },
        { label: 'Edit' },
      ]);
      this.loadWarehouse(id);
    }
  }

  private loadWarehouse(id: string) {
    this.adminService.getWarehouse(id).subscribe({
      next: (data) => {
        this.warehouse.set(data);
        this.form.patchValue({
          name: data.name,
          code: data.code,
          location: data.location || '',
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
      const dto: UpdateWarehouseRequest = {
        name: raw.name || undefined,
        code: raw.code || undefined,
        location: raw.location || undefined,
        isActive: raw.isActive === true,
      };

      this.adminService.updateWarehouse(this.warehouse()!.id, dto).subscribe({
        next: () => this.router.navigate(['/app/admin/warehouses']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateWarehouseRequest = {
      name: raw.name!,
      code: raw.code!,
      location: raw.location || undefined,
    };

    this.adminService.createWarehouse(dto).subscribe({
      next: () => this.router.navigate(['/app/admin/warehouses']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/app/admin/warehouses']);
  }
}
