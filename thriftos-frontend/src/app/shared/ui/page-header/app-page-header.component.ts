import { Component } from '@angular/core';

/**
 * ===============================
 * APP-PAGE-HEADER - LOCKED LAYOUT
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - Contains page title + optional actions
 * - Consistent height and padding
 * - NO custom styling allowed
 * 
 * CONTRACT:
 * - Height: 64px
 * - Padding: var(--page-padding)
 * - Background: var(--app-bg-surface)
 * - Border bottom: var(--app-border-subtle)
 * 
 * USAGE:
 * ```html
 * <app-page-header>
 *   <h1 class="page-title">Page Title</h1>
 *   <div class="actions">
 *     <app-button>Action</app-button>
 *   </div>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="app-page-header">
      <ng-content />
    </header>
  `,
  styleUrls: ['./app-page-header.component.scss']
})
export class AppPageHeaderComponent {}
