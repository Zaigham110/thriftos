/**
 * Raw Category Form Drawer Component
 * 
 * Create/Edit drawer for raw categories.
 */

import {
  Component,
  inject,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
  OnInit,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Package, X } from 'lucide-angular';
import { TenantService } from '../../../core/tenant/tenant.service';
import {
  DrawerComponent,
  ButtonComponent,
  InputComponent,
  AlertComponent,
  SelectComponent,
  SelectOption,
} from '../../../shared/ui';

export interface RawCategory {
  id: string;
  name: string;
  rawType: 'RAG' | 'BALE' | 'BOTH';
  sortOrder: number;
}

@Component({
  selector: 'app-raw-category-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    ButtonComponent,
    InputComponent,
    AlertComponent,
    SelectComponent,
  ],
  template: `
    <ui-drawer [isOpen]="true" position="right" size="md" (closed)="onClose()">
      <div class="drawer-content">
        <!-- Header -->
        <div class="drawer-header">
          <div class="drawer-header__info">
            <lucide-icon [img]="icons.package" [size]="20"></lucide-icon>
            <div>
              <h2 class="drawer-title">{{ isEditMode() ? 'Edit' : 'Add' }} Raw Category</h2>
              <p class="drawer-subtitle">{{ isEditMode() ? 'Update category details' : 'Create a new raw material category' }}</p>
            </div>
          </div>
          <button class="drawer-close" (click)="onClose()" type="button">
            <lucide-icon [img]="icons.close" [size]="20"></lucide-icon>
          </button>
        </div>

        <!-- Error Alert -->
        @if (error()) {
          <ui-alert variant="danger" [dismissible]="true" (dismissed)="clearError()">
            {{ error() }}
          </ui-alert>
        }

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="drawer-form">
          <div class="form-field">
            <ui-input
              formControlName="name"
              label="Category Name"
              placeholder="e.g., Mixed Clothing, Shoes, Accessories"
              [required]="true"
            ></ui-input>
            @if (form.get('name')?.touched && form.get('name')?.errors?.['required']) {
              <span class="field-error">Category name is required</span>
            }
          </div>

          <div class="form-field">
            <ui-select
              formControlName="rawType"
              label="Type"
              placeholder="Select type..."
              [options]="typeOptions"
              [required]="true"
              [disabled]="isEditMode()"
            ></ui-select>
            @if (form.get('rawType')?.touched && form.get('rawType')?.errors?.['required']) {
              <span class="field-error">Type is required</span>
            }
            @if (isEditMode()) {
              <span class="field-hint">Type cannot be changed after creation</span>
            } @else {
              <span class="field-hint">RAG: Container rags only | BALE: Loose bales only | BOTH: Applicable to both</span>
            }
          </div>

          <div class="form-field">
            <ui-input
              formControlName="sortOrder"
              label="Sort Order"
              type="number"
              placeholder="0"
            ></ui-input>
            <span class="field-hint">Lower numbers appear first in lists</span>
          </div>

          <!-- Actions -->
          <div class="drawer-actions">
            <ui-button
              type="button"
              variant="outline"
              (click)="onClose()"
              [disabled]="loading()"
            >
              Cancel
            </ui-button>
            <ui-button
              type="submit"
              variant="primary"
              [disabled]="form.invalid || loading()"
              [loading]="loading()"
            >
              {{ isEditMode() ? 'Update' : 'Create' }} Category
            </ui-button>
          </div>
        </form>
      </div>
    </ui-drawer>
  `,
  styles: [`
    .drawer-content {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      &__info {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
      }
    }

    .drawer-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary, #111827);
      margin: 0;
    }

    .drawer-subtitle {
      font-size: 0.875rem;
      color: var(--text-secondary, #6b7280);
      margin: 0.25rem 0 0 0;
    }

    .drawer-close {
      background: none;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      color: var(--text-secondary, #6b7280);
      border-radius: 0.25rem;
      transition: background-color 0.15s ease;

      &:hover {
        background: var(--bg-hover, #f3f4f6);
      }
    }

    .drawer-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 1;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .field-error {
      font-size: 0.75rem;
      color: var(--color-danger, #dc2626);
    }

    .field-hint {
      font-size: 0.75rem;
      color: var(--text-secondary, #6b7280);
    }

    .drawer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color, #e5e7eb);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RawCategoryFormDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tenantService = inject(TenantService);

  // Inputs
  readonly category = input<RawCategory | null>(null);

  // Outputs
  readonly saved = output<void>();
  readonly closed = output<void>();

  // Icons
  readonly icons = { package: Package, close: X };

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.category());

  readonly typeOptions: SelectOption[] = [
    { value: 'RAG', label: 'RAG - Container Rags Only' },
    { value: 'BALE', label: 'BALE - Loose Bales Only' },
    { value: 'BOTH', label: 'BOTH - Applicable to Both' },
  ];

  // Form
  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    rawType: ['', [Validators.required]],
    sortOrder: [0, [Validators.min(0)]],
  });

  ngOnInit(): void {
    const cat = this.category();
    if (cat) {
      this.form.patchValue({
        name: cat.name,
        rawType: cat.rawType,
        sortOrder: cat.sortOrder,
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const formData = this.form.value;
    const cat = this.category();

    const request = cat
      ? this.tenantService.updateRawCategory(cat.id, {
          name: formData.name,
          sortOrder: formData.sortOrder,
        })
      : this.tenantService.createRawCategory({
          name: formData.name,
          rawType: formData.rawType,
          sortOrder: formData.sortOrder,
        });

    request.subscribe({
      next: () => {
        this.loading.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to save raw category');
        this.loading.set(false);
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  clearError(): void {
    this.error.set(null);
  }
}
