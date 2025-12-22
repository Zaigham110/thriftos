/**
 * Quantity Input Component
 * Phase 3: Category Sorting UI
 * 
 * Standardized quantity/count input with item suffix
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Package } from 'lucide-angular';

@Component({
  selector: 'app-quantity-input',
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
          <lucide-icon [img]="packageIcon" [size]="16" class="text-slate-400 flex-shrink-0"></lucide-icon>
        }
        <input
          type="number"
          [value]="value()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [min]="min()"
          [max]="max()"
          [step]="1"
          (input)="onInput($event)"
          (blur)="onBlur()"
          class="flex-1 min-w-0 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span class="text-sm font-medium text-slate-500 flex-shrink-0">{{ suffix() }}</span>
      </div>
      @if (error()) {
        <span class="text-xs text-red-600">{{ error() }}</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuantityInputComponent {
  // Inputs
  readonly value = input<number>(0);
  readonly placeholder = input<string>('0');
  readonly disabled = input<boolean>(false);
  readonly min = input<number>(0);
  readonly max = input<number | null>(null);
  readonly suffix = input<string>('items');
  readonly showIcon = input<boolean>(true);
  readonly error = input<string | null>(null);

  // Outputs
  readonly valueChange = output<number>();

  // Icons
  readonly packageIcon = Package;

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10) || 0;
    this.valueChange.emit(value);
  }

  onBlur(): void {
    // Could add validation or formatting on blur
  }
}
