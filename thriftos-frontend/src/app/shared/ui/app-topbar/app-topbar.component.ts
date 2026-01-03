import { Component } from '@angular/core';

/**
 * app-topbar - Top Bar Primitive
 * 
 * Odoo-Style Design System
 * Contextual information bar at the top of the shell
 * 
 * Structure:
 * - Projects content into left and right slots
 * - Fixed height, minimal padding
 * - Subtle border bottom
 * 
 * @example
 * <app-topbar>
 *   <div slot="left">Module Name</div>
 *   <div slot="right">Tenant + User Menu</div>
 * </app-topbar>
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  template: `
    <div class="topbar">
      <div class="topbar-left">
        <ng-content select="[slot='left']" />
      </div>
      <div class="topbar-right">
        <ng-content select="[slot='right']" />
      </div>
    </div>
  `,
  styles: [`
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      min-height: 56px;
      padding: 0 var(--space-lg);
      background: var(--app-bg-surface);
      border-bottom: 1px solid var(--app-border-subtle);
      position: relative;
      z-index: 10;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      min-width: 0;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }
  `]
})
export class AppTopbarComponent {}
