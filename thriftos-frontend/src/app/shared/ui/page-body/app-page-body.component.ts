import { Component } from '@angular/core';

/**
 * ===============================
 * APP-PAGE-BODY - LOCKED LAYOUT
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - Main scrollable content area
 * - Consistent padding
 * - Contains ONLY <app-section> components
 * 
 * CONTRACT:
 * - Flex: 1 (takes remaining height)
 * - Padding: var(--page-padding)
 * - Overflow: auto
 * - Gap between sections: var(--section-gap)
 * 
 * USAGE:
 * ```html
 * <app-page-body>
 *   <app-section>...</app-section>
 *   <app-section>...</app-section>
 * </app-page-body>
 * ```
 */
@Component({
  selector: 'app-page-body',
  standalone: true,
  template: `
    <div class="app-page-body">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-page-body.component.scss']
})
export class AppPageBodyComponent {}
