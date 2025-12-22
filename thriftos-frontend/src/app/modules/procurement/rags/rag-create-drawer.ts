/**
 * Rag Create Drawer Component
 * Phase 2.5: Container Breakdown
 * 
 * Drawer form to create a new Rag/Bale for a container.
 */

import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Package, X } from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag } from './rag.models';
import { TenantService } from '../../../core/tenant/tenant.service';

import {
  DrawerComponent,
  ButtonComponent,
  InputComponent,
  TextareaComponent,
  AlertComponent,
  SelectComponent,
  SelectOption,
} from '../../../shared/ui';

@Component({
  selector: 'app-rag-create-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    ButtonComponent,
    InputComponent,
    TextareaComponent,
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
              <h2 class="drawer-title">Add Rag / Bale</h2>
              <p class="drawer-subtitle">Container: {{ containerNumber() }}</p>
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
          <ui-alert variant="info" class="mb-3">
            Rag code will be automatically generated (e.g., RAG-2025-001)
          </ui-alert>

          <div class="form-field">
            <ui-select
              formControlName="ragBaleType"
              label="Type"
              placeholder="Select type..."
              [options]="typeOptions"
              [required]="true"
            ></ui-select>
            @if (form.get('ragBaleType')?.touched && form.get('ragBaleType')?.errors?.['required']) {
              <span class="field-error">Type is required</span>
            }
          </div>

          <div class="form-field">
            <ui-select
              formControlName="rawCategoryId"
              label="Category"
              placeholder="Select category..."
              [options]="filteredCategoryOptions()"
              [required]="true"
            ></ui-select>
            @if (form.get('rawCategoryId')?.touched && form.get('rawCategoryId')?.errors?.['required']) {
              <span class="field-error">Category is required</span>
            }
            @if (!form.get('ragBaleType')?.value) {
              <span class="field-hint">Select type first</span>
            }
          </div>

          <div class="form-field">
            <ui-input
              formControlName="weightKg"
              label="Weight (KG)"
              type="number"
              placeholder="e.g., 500"
              [required]="true"
            ></ui-input>
            @if (availableWeight() !== null) {
              <span class="field-hint">Available capacity: {{ availableWeight() | number:'1.2-2' }} kg</span>
            }
            @if (form.get('weightKg')?.touched && form.get('weightKg')?.errors?.['required']) {
              <span class="field-error">Weight is required</span>
            }
            @if (form.get('weightKg')?.touched && form.get('weightKg')?.errors?.['min']) {
              <span class="field-error">Weight must be greater than 0</span>
            }
          </div>

          <div class="form-field">
            <ui-textarea
              formControlName="notes"
              label="Notes"
              placeholder="Optional notes about this rag/bale..."
              [rows]="3"
            ></ui-textarea>
          </div>

          <!-- Actions -->
          <div class="drawer-actions">
            <ui-button variant="ghost" type="button" (clicked)="onClose()">
              Cancel
            </ui-button>
            <ui-button
              variant="primary"
              type="submit"
              [disabled]="form.invalid || loading()"
              [loading]="loading()"
            >
              Create Rag
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
export class RagCreateDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ragService = inject(RagService);
  private readonly tenantService = inject(TenantService);

  // Inputs
  readonly containerId = input.required<string>();
  readonly containerNumber = input.required<string>();
  readonly containerGrossWeight = input<number>();
  readonly containerCurrentWeight = input<number>();

  // Outputs
  readonly created = output<Rag>();
  readonly closed = output<void>();

  // Icons
  readonly icons = { package: Package, close: X };

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly allRawCategories = signal<any[]>([]);
  
  readonly typeOptions: SelectOption[] = [
    { value: 'RAG', label: 'Rag' },
    { value: 'BALE', label: 'Bale' },
  ];

  readonly filteredCategoryOptions = signal<SelectOption[]>([]);

  // Computed
  readonly availableWeight = computed(() => {
    const gross = this.containerGrossWeight();
    const current = this.containerCurrentWeight();
    if (gross === undefined || current === undefined) return null;
    return gross - current;
  });

  // Form
  readonly form: FormGroup = this.fb.group({
    ragBaleType: ['', [Validators.required]],
    rawCategoryId: ['', [Validators.required]],
    weightKg: [null, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  ngOnInit(): void {
    // Disable category field initially until type is selected
    this.form.get('rawCategoryId')?.disable();

    // Load all raw categories
    this.tenantService.loadRawCategories().subscribe((cats) => {
      this.allRawCategories.set(cats);
      // If type is already selected, filter categories
      const currentType = this.form.get('ragBaleType')?.value;
      if (currentType) {
        this.updateFilteredCategories(currentType);
        this.form.get('rawCategoryId')?.enable();
      }
    });

    // Watch ragBaleType changes to filter categories
    this.form.get('ragBaleType')?.valueChanges.subscribe((type) => {
      if (type) {
        this.updateFilteredCategories(type);
        // Enable the category field when type is selected
        this.form.get('rawCategoryId')?.enable();
      } else {
        // Disable and clear category field when no type is selected
        this.form.get('rawCategoryId')?.disable();
        this.filteredCategoryOptions.set([]);
      }
      // Reset rawCategoryId when type changes
      this.form.get('rawCategoryId')?.setValue('');
    });
  }

  private updateFilteredCategories(type: string): void {
    if (!type) {
      this.filteredCategoryOptions.set([]);
      return;
    }

    const filtered = this.allRawCategories()
      .filter((c: any) => {
        // Include categories that match the selected type OR are of type BOTH
        return c.isActive && (c.rawType === type || c.rawType === 'BOTH');
      })
      .map((c: any) => ({
        value: c.id,
        label: c.name + (c.rawType === 'BOTH' ? ' (Both)' : ''),
      }));
    
    this.filteredCategoryOptions.set(filtered);
  }

  onSubmit(): void {
    // Mark all fields as touched to show validation errors
    this.form.markAllAsTouched();
    
    // Check if form is valid (note: disabled controls are excluded from validation)
    if (this.form.invalid) {
      return;
    }

    // Get raw values to include disabled fields (though they should be enabled when valid)
    const formData = this.form.getRawValue();
    
    this.loading.set(true);
    this.error.set(null);

    this.ragService
      .createRag(this.containerId(), {
        ragBaleType: formData.ragBaleType,
        rawCategoryId: formData.rawCategoryId,
        weightKg: formData.weightKg,
        notes: formData.notes || undefined,
      })
      .subscribe({
        next: (rag) => {
          this.loading.set(false);
          this.created.emit(rag);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to create rag');
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
