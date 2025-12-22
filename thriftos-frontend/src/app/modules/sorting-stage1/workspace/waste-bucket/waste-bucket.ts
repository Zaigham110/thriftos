/**
 * Waste Bucket Component
 * Phase 3: Sorting Stage 1
 * 
 * Mandatory waste capture bucket with muted danger accent.
 * Same UI structure as category bucket but visually distinct.
 */

import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Trash2, Scale, Edit2, Check, X, Hash } from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';

export interface WasteData {
  weightKg: number;
  count: number;
}

@Component({
  selector: 'app-waste-bucket',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
  ],
  template: `
    <ui-card class="waste-bucket" [class.waste-bucket--readonly]="!editable()">
      <div class="waste-bucket__header">
        <div class="waste-bucket__title">
          <lucide-icon [img]="icons.trash" [size]="18" class="waste-icon"></lucide-icon>
          <span>Waste</span>
        </div>
        @if (editable() && !isEditing()) {
          <button class="edit-btn" (click)="startEdit()" title="Edit waste">
            <lucide-icon [img]="icons.edit" [size]="14"></lucide-icon>
          </button>
        }
      </div>

      @if (isEditing()) {
        <!-- Edit Mode -->
        <div class="waste-bucket__form">
          <div class="form-row">
            <div class="form-field">
              <label>Weight (kg)</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="editWeight"
                min="0"
                step="0.01"
                [max]="maxWeight()"
              />
              <span class="field-hint">Max: {{ formatWeight(maxWeight()) }} kg</span>
            </div>
            <div class="form-field">
              <label>Count</label>
              <input
                type="number"
                class="form-input"
                [(ngModel)]="editCount"
                min="0"
                step="1"
              />
            </div>
          </div>

          @if (validationError()) {
            <div class="validation-error">{{ validationError() }}</div>
          }

          <div class="form-actions">
            <button class="icon-btn" (click)="cancelEdit()" title="Cancel">
              <lucide-icon [img]="icons.x" [size]="16"></lucide-icon>
            </button>
            <button 
              class="icon-btn icon-btn--success" 
              (click)="saveEdit()" 
              [disabled]="!!validationError()"
              title="Save"
            >
              <lucide-icon [img]="icons.check" [size]="16"></lucide-icon>
            </button>
          </div>
        </div>
      } @else {
        <!-- View Mode -->
        <div class="waste-bucket__stats">
          <div class="stat">
            <lucide-icon [img]="icons.scale" [size]="14"></lucide-icon>
            <span class="stat-value">{{ formatWeight(wasteWeight()) }} kg</span>
          </div>
          <div class="stat">
            <span class="stat-label">Count:</span>
            <span class="stat-value">{{ wasteCount() }}</span>
          </div>
        </div>
      }
    </ui-card>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;

    .waste-bucket {
      border: 2px solid $red-100;
      background-color: rgba($status-danger, 0.03);

      &--readonly {
        opacity: 0.8;
      }

      &__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
      }

      &__title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: $status-danger;

        .waste-icon {
          color: $status-danger;
        }
      }

      &__stats {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        .stat {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: $gray-700;

          lucide-icon {
            color: $red-600;
          }

          .stat-value {
            font-weight: 600;
            font-family: $font-family-mono;
          }

          .stat-label {
            color: $gray-500;
          }
        }
      }

      &__form {
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;

          label {
            font-size: 0.75rem;
            font-weight: 500;
            color: $gray-600;
          }

          .form-input {
            padding: 0.5rem;
            border: 1px solid $gray-300;
            border-radius: $radius-sm;
            font-size: 0.875rem;
            font-family: $font-family-mono;

            &:focus {
              outline: none;
              border-color: $status-danger;
              box-shadow: 0 0 0 2px rgba($status-danger, 0.1);
            }
          }

          .field-hint {
            font-size: 0.7rem;
            color: $gray-400;
          }
        }

        .validation-error {
          font-size: 0.75rem;
          color: $status-danger;
          margin-bottom: 0.5rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
      }

      .edit-btn {
        padding: 0.375rem;
        border: none;
        background: transparent;
        border-radius: $radius-sm;
        color: $gray-400;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background-color: $gray-100;
          color: $gray-600;
        }
      }

      .icon-btn {
        padding: 0.375rem;
        border: none;
        background: $gray-100;
        border-radius: $radius-sm;
        color: $gray-600;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background-color: $gray-200;
        }

        &--success {
          background: $green-100;
          color: $status-success;

          &:hover {
            background: $status-success;
            color: white;
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WasteBucketComponent {
  // Inputs
  readonly wasteWeight = input<number>(0);
  readonly wasteCount = input<number>(0);
  readonly editable = input<boolean>(true);
  readonly maxWeight = input<number>(0);

  // Outputs
  readonly wasteChanged = output<WasteData>();

  // Icons
  readonly icons = {
    trash: Trash2,
    scale: Scale,
    edit: Edit2,
    check: Check,
    x: X,
  };

  // Edit state
  isEditing = signal(false);
  editWeight = 0;
  editCount = 0;

  // Validation
  validationError = computed(() => {
    if (this.isEditing() && this.editWeight > this.maxWeight()) {
      return `Weight exceeds maximum available (${this.formatWeight(this.maxWeight())} kg)`;
    }
    return null;
  });

  startEdit(): void {
    this.editWeight = this.wasteWeight();
    this.editCount = this.wasteCount();
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveEdit(): void {
    if (this.validationError()) return;

    this.wasteChanged.emit({
      weightKg: this.editWeight,
      count: this.editCount,
    });
    this.isEditing.set(false);
  }

  formatWeight(kg: number): string {
    return (kg || 0).toFixed(2);
  }
}
