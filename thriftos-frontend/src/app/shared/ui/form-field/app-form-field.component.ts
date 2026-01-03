import { Component, Input } from '@angular/core';

/**
 * ===============================
 * APP-FORM-FIELD - LOCKED FORM FIELD
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - ALL form inputs MUST be wrapped in this component
 * - Consistent label, error, hint styling
 * - NO custom field layouts allowed
 * 
 * CONTRACT:
 * - Label: 13px, 500 weight, slate-900
 * - Required indicator: red asterisk
 * - Error text: 12px, red-600
 * - Hint text: 12px, slate-400
 * - Gap between elements: var(--space-sm)
 * 
 * USAGE:
 * ```html
 * <app-form-field
 *   label="Username"
 *   [required]="true"
 *   [error]="usernameError"
 *   hint="Must be unique"
 * >
 *   <input type="text" formControlName="username" />
 * </app-form-field>
 * ```
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  template: `
    <div class="app-form-field">
      @if (label) {
        <label class="field-label">
          {{ label }}
          @if (required) {
            <span class="required">*</span>
          }
        </label>
      }
      
      <div class="field-control">
        <ng-content />
      </div>
      
      @if (error) {
        <span class="field-error">{{ error }}</span>
      }
      
      @if (hint && !error) {
        <span class="field-hint">{{ hint }}</span>
      }
    </div>
  `,
  styleUrls: ['./app-form-field.component.scss']
})
export class AppFormFieldComponent {
  @Input() label?: string;
  @Input() required = false;
  @Input() error?: string;
  @Input() hint?: string;
}
