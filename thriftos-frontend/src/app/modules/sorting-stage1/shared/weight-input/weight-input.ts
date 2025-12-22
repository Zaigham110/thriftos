/**
 * Weight Input Component
 * Phase 3: Category Sorting UI
 * 
 * Standardized weight input with kg unit suffix
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Scale } from 'lucide-angular';

@Component({
  selector: 'app-weight-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
  ],
  template: `
    <div class="flex flex-col gap-1" [class.opacity-60]="disabled()">
      <div 
        class="flex items-center gap-2 px-3 py-2 bg-white border rounded-md transition-colors"
        [class.border-slate-300]="!error()"
        [class.border-red-500]="error()"
        [class.focus-within:border-blue-500]="!error()"
        [class.focus-within:ring-2]="true"
        [class.focus-within:ring-blue-100]="!error()"
        [class.focus-within:ring-red-100]="error()"
      >
        @if (showIcon()) {
          <lucide-icon [img]="scaleIcon" [size]="16" class="text-slate-400 flex-shrink-0"></lucide-icon>
        }
        <input
          type="number"
          [value]="value()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [min]="min()"
          [max]="max()"
          [step]="step()"
          (input)="onInput($event)"
          (blur)="onBlur()"
          class="flex-1 min-w-0 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span class="text-sm font-medium text-slate-500 flex-shrink-0">kg</span>
      </div>
      @if (error()) {
        <span class="text-xs text-red-600">{{ error() }}</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightInputComponent {
  readonly value = input<number>(0);
  readonly placeholder = input<string>('0.00');
  readonly disabled = input<boolean>(false);
  readonly min = input<number>(0);
  readonly max = input<number | null>(null);
  readonly step = input<number>(0.01);
  readonly showIcon = input<boolean>(true);
  readonly error = input<string | null>(null);

  readonly valueChange = output<number>();

  readonly scaleIcon = Scale;

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value) || 0;
    this.valueChange.emit(value);
  }

  onBlur(): void {
    // Could add validation or formatting on blur
  }
}
