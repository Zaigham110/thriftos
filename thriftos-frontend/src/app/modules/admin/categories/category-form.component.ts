/**
 * Category Form Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/categories/new or /app/admin/categories/:id/edit
 * 
 * Form for creating and editing sorting output categories.
 */

import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Loader2,
  Tags,
  Recycle,
  Info,
} from 'lucide-angular';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../admin.models';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    TPipe,
  ],
  template: `
    <app-page>
      <app-page-header>
        <div class="header-left-group">
          <div class="eyebrow-container">
            <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>
          </div>
          <h1 class="page-title">{{ isEditMode() ? 'Edit Category' : 'New Output Category' }}</h1>
          <p class="page-subtitle">Configure sorted item categories, priority indices, and auto-linked waste categories.</p>
        </div>

        <div class="header-right-actions">
          <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
            <lucide-icon [img]="icons.ArrowLeft" [size]="15"></lucide-icon>
            Back to Categories
          </button>
        </div>
      </app-page-header>

      <app-page-body>
        <div class="form-container-card">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="category-form">
            
            <!-- Category Name -->
            <div class="form-group">
              <label class="form-label required">
                Category Name
              </label>
              <input
                type="text"
                formControlName="name"
                class="form-input"
                placeholder="e.g. Vintage T-Shirts, Denim Jeans, Cotton Rags"
                [class.has-error]="form.get('name')?.invalid && form.get('name')?.touched"
              />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <span class="field-error">Category name is required</span>
              }
            </div>

            <!-- Sort Order -->
            <div class="form-group">
              <label class="form-label">
                Sort Priority Order
              </label>
              <input
                type="number"
                formControlName="sortOrder"
                class="form-input"
                placeholder="0"
              />
              <span class="field-hint">Lower numbers prioritize this category in sorting selection menus (e.g. 1 appears first).</span>
            </div>

            <!-- Usual bale weight (v2 6.6): pre-filled when bales are made while sorting -->
            <div class="form-group">
              <label class="form-label" for="baleWeightKg">{{ 'catalogue.baleWeight' | t }}</label>
              <input id="baleWeightKg" type="number" min="1" max="5000" step="0.5" inputmode="decimal" formControlName="baleWeightKg" class="form-input" placeholder="45" />
              <span class="field-hint">{{ 'catalogue.baleWeightHint' | t }}</span>
            </div>

            <!-- Active Status (Edit Mode) -->
            @if (isEditMode()) {
              <div class="form-group">
                <label class="checkbox-container">
                  <input
                    type="checkbox"
                    formControlName="isActive"
                    class="custom-checkbox"
                  />
                  <div class="checkbox-text">
                    <span class="checkbox-title">Active Category</span>
                    <span class="checkbox-desc">Inactive categories are hidden from selection in new sorting sessions.</span>
                  </div>
                </label>
              </div>
            }

            <!-- Auto-Linked Waste Stream Info Card -->
            <div class="info-callout">
              <div class="callout-icon">
                <lucide-icon [img]="icons.Recycle" [size]="18"></lucide-icon>
              </div>
              <div class="callout-content">
                <span class="callout-title">Auto-Generated Waste Stream</span>
                <p class="callout-desc">
                  Saving this category automatically manages a 1-to-1 linked waste stream
                  <strong>{{ form.get('name')?.value ? form.get('name')?.value + ' Waste' : '[Category Name] Waste' }}</strong>
                  for sorting reject accounting.
                </p>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-footer-actions">
              <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
                Cancel
              </button>
              <button class="btn btn-primary" type="submit" [disabled]="form.invalid || submitting()">
                @if (submitting()) {
                  <lucide-icon [img]="icons.Loader2" [size]="15" class="animate-spin"></lucide-icon>
                  Saving...
                } @else {
                  <lucide-icon [img]="icons.Save" [size]="15"></lucide-icon>
                  {{ isEditMode() ? 'Update Category' : 'Create Category' }}
                }
              </button>
            </div>
          </form>
        </div>
      </app-page-body>
    </app-page>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .form-container-card {
      max-width: 680px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
    }

    .category-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0f172a;

      &.required::after {
        content: ' *';
        color: #ef4444;
      }
    }

    .form-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.375rem;
      background: white;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:focus {
        outline: none;
        border-color: #714b67;
        box-shadow: 0 0 0 3px rgba(113, 75, 103, 0.12);
      }

      &.has-error {
        border-color: #ef4444;
      }
    }

    .field-hint {
      font-size: 0.75rem;
      color: #64748b;
    }

    .field-error {
      font-size: 0.75rem;
      font-weight: 500;
      color: #ef4444;
    }

    .checkbox-container {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      cursor: pointer;
    }

    .custom-checkbox {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: #714b67;
      margin-top: 0.125rem;
    }

    .checkbox-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .checkbox-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
    }

    .checkbox-desc {
      font-size: 0.75rem;
      color: #64748b;
    }

    /* Info Callout */
    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: #fdf4ff;
      border: 1px solid rgba(113, 75, 103, 0.2);
      border-radius: 0.375rem;

      .callout-icon {
        color: #714b67;
        margin-top: 0.125rem;
        flex-shrink: 0;
      }

      .callout-content {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .callout-title {
        font-size: 0.8125rem;
        font-weight: 700;
        color: #714b67;
      }

      .callout-desc {
        font-size: 0.75rem;
        color: #475569;
        margin: 0;
        line-height: 1.4;
      }
    }

    .form-footer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.625rem;
      margin-top: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4375rem;
      padding: 0.4375rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: 0.375rem;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

      &-primary {
        background: #714b67;
        color: white;

        &:hover:not(:disabled) {
          background: #5b3c53;
          transform: translateY(-1px);
        }
      }

      &-secondary {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #334155;

        &:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly category = signal<Category | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Tags,
    Recycle,
    Info,
  };

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Categories', route: '/settings/admin/categories' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    sortOrder: [0],
    isActive: [true],
    baleWeightKg: [null as number | null, [Validators.min(1), Validators.max(5000)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/settings/admin' },
        { label: 'Categories', route: '/settings/admin/categories' },
        { label: 'Edit' },
      ]);
      this.loadCategory(id);
    }
  }

  private loadCategory(id: string): void {
    this.adminService.getCategory(id).subscribe({
      next: (data) => {
        this.category.set(data);
        this.form.patchValue({
          name: data.name,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          baleWeightKg: data.baleWeightKg ? Number(data.baleWeightKg) : null,
        });
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateCategoryRequest = {
        name: raw.name || undefined,
        sortOrder: raw.sortOrder ?? 0,
        isActive: raw.isActive === true,
        baleWeightKg: raw.baleWeightKg ? Number(raw.baleWeightKg) : null,
      };

      this.adminService.updateCategory(this.category()!.id, dto).subscribe({
        next: () => this.router.navigate(['/settings/admin/categories']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateCategoryRequest = {
      name: raw.name!,
      sortOrder: raw.sortOrder ?? 0,
      baleWeightKg: raw.baleWeightKg ? Number(raw.baleWeightKg) : null,
    };

    this.adminService.createCategory(dto).subscribe({
      next: () => this.router.navigate(['/settings/admin/categories']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/settings/admin/categories']);
  }
}
