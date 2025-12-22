import { ChangeDetectionStrategy, Component, input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { LucideAngularModule, Check } from 'lucide-angular';

@Component({
  selector: 'ui-checkbox',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
})
export class CheckboxComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly id = input<string>(`checkbox-${Math.random().toString(36).substr(2, 9)}`);

  protected checked = signal<boolean>(false);
  protected isDisabled = signal<boolean>(false);
  protected readonly checkIcon = Check;

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: boolean): void {
    this.checked.set(value || false);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  toggle(): void {
    if (!this.disabled() && !this.isDisabled()) {
      const newValue = !this.checked();
      this.checked.set(newValue);
      this.onChange(newValue);
      this.onTouched();
    }
  }
}
