/**
 * Waste Category Form Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/waste-categories/new or /app/admin/waste-categories/:id/edit
 * 
 * Form for creating and editing byproduct waste categories.
 */

import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Loader2,
  Recycle,
  Link2,
  Info,
} from 'lucide-angular';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { WasteCategoryService } from './waste-category.service';
import type { WasteCategory, CreateWasteCategoryDto, UpdateWasteCategoryDto } from './waste-category.models';

@Component({
  selector: 'app-waste-category-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    HasPermissionDirective,
  ],
  template: `
    <app-page>
      <app-page-header>
        <div class="header-left-group">
          <div class="eyebrow-container">
            <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>
          </div>
          <h1 class="page-title">{{ isEditMode() ? 'Edit Waste Category' : 'New Waste Category' }}</h1>
          <p class="page-subtitle">{{ getDescription() }}</p>
        </div>

        <div class="header-right-actions">
          <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
            <lucide-icon [img]="icons.ArrowLeft" [size]="15"></lucide-icon>
            Back to Waste Categories
          </button>
        </div>
      </app-page-header>

      <app-page-body>
        <div class="form-container-card">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="waste-form">
            
            <!-- Category Name -->
            <div class="form-group">
              <label class="form-label required">Waste Category Name</label>
              <input
                type="text"
                formControlName="name"
                class="form-input"
                placeholder="e.g. Damaged Fabric, Scraps, Thread Waste"
                [class.has-error]="form.get('name')?.invalid && form.get('name')?.touched"
              />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <span class="field-error">Category name is required</span>
              }
              @if (isSystemGenerated()) {
                <span class="field-hint">System-generated category names are linked to normal categories and cannot be edited directly.</span>
              }
            </div>

            <!-- Linked Normal Category Preview (If present) -->
            @if (category()?.linkedCategory) {
              <div class="form-group">
                <label class="form-label">Linked Output Category</label>
                <input
                  type="text"
                  [value]="category()?.linkedCategory?.name || ''"
                  class="form-input disabled"
                  readonly
                />
                <span class="field-hint">This waste category was automatically generated from output category sorting rejects.</span>
              </div>
            }

            <!-- Unit Type -->
            <div class="form-group">
              <label class="form-label required">Measurement Unit</label>
              <select formControlName="unitType" class="form-select" [class.disabled]="isSystemGenerated()">
                <option value="KG">Kilograms (KG)</option>
                <option value="PCS">Pieces (PCS)</option>
              </select>
              @if (isSystemGenerated()) {
                <span class="field-hint">Unit type matches the linked output category's measurement unit.</span>
              }
            </div>

            <!-- Default Resale Price -->
            <div class="form-group">
              <label class="form-label required">Default Resale Price / Unit</label>
              <input
                type="number"
                step="0.01"
                formControlName="defaultResalePrice"
                class="form-input"
                placeholder="0.00"
                [class.has-error]="form.get('defaultResalePrice')?.invalid && form.get('defaultResalePrice')?.touched"
              />
              <span class="field-hint">Default resale or scrap valuation price per unit. Can be overridden during sorting.</span>
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
                    <span class="checkbox-title">Active Waste Category</span>
                    <span class="checkbox-desc">Inactive waste categories cannot be selected in new sorting sessions.</span>
                  </div>
                </label>
              </div>
            }

            <!-- System Warning Callout Banner -->
            @if (isSystemGenerated()) {
              <div class="info-callout">
                <lucide-icon [img]="icons.Info" [size]="16" class="callout-icon"></lucide-icon>
                <div class="callout-content">
                  <span class="callout-title">Auto-Generated Waste Category</span>
                  <span class="callout-desc">Name and unit type are synchronized with the linked output category. You can update the default resale price per unit.</span>
                </div>
              </div>
            }

            <!-- Form Actions -->
            <div class="form-footer-actions">
              <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
                Cancel
              </button>
              <button
                class="btn btn-primary"
                type="submit"
                [disabled]="form.invalid || submitting()"
                *hasPermission="isEditMode() ? 'category.update' : 'category.create'"
              >
                @if (submitting()) {
                  <lucide-icon [img]="icons.Loader2" [size]="15" class="animate-spin"></lucide-icon>
                  Saving...
                } @else {
                  <lucide-icon [img]="icons.Save" [size]="15"></lucide-icon>
                  {{ isEditMode() ? 'Update Waste Category' : 'Create Waste Category' }}
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

    .waste-form {
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

    .form-input, .form-select {
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

      &.disabled {
        background: #f8fafc;
        cursor: not-allowed;
        color: #64748b;
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
      gap: 0.625rem;
      padding: 0.75rem 0.875rem;
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
        gap: 0.15rem;
      }

      .callout-title {
        font-size: 0.8125rem;
        font-weight: 700;
        color: #714b67;
      }

      .callout-desc {
        font-size: 0.75rem;
        color: #475569;
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
export class WasteCategoryFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(WasteCategoryService);

  readonly category = signal<WasteCategory | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Recycle,
    Link2,
    Info,
  };

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Waste Categories', route: '/settings/admin/waste-categories' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    unitType: ['KG' as 'KG' | 'PCS', Validators.required],
    defaultResalePrice: [0 as number, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/settings/admin' },
        { label: 'Waste Categories', route: '/settings/admin/waste-categories' },
        { label: 'Edit' },
      ]);
      this.loadCategory(id);
    }
  }

  private loadCategory(id: string): void {
    this.service.getById(id).subscribe({
      next: (data) => {
        this.category.set(data);
        this.form.patchValue({
          name: data.name,
          unitType: data.unitType as 'KG' | 'PCS',
          defaultResalePrice: Number(data.defaultResalePrice),
          isActive: data.isActive,
        });

        if (data.isSystemGenerated) {
          this.form.get('name')?.disable();
          this.form.get('unitType')?.disable();
        }
      },
    });
  }

  isSystemGenerated(): boolean {
    return this.category()?.isSystemGenerated || false;
  }

  getDescription(): string {
    if (this.isSystemGenerated()) {
      return 'System-generated waste category linked to output sorting rejects.';
    }
    return this.isEditMode()
      ? 'Update waste category configuration.'
      : 'Create a new waste category for manual waste tracking.';
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.submitting.set(true);
    const formValue = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateWasteCategoryDto = {
        defaultResalePrice: Number(formValue.defaultResalePrice),
        isActive: formValue.isActive === true,
      };

      if (!this.isSystemGenerated()) {
        dto.name = formValue.name || undefined;
        dto.unitType = formValue.unitType as 'KG' | 'PCS' | undefined;
      }

      this.service.update(this.category()!.id, dto).subscribe({
        next: () => this.router.navigate(['/settings/admin/waste-categories']),
        error: () => this.submitting.set(false),
      });
    } else {
      const dto: CreateWasteCategoryDto = {
        name: formValue.name!,
        unitType: formValue.unitType as 'KG' | 'PCS',
        defaultResalePrice: Number(formValue.defaultResalePrice!),
      };

      this.service.create(dto).subscribe({
        next: () => this.router.navigate(['/settings/admin/waste-categories']),
        error: () => this.submitting.set(false),
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/settings/admin/waste-categories']);
  }
}
