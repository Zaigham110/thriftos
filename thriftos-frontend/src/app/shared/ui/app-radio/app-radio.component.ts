import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-radio',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="app-radio">
      <input
        type="radio"
        [name]="name"
        [value]="optionValue"
        [checked]="isChecked"
        [disabled]="disabled"
        (change)="onSelect()"
        (blur)="onTouched()"
      />
      <span class="radio-label">
        <ng-content />
      </span>
    </label>
  `,
  styleUrl: './app-radio.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppRadioComponent),
      multi: true
    }
  ]
})
export class AppRadioComponent implements ControlValueAccessor {
  @Input() name: string = '';
  @Input() optionValue: string | number = '';
  @Input() disabled: boolean = false;

  value: string | number = '';
  onChange: (value: string | number) => void = () => {};
  onTouched: () => void = () => {};

  get isChecked(): boolean {
    return this.value === this.optionValue;
  }

  onSelect(): void {
    this.value = this.optionValue;
    this.onChange(this.value);
  }

  writeValue(value: string | number): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
