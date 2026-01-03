import { Component } from '@angular/core';

/**
 * ===============================
 * APP-SECTION-HEADER - LOCKED LAYOUT
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - Contains section title + optional actions
 * - Consistent spacing
 * - NO custom styling allowed
 * 
 * CONTRACT:
 * - Display: flex row (space-between)
 * - Align items: center
 * 
 * USAGE:
 * ```html
 * <app-section-header>
 *   <h2 class="section-title">Section Title</h2>
 *   <div class="actions">
 *     <app-button>Action</app-button>
 *   </div>
 * </app-section-header>
 * ```
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  template: `
    <div class="app-section-header">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-section-header.component.scss']
})
export class AppSectionHeaderComponent {}
