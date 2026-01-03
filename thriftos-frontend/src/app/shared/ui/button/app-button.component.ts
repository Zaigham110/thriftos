import { Component, Input, Output, EventEmitter } from '@angular/core';

/**
 * ===============================
 * APP-BUTTON - LOCKED BUTTON PRIMITIVE
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - ONLY 3 variants allowed: 'primary' | 'secondary' | 'danger'
 * - Consistent sizing, padding, colors
 * - NO custom button styling allowed
 * 
 * CONTRACT:
 * - Height: 36px
 * - Padding: 0 16px
 * - Font: 14px, 500 weight
 * - Border radius: var(--border-radius-sm)
 * - Transition: 0.15s ease
 * 
 * VARIANTS:
 * - 'primary': Blue background, white text - main actions
 * - 'secondary': White background, gray text - alternative actions
 * - 'danger': Red background, white text - destructive actions
 * 
 * USAGE:
 * ```html
 * <app-button variant="primary" (click)="save()">
 *   Save Changes
 * </app-button>
 * 
 * <app-button variant="secondary" (click)="cancel()">
 *   Cancel
 * </app-button>
 * 
 * <app-button variant="danger" [disabled]="!canDelete" (click)="delete()">
 *   Delete
 * </app-button>
 * ```
 */
@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      class="app-button"
      [attr.data-variant]="variant"
      [disabled]="disabled"
      [type]="type"
      (click)="handleClick($event)"
    >
      <ng-content />
    </button>
  `,
  styleUrls: ['./app-button.component.scss']
})
export class AppButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Output() clickEvent = new EventEmitter<MouseEvent>();

  handleClick(event: MouseEvent): void {
    if (!this.disabled) {
      this.clickEvent.emit(event);
    }
  }
}
