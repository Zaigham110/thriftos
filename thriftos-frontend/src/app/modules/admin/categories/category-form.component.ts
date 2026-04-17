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
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../admin.models';

@Component({
  selector: 'app-category-form',
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
        <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>

        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">{{ isEditMode() ? 'Edit Category' : 'New Category' }}</h1>
          <p class="page-subtitle">Categories are used in Sorting and Inventory outputs. Creating a category auto-creates a linked Waste Category.</p>
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
                <app-input type="text" formControlName="name" placeholder="e.g., Shirts" />
              </app-form-field>

              <app-form-field label="Sort Order">
                <app-input type="number" formControlName="sortOrder" placeholder="0" />
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
                    Inactive categories are hidden from selection in new operations.
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
export class CategoryFormComponent {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly category = signal<Category | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/app/admin' },
    { label: 'Categories', route: '/app/admin/categories' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    sortOrder: [0],
    isActive: [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/app/admin' },
        { label: 'Categories', route: '/app/admin/categories' },
        { label: 'Edit' },
      ]);
      this.loadCategory(id);
    }
  }

  private loadCategory(id: string) {
    this.adminService.getCategory(id).subscribe({
      next: (data) => {
        this.category.set(data);
        this.form.patchValue({
          name: data.name,
          sortOrder: data.sortOrder,
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
      const dto: UpdateCategoryRequest = {
        name: raw.name || undefined,
        sortOrder: raw.sortOrder ?? 0,
        isActive: raw.isActive === true,
      };

      this.adminService.updateCategory(this.category()!.id, dto).subscribe({
        next: () => this.router.navigate(['/app/admin/categories']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateCategoryRequest = {
      name: raw.name!,
      sortOrder: raw.sortOrder ?? 0,
    };

    this.adminService.createCategory(dto).subscribe({
      next: () => this.router.navigate(['/app/admin/categories']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/app/admin/categories']);
  }
}
