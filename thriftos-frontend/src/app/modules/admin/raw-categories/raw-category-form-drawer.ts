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
      <div class="p-6 flex h-full flex-col gap-4">
        <!-- Header -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <lucide-icon [img]="icons.package" [size]="20" class="text-muted-foreground"></lucide-icon>
            <div>
              <h2 class="m-0 text-lg font-semibold text-foreground">{{ isEditMode() ? 'Edit' : 'Add' }} Raw Category</h2>
              <p class="m-0 mt-1 text-sm text-muted-foreground">{{ isEditMode() ? 'Update category details' : 'Create a new raw material category' }}</p>
            </div>
          </div>
          <button
            class="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted"
            (click)="onClose()"
            type="button"
          >
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
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-1 flex-col gap-4">
          <div class="flex flex-col gap-1">
            <ui-input
              formControlName="name"
              label="Category Name"
              placeholder="e.g., Mixed Clothing, Shoes, Accessories"
              [required]="true"
            ></ui-input>
            @if (form.get('name')?.touched && form.get('name')?.errors?.['required']) {
              <span class="text-xs text-destructive">Category name is required</span>
            }
          </div>

          <div class="flex flex-col gap-1">
            <ui-select
              formControlName="rawType"
              label="Type"
              placeholder="Select type..."
              [options]="typeOptions"
              [required]="true"
              [disabled]="isEditMode()"
            ></ui-select>
            @if (form.get('rawType')?.touched && form.get('rawType')?.errors?.['required']) {
              <span class="text-xs text-destructive">Type is required</span>
            }
            @if (isEditMode()) {
              <span class="text-xs text-muted-foreground">Type cannot be changed after creation</span>
            } @else {
              <span class="text-xs text-muted-foreground">RAG: Container rags only | BALE: Loose bales only | BOTH: Applicable to both</span>
            }
          </div>

          <div class="flex flex-col gap-1">
            <ui-input
              formControlName="sortOrder"
              label="Sort Order"
              type="number"
              placeholder="0"
            ></ui-input>
            <span class="text-xs text-muted-foreground">Lower numbers appear first in lists</span>
          </div>

          <!-- Actions -->
          <div class="mt-auto flex justify-end gap-2 border-t border-border pt-4">
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
