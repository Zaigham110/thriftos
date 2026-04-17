import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppSelectComponent,
  AppButtonComponent,
  AppStackComponent,
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
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppSelectComponent,
    AppButtonComponent,
    AppStackComponent,
    HasPermissionDirective,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">{{ isEditMode() ? 'Edit Waste Category' : 'New Waste Category' }}</h1>
          <p class="page-subtitle">{{ getDescription() }}</p>
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
                <app-input
                  type="text"
                  formControlName="name"
                  placeholder="e.g., Damaged Fabric"
                  [disabled]="isSystemGenerated()"
                />
                @if (isSystemGenerated()) {
                  <div class="text-xs text-gray-500 mt-1">
                    System-generated category names cannot be changed. Update the linked normal category to change this name.
                  </div>
                }
              </app-form-field>

              @if (category()?.linkedCategory) {
                <app-form-field label="Linked Category">
                  <input
                    type="text"
                    [value]="category()?.linkedCategory?.name || ''"
                    [disabled]="true"
                    class="app-input"
                    readonly
                  />
                  <div class="text-xs text-gray-500 mt-1">
                    This waste category is automatically managed by the system based on the linked normal category.
                  </div>
                </app-form-field>
              }

              <app-form-field
                label="Unit Type"
                [required]="true"
              >
                <app-select
                  formControlName="unitType"
                  [options]="unitOptions"
                  [disabled]="isSystemGenerated()"
                />
                @if (isSystemGenerated()) {
                  <div class="text-xs text-gray-500 mt-1">
                    System-generated category units cannot be changed. They match the linked normal category's unit type.
                  </div>
                }
              </app-form-field>

              <app-form-field
                label="Default Price Per Unit"
                [required]="true"
                [error]="form.get('defaultResalePrice')?.hasError('required') && form.get('defaultResalePrice')?.touched ? 'Price is required' : form.get('defaultResalePrice')?.hasError('min') ? 'Price must be non-negative' : ''"
              >
                <app-input
                  type="number"
                  formControlName="defaultResalePrice"
                  placeholder="0.00"
                />
                <div class="text-xs text-gray-500 mt-1">
                  Default resale price per unit for this waste category. Can be overridden during sorting.
                </div>
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
                    Inactive waste categories cannot be used in new sorting operations.
                  </div>
                </app-form-field>
              }

              <app-stack direction="horizontal" spacing="sm">
                <app-button variant="secondary" type="button" (clickEvent)="onCancel()">
                  Cancel
                </app-button>
                <app-button
                  variant="primary"
                  type="submit"
                  [disabled]="form.invalid || submitting()"
                  *hasPermission="isEditMode() ? 'category.update' : 'category.create'"
                >
                  {{ isEditMode() ? 'Update' : 'Create' }}
                </app-button>
              </app-stack>
            </app-form>
          </app-card>
        </app-section>
      </app-page-body>
    </app-page>
  `
})
export class WasteCategoryFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(WasteCategoryService);

  readonly category = signal<WasteCategory | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly unitOptions = [
    { value: 'KG', label: 'Kilograms (KG)' },
    { value: 'PCS', label: 'Pieces (PCS)' }
  ];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    unitType: ['KG' as 'KG' | 'PCS', Validators.required],
    defaultResalePrice: [0 as number, [Validators.required, Validators.min(0)]],
    isActive: [true]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.loadCategory(id);
    }
  }

  private loadCategory(id: string) {
    this.service.getById(id).subscribe({
      next: (data) => {
        this.category.set(data);
        this.form.patchValue({
          name: data.name,
          unitType: data.unitType as 'KG' | 'PCS',
          defaultResalePrice: Number(data.defaultResalePrice),
          isActive: data.isActive
        });

        // Make fields readonly if system-generated
        if (data.isSystemGenerated) {
          this.form.get('name')?.disable();
          this.form.get('unitType')?.disable();
        }
      }
    });
  }

  isSystemGenerated(): boolean {
    return this.category()?.isSystemGenerated || false;
  }

  getDescription(): string {
    if (this.isSystemGenerated()) {
      return 'This is a system-generated waste category. Name and unit type are managed automatically.';
    }
    return this.isEditMode()
      ? 'Update waste category configuration.'
      : 'Create a new waste category for manual waste tracking.';
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.submitting.set(true);
    const formValue = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateWasteCategoryDto = {
        defaultResalePrice: Number(formValue.defaultResalePrice),
        isActive: formValue.isActive === true
      };

      // Only include name and unitType if not system-generated
      if (!this.isSystemGenerated()) {
        dto.name = formValue.name || undefined;
        dto.unitType = formValue.unitType as 'KG' | 'PCS' | undefined;
      }

      this.service.update(this.category()!.id, dto).subscribe({
        next: () => this.router.navigate(['/app/admin/waste-categories']),
        error: () => this.submitting.set(false)
      });
    } else {
      const dto: CreateWasteCategoryDto = {
        name: formValue.name!,
        unitType: formValue.unitType as 'KG' | 'PCS',
        defaultResalePrice: Number(formValue.defaultResalePrice!)
      };

      this.service.create(dto).subscribe({
        next: () => this.router.navigate(['/app/admin/waste-categories']),
        error: () => this.submitting.set(false)
      });
    }
  }

  onCancel() {
    this.router.navigate(['/app/admin/waste-categories']);
  }
}
