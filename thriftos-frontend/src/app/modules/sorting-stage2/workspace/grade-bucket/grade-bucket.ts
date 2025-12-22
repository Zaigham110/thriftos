/**
 * Grade Bucket Component
 * Phase 4: Sorting Stage 2
 * 
 * Displays a grade bucket (G1/G2/G3) with weight and count inputs.
 * Same UI structure as category bucket from Phase 3.
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
import { LucideAngularModule, Award, Scale, Hash, Edit2, Check, X, Trash2 } from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';
import { GradeBucket, Grade } from '../../sorting-stage2.models';

export interface GradeBucketUpdate {
  bucketId: string;
  outputWeightKg: number;
  outputCount: number;
}

@Component({
  selector: 'app-grade-bucket',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
  ],
  template: `
    <ui-card 
      class="grade-bucket" 
      [class.grade-bucket--readonly]="!editable()"
      [class.grade-bucket--g1]="gradeRank() === 1"
      [class.grade-bucket--g2]="gradeRank() === 2"
      [class.grade-bucket--g3]="gradeRank() === 3"
    >
      <div class="grade-bucket__header">
        <div class="grade-bucket__title">
          <lucide-icon [img]="icons.award" [size]="18" class="grade-icon"></lucide-icon>
          <span>{{ gradeName() }}</span>
          <span class="grade-rank">{{ gradeRankLabel() }}</span>
        </div>
        @if (editable() && !isEditing()) {
          <div class="header-actions">
            <button class="edit-btn" (click)="startEdit()" title="Edit">
              <lucide-icon [img]="icons.edit" [size]="14"></lucide-icon>
            </button>
            <button class="delete-btn" (click)="onDelete()" title="Delete">
              <lucide-icon [img]="icons.trash" [size]="14"></lucide-icon>
            </button>
          </div>
        }
      </div>

      @if (!isEditing()) {
        <!-- Display Mode -->
        <div class="grade-bucket__stats">
          <div class="stat">
            <lucide-icon [img]="icons.scale" [size]="14"></lucide-icon>
            <span class="stat-value">{{ formatWeight(bucket()?.outputWeightKg) }} kg</span>
          </div>
          <div class="stat">
            <lucide-icon [img]="icons.hash" [size]="14"></lucide-icon>
            <span class="stat-value">{{ bucket()?.outputCount || 0 }}</span>
            <span class="stat-label">items</span>
          </div>
        </div>
      } @else {
        <!-- Edit Mode -->
        <div class="grade-bucket__form">
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
              <span class="field-hint">Max: {{ maxWeight().toFixed(2) }} kg</span>
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
              [disabled]="!isValid()"
              title="Save"
            >
              <lucide-icon [img]="icons.check" [size]="16"></lucide-icon>
            </button>
          </div>
        </div>
      }
    </ui-card>
  `,
  styles: [`
    @use '../../../../../styles/variables' as *;

    .grade-bucket {
      border: 2px solid $gray-200;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:hover:not(.grade-bucket--readonly) {
        border-color: $gray-300;
      }

      &--readonly {
        opacity: 0.85;
      }

      // Grade-specific colors
      &--g1 {
        border-color: $green-100;
        background: linear-gradient(135deg, rgba($status-success, 0.03), transparent);

        .grade-icon {
          color: $status-success;
        }
        .grade-rank {
          background-color: $green-100;
          color: $status-success;
        }
      }

      &--g2 {
        border-color: $yellow-100;
        background: linear-gradient(135deg, rgba($status-warning, 0.03), transparent);

        .grade-icon {
          color: $status-warning;
        }
        .grade-rank {
          background-color: $yellow-100;
          color: $yellow-700;
        }
      }

      &--g3 {
        border-color: $orange-100;
        background: linear-gradient(135deg, rgba($orange-600, 0.03), transparent);

        .grade-icon {
          color: $orange-600;
        }
        .grade-rank {
          background-color: $orange-100;
          color: $orange-600;
        }
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
        color: $gray-700;

        .grade-icon {
          color: $primary;
        }

        .grade-rank {
          font-size: 0.625rem;
          font-weight: 700;
          padding: 0.125rem 0.375rem;
          border-radius: $radius-sm;
          background-color: $gray-100;
          color: $gray-600;
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
            color: $gray-400;
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
              border-color: $primary;
              box-shadow: 0 0 0 2px rgba($primary, 0.1);
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

      .header-actions {
        display: flex;
        gap: 0.25rem;
      }

      .edit-btn,
      .delete-btn {
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

      .delete-btn:hover {
        background-color: $red-50;
        color: $status-danger;
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
export class GradeBucketComponent {
  readonly icons = {
    award: Award,
    scale: Scale,
    hash: Hash,
    edit: Edit2,
    check: Check,
    x: X,
    trash: Trash2,
  };

  // Inputs
  readonly bucket = input<GradeBucket | null>(null);
  readonly grade = input<Grade | null>(null);
  readonly editable = input<boolean>(true);
  readonly maxWeight = input<number>(1000);

  // Outputs
  readonly bucketUpdated = output<GradeBucketUpdate>();
  readonly bucketDeleted = output<string>();

  // Local state
  readonly isEditing = signal(false);
  editWeight = 0;
  editCount = 0;

  // Computed
  readonly gradeName = computed(() => this.grade()?.name || this.bucket()?.grade?.name || 'Unknown Grade');
  readonly gradeRank = computed(() => this.grade()?.rank || this.bucket()?.grade?.rank || 0);
  readonly gradeRankLabel = computed(() => `G${this.gradeRank()}`);

  readonly validationError = computed(() => {
    if (this.editWeight < 0) return 'Weight cannot be negative';
    if (this.editWeight > this.maxWeight()) return `Weight exceeds maximum (${this.maxWeight().toFixed(2)} kg)`;
    if (this.editCount < 0) return 'Count cannot be negative';
    return null;
  });

  readonly isValid = computed(() => {
    return !this.validationError() && this.editWeight >= 0 && this.editCount >= 0;
  });

  startEdit(): void {
    const b = this.bucket();
    this.editWeight = this.toNum(b?.outputWeightKg);
    this.editCount = b?.outputCount || 0;
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveEdit(): void {
    if (!this.isValid()) return;
    
    const bucketId = this.bucket()?.id;
    if (!bucketId) return;

    this.bucketUpdated.emit({
      bucketId,
      outputWeightKg: this.editWeight,
      outputCount: this.editCount,
    });
    this.isEditing.set(false);
  }

  onDelete(): void {
    const bucketId = this.bucket()?.id;
    if (bucketId) {
      this.bucketDeleted.emit(bucketId);
    }
  }

  formatWeight(val: number | string | null | undefined): string {
    const num = this.toNum(val);
    return num.toFixed(2);
  }

  private toNum(val: any): number {
    if (val === null || val === undefined) return 0;
    return typeof val === 'string' ? parseFloat(val) : val;
  }
}
