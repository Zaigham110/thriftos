import { CommonModule } from '@angular/common';
import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AppIconComponent } from '../app-icon/app-icon.component';

/**
 * app-password-input - Password Input Primitive
 * 
 * Odoo-Style Design System
 * Password input with show/hide toggle
 * 
 * @example
 * <app-password-input 
 *   placeholder="Enter password"
 *   [(ngModel)]="password" 
 * />
 */
@Component({
  selector: 'app-password-input',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <div class="password-input-wrapper">
      <input
        [type]="showPassword() ? 'text' : 'password'"
        [placeholder]="placeholder"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()"
        [disabled]="disabled"
        class="password-input"
      />
      <button
        type="button"
        class="toggle-password"
        (click)="togglePassword()"
        [disabled]="disabled"
        [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
      >
        <app-icon
          [name]="showPassword() ? 'eye-off' : 'eye'"
          size="sm"
        />
      </button>
    </div>
  `,
  styles: [`
    .password-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-input {
      width: 100%;
      height: 36px;
      padding: var(--space-sm) var(--space-md);
      padding-right: 40px;
        border: 1px solid var(--app-border-subtle);
        border-radius: var(--border-radius-sm);
      font-size: var(--font-size-sm);
      font-family: inherit;
      color: var(--app-text-primary);
        background: var(--app-bg-surface);
      transition: all 0.12s ease;

      &::placeholder {
        color: var(--app-text-muted);
      }

      &:hover {
        border-color: var(--app-text-muted);
      }

      &:focus {
        outline: none;
        border-color: var(--app-primary);
        box-shadow: 0 0 0 3px var(--app-primary-light);
      }

      &:disabled {
        background: var(--app-bg-subtle);
        cursor: not-allowed;
        opacity: 0.6;
      }
    }

    .toggle-password {
      position: absolute;
      right: var(--space-sm);
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-xs);
      color: var(--app-text-muted);
      transition: color 0.12s ease;

      &:hover:not(:disabled) {
        color: var(--app-text-secondary);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
      }
    }
  `]
  ,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppPasswordInputComponent),
      multi: true,
    },
  ]
})
export class AppPasswordInputComponent implements ControlValueAccessor {
  @Input() placeholder: string = '';

  value: string = '';
  disabled: boolean = false;

  private readonly _showPassword = signal<boolean>(false);

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  showPassword(): boolean {
    return this._showPassword();
  }

  togglePassword(): void {
    this._showPassword.set(!this._showPassword());
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.onChange(this.value);
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
