/**
 * Raw Category Form Drawer Component
 * 
 * Create/Edit slide-over drawer for raw categories.
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
import { LucideAngularModule, Package, X, Save, Loader2, Info } from 'lucide-angular';
import { TenantService } from '../../../core/tenant/tenant.service';
import {
  DrawerComponent,
  AlertComponent,
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
    AlertComponent,
  ],
  template: `
    <ui-drawer [isOpen]="true" position="right" size="md" [title]="isEditMode() ? 'Edit Raw Category' : 'Add Raw Category'" (closed)="onClose()">
      <div class="raw-drawer-container">
        
        <!-- Error Alert -->
        @if (error()) {
          <ui-alert variant="danger" [dismissible]="true" (dismissed)="clearError()">
            {{ error() }}
          </ui-alert>
        }

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="raw-category-form">
          
          <!-- Name Input -->
          <div class="form-group">
            <label class="form-label required">Category Name</label>
            <input
              type="text"
              formControlName="name"
              class="form-input"
              placeholder="e.g. Mixed Clothing, Shoes, Vintage Rags"
              [class.has-error]="form.get('name')?.invalid && form.get('name')?.touched"
            />
            @if (form.get('name')?.invalid && form.get('name')?.touched) {
              <span class="field-error">Category name is required</span>
            }
          </div>

          <!-- Raw Type Select -->
          <div class="form-group">
            <label class="form-label required">Material Scope Type</label>
            <select
              formControlName="rawType"
              class="form-select"
              [class.disabled]="isEditMode()"
            >
              <option value="" disabled>Select scope type...</option>
              <option value="RAG">RAG — Container Rags Only</option>
              <option value="BALE">BALE — Loose Bales Only</option>
              <option value="BOTH">BOTH — Applicable to Both Rags & Bales</option>
            </select>
            @if (isEditMode()) {
              <span class="field-hint">Material type scope cannot be changed after creation.</span>
            } @else {
              <span class="field-hint">RAG: Loose container rags | BALE: Compressed bales | BOTH: Applicable to both.</span>
            }
          </div>

          <!-- Sort Order Input -->
          <div class="form-group">
            <label class="form-label">Sort Priority Order</label>
            <input
              type="number"
              formControlName="sortOrder"
              class="form-input"
              placeholder="0"
            />
            <span class="field-hint">Lower numbers appear first in procurement selection lists.</span>
          </div>

          <!-- Scope Callout Banner -->
          <div class="info-callout">
            <lucide-icon [img]="icons.info" [size]="16" class="callout-icon"></lucide-icon>
            <div class="callout-content">
              <span class="callout-title">Procurement Scope Warning</span>
              <span class="callout-desc">Raw categories classify incoming inventory before Stage 1 sorting begins.</span>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="form-footer-actions">
            <button type="button" class="btn btn-secondary" (click)="onClose()" [disabled]="loading()">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid || loading()">
              @if (loading()) {
                <lucide-icon [img]="icons.loader" [size]="15" class="animate-spin"></lucide-icon>
                Saving...
              } @else {
                <lucide-icon [img]="icons.save" [size]="15"></lucide-icon>
                {{ isEditMode() ? 'Update' : 'Create' }} Category
              }
            </button>
          </div>
        </form>
      </div>
    </ui-drawer>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .raw-drawer-container {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .raw-category-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      flex: 1;
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
      transition: border-color 0.15s ease;

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

    /* Info Callout */
    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 0.875rem;
      background: #fdf4ff;
      border: 1px solid rgba(113, 75, 103, 0.2);
      border-radius: 0.375rem;
      margin-top: 0.5rem;

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
      margin-top: auto;
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
      transition: all 0.15s ease;

      &-primary {
        background: #714b67;
        color: white;

        &:hover:not(:disabled) {
          background: #5b3c53;
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
export class RawCategoryFormDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tenantService = inject(TenantService);

  // Inputs
  readonly category = input<RawCategory | null>(null);

  // Outputs
  readonly saved = output<void>();
  readonly closed = output<void>();

  // Icons
  readonly icons = { package: Package, close: X, save: Save, loader: Loader2, info: Info };

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.category());

  // Form
  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    rawType: ['RAG', [Validators.required]],
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
