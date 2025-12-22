import { ChangeDetectionStrategy, Component, input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

export interface RadioOption {
  value: string | number;
  label: string;
  hint?: string;
  disabled?: boolean;
}

@Component({
  selector: 'ui-radio-group',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './radio.html',
  styleUrl: './radio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioComponent),
      multi: true,
    },
  ],
})
export class RadioComponent implements ControlValueAccessor {
  readonly options = input<RadioOption[]>([]);
  readonly label = input<string>('');
  readonly name = input<string>(`radio-${Math.random().toString(36).substr(2, 9)}`);
  readonly disabled = input<boolean>(false);
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');

  protected value = signal<string | number>('');
  protected isDisabled = signal<boolean>(false);

  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number): void {
    this.value.set(value || '');
  }

  registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  selectOption(optionValue: string | number): void {
    if (!this.disabled() && !this.isDisabled()) {
      this.value.set(optionValue);
      this.onChange(optionValue);
      this.onTouched();
    }
  }

  isSelected(optionValue: string | number): boolean {
    return this.value() === optionValue;
  }
}
