/**
 * Category Bucket Component
 * Phase 3: Category Sorting UI
 * 
 * Displays a single category bucket with weight/quantity inputs
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Scale, Hash, Trash2, Save, X, Edit2 } from 'lucide-angular';

import { CardComponent, ButtonComponent } from '../../../../shared/ui';
import { SortCategoryBucket } from '../../sorting-stage1.models';

@Component({
  selector: 'app-category-bucket',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
  ],
  templateUrl: './category-bucket.html',
  styleUrl: './category-bucket.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBucketComponent {
  // Inputs
  readonly bucket = input.required<SortCategoryBucket>();
  readonly editable = input<boolean>(true);
  readonly isWaste = input<boolean>(false);

  // Outputs
  readonly update = output<{ weightKg: number; count: number }>();
  readonly delete = output<void>();

  // Icons
  readonly icons = {
    scale: Scale,
    hash: Hash,
    trash: Trash2,
    save: Save,
    close: X,
    edit: Edit2,
  };

  // Edit state
  readonly isEditing = signal(false);
  readonly editWeight = signal(0);
  readonly editCount = signal(0);

  startEdit(): void {
    const b = this.bucket();
    this.editWeight.set(b.outputWeightKg);
    this.editCount.set(b.outputCount);
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveEdit(): void {
    this.update.emit({
      weightKg: this.editWeight(),
      count: this.editCount(),
    });
    this.isEditing.set(false);
  }

  onWeightChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.editWeight.set(value);
  }

  onCountChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value) || 0;
    this.editCount.set(value);
  }

  confirmDelete(): void {
    this.delete.emit();
  }

  getCategoryName(): string {
    return this.bucket().category?.name || 'Unknown';
  }

  formatWeight(kg: number): string {
    return kg.toFixed(2);
  }
}
