/**
 * Rag Edit Drawer Component
 * Phase 2.5: Container Breakdown
 * 
 * Drawer form to edit an existing Rag/Bale.
 * Only allowed for status = NOT_STARTED.
 */

import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Package, X } from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag } from './rag.models';

import {
  DrawerComponent,
  ButtonComponent,
  InputComponent,
  TextareaComponent,
  AlertComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-rag-edit-drawer',
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
  ],
  template: `
    <ui-drawer [isOpen]="true" position="right" size="md" (closed)="onClose()">
      <div class="drawer-content">
        <!-- Header -->
        <div class="drawer-header">
          <div class="drawer-header__info">
            <lucide-icon [img]="icons.package" [size]="20"></lucide-icon>
            <div>
              <h2 class="drawer-title">Edit Rag / Bale</h2>
              <p class="drawer-subtitle">{{ rag().ragCode }}</p>
            </div>
          </div>
          <button class="drawer-close" (click)="onClose()" type="button">
            <lucide-icon [img]="icons.close" [size]="20"></lucide-icon>
          </button>
        </div>

        <!-- Status Warning -->
        @if (rag().status !== 'NOT_STARTED') {
          <ui-alert variant="warning">
            This rag cannot be edited because its status is "{{ rag().status }}".
          </ui-alert>
        }

        <!-- Error Alert -->
        @if (error()) {
          <ui-alert variant="danger" [dismissible]="true" (dismissed)="clearError()">
            {{ error() }}
          </ui-alert>
        }

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="drawer-form">
          <div class="form-field">
            <label class="field-label">Rag Code</label>
            <span class="field-value field-readonly">{{ rag().ragCode }}</span>
          </div>

          <div class="form-field">
            <ui-input
              formControlName="weightKg"
              label="Weight (KG)"
              type="number"
              placeholder="e.g., 500"
              [required]="true"
              [disabled]="rag().status !== 'NOT_STARTED'"
            ></ui-input>
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
              [disabled]="rag().status !== 'NOT_STARTED'"
            ></ui-textarea>
          </div>

          <!-- Info Fields (Read-only) -->
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Allocated Cost</span>
              <span class="info-value">\${{ rag().allocatedCost | number:'1.2-2' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Created</span>
              <span class="info-value">{{ rag().createdAt | date:'medium' }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="drawer-actions">
            <ui-button variant="ghost" type="button" (clicked)="onClose()">
              Cancel
            </ui-button>
            @if (rag().status === 'NOT_STARTED') {
              <ui-button
                variant="primary"
                type="submit"
                [disabled]="form.invalid || loading() || !form.dirty"
                [loading]="loading()"
              >
                Save Changes
              </ui-button>
            }
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
      font-family: var(--font-mono, ui-monospace, monospace);
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

    .field-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary, #111827);
    }

    .field-value {
      font-size: 0.875rem;
      color: var(--text-primary, #111827);
    }

    .field-readonly {
      padding: 0.5rem 0;
      font-family: var(--font-mono, ui-monospace, monospace);
      color: var(--text-secondary, #6b7280);
    }

    .field-error {
      font-size: 0.75rem;
      color: var(--color-danger, #dc2626);
    }

    .info-section {
      padding: 1rem;
      background: var(--bg-subtle, #f9fafb);
      border-radius: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
    }

    .info-label {
      color: var(--text-secondary, #6b7280);
    }

    .info-value {
      color: var(--text-primary, #111827);
      font-family: var(--font-mono, ui-monospace, monospace);
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
export class RagEditDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ragService = inject(RagService);

  // Inputs
  readonly rag = input.required<Rag>();

  // Outputs
  readonly updated = output<Rag>();
  readonly closed = output<void>();

  // Icons
  readonly icons = { package: Package, close: X };

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Form
  form!: FormGroup;

  ngOnInit(): void {
    const ragData = this.rag();
    this.form = this.fb.group({
      weightKg: [ragData.weightKg, [Validators.required, Validators.min(0.01)]],
      notes: [ragData.notes || ''],
    });
  }

  onSubmit(): void {
    if (this.form.invalid || !this.form.dirty) return;
    if (this.rag().status !== 'NOT_STARTED') return;

    this.loading.set(true);
    this.error.set(null);

    const { weightKg, notes } = this.form.value;

    this.ragService
      .updateRag(this.rag().id, { weightKg, notes: notes || undefined })
      .subscribe({
        next: (updatedRag) => {
          this.loading.set(false);
          this.updated.emit(updatedRag);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to update rag');
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
