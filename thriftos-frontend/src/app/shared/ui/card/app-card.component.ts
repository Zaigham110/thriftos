import { Component, Input } from '@angular/core';

/**
 * ===============================
 * APP-CARD - LOCKED CONTAINER
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - Only 2 variants allowed: 'data' | 'info'
 * - Consistent padding and border
 * - NO custom styling allowed
 * 
 * CONTRACT:
 * - Background: var(--app-bg-surface)
 * - Border: 1px solid var(--app-border-subtle)
 * - Border radius: var(--border-radius)
 * - Padding: var(--card-padding)
 * - Shadow: var(--shadow-sm)
 * 
 * VARIANTS:
 * - 'data' (default): For tables, forms, content
 * - 'info': For informational content, help text
 * 
 * USAGE:
 * ```html
 * <app-card variant="data">
 *   <app-table>...</app-table>
 * </app-card>
 * 
 * <app-card variant="info">
 *   <p>Information text here</p>
 * </app-card>
 * ```
 */
@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div class="app-card" [attr.data-variant]="variant">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-card.component.scss']
})
export class AppCardComponent {
  @Input() variant: 'data' | 'info' = 'data';
}
