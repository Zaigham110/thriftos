/**
 * Totals Panel Component
 * Phase 3: Category Sorting UI
 * 
 * Displays read-only sorting totals with yield percentage
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Scale, Package, TrendingUp, AlertTriangle } from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui';
import { SortingTotals } from '../../sorting-stage1.models';

@Component({
  selector: 'app-totals-panel',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    CardComponent,
  ],
  templateUrl: './totals-panel.html',
  styleUrl: './totals-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TotalsPanelComponent {
  // Inputs
  readonly inputWeight = input.required<number>();
  readonly totals = input.required<SortingTotals>();

  // Icons
  readonly icons = {
    scale: Scale,
    package: Package,
    trending: TrendingUp,
    warning: AlertTriangle,
  };

  // Computed
  readonly isOverAllocated = computed(() => {
    return this.totals().yieldPercentage > 100;
  });

  readonly remainingWeight = computed(() => {
    const input = this.inputWeight();
    const sorted = this.totals().totalSortedWeight;
    return Math.max(0, input - sorted);
  });

  readonly yieldBarWidth = computed(() => {
    return Math.min(this.totals().yieldPercentage, 100);
  });

  formatWeight(kg: number): string {
    return kg.toFixed(2);
  }

  formatPercentage(value: number): string {
    return value.toFixed(1);
  }
}
