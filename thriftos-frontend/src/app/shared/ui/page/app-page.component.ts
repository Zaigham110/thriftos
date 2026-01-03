import { Component } from '@angular/core';

/**
 * ===============================
 * APP-PAGE - ROOT LAYOUT PRIMITIVE
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - ALL screens MUST use this component as root
 * - Provides consistent page-level spacing and background
 * - NO custom wrappers allowed
 * 
 * CONTRACT:
 * - Full viewport height
 * - Consistent padding: var(--page-padding)
 * - Background: var(--app-bg-page)
 * - Contains: <app-page-header> + <app-page-body>
 * 
 * USAGE:
 * ```html
 * <app-page>
 *   <app-page-header />
 *   <app-page-body>
 *     <app-section>...</app-section>
 *   </app-page-body>
 * </app-page>
 * ```
 */
@Component({
  selector: 'app-page',
  standalone: true,
  template: `
    <div class="app-page">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-page.component.scss']
})
export class AppPageComponent {}
