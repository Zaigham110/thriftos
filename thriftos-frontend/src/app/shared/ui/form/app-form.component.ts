import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

/**
 * ===============================
 * APP-FORM - LOCKED FORM CONTAINER
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - ALL forms MUST use this wrapper
 * - Consistent spacing between fields
 * - Contains ONLY <app-form-field> components
 * 
 * CONTRACT:
 * - Display: flex column
 * - Gap: var(--space-lg)
 * - Max width: 600px (for optimal readability)
 * 
 * USAGE:
 * ```html
 * <app-form>
 *   <app-form-field label="Name" [required]="true">
 *     <input type="text" />
 *   </app-form-field>
 *   
 *   <app-form-field label="Email">
 *     <input type="email" />
 *   </app-form-field>
 *   
 *   <div class="form-actions">
 *     <app-button variant="primary">Submit</app-button>
 *     <app-button variant="secondary">Cancel</app-button>
 *   </div>
 * </app-form>
 * ```
 */
@Component({
  selector: 'app-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form class="app-form" [formGroup]="formGroup" (ngSubmit)="submitted.emit()">
      @if (title) {
        <div class="app-form-header">
          <div class="app-form-title">{{ title }}</div>
          @if (subtitle) {
            <div class="app-form-subtitle">{{ subtitle }}</div>
          }
        </div>
      }

      <ng-content />
    </form>
  `,
  styleUrls: ['./app-form.component.scss']
})
export class AppFormComponent {
  @Input({ required: true }) formGroup!: FormGroup;
  @Input() title: string | null = null;
  @Input() subtitle: string | null = null;

  @Output() submitted = new EventEmitter<void>();
}
