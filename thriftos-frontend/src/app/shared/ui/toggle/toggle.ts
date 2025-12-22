import { ChangeDetectionStrategy, Component, input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'ui-toggle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './toggle.html',
  styleUrl: './toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ToggleComponent),
      multi: true,
    },
  ],
})
export class ToggleComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly id = input<string>(`toggle-${Math.random().toString(36).substr(2, 9)}`);

  protected checked = signal<boolean>(false);
  protected isDisabled = signal<boolean>(false);

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
