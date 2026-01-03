import { Component } from '@angular/core';

/**
 * ===============================
 * APP-SECTION - LOCKED LAYOUT
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - Logical content grouping within a page
 * - Consistent spacing between header and body
 * - NO custom layout allowed
 * 
 * CONTRACT:
 * - Display: flex column
 * - Gap: var(--space-lg)
 * - Contains: <app-section-header> + <app-section-body>
 * 
 * USAGE:
 * ```html
 * <app-section>
 *   <app-section-header>
 *     <h2 class="section-title">Section Title</h2>
 *   </app-section-header>
 *   <app-section-body>
 *     <app-card>...</app-card>
 *   </app-section-body>
 * </app-section>
 * ```
 */
@Component({
  selector: 'app-section',
  standalone: true,
  template: `
    <section class="app-section">
      <ng-content />
    </section>
  `,
  styleUrls: ['./app-section.component.scss']
})
export class AppSectionComponent {}
