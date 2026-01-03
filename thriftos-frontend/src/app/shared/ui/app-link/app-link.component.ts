import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

/**
 * app-link - Text Link Primitive
 * 
 * Odoo-Style Design System
 * Usage: Navigation links, secondary actions
 * 
 * @example
 * <app-link href="/forgot-password">Forgot password?</app-link>
 * <app-link [routerLink]="'/help'">Need help?</app-link>
 * <app-link [routerLink]="['/users', userId]">View user</app-link>
 */
@Component({
  selector: 'app-link',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a 
      [routerLink]="routerLink() ?? null"
      [href]="routerLink() ? null : href()"
      [target]="target()"
      class="app-link"
    >
      <ng-content></ng-content>
    </a>
  `,
  styles: [`
    .app-link {
      font-size: var(--font-size-sm);
      color: var(--app-text-secondary);
      text-decoration: none;
      transition: color 0.12s ease;
      cursor: pointer;

      &:hover {
        color: var(--app-primary);
        text-decoration: underline;
      }

      &:active {
        color: var(--app-primary);
      }
    }
  `]
})
export class AppLinkComponent {
  href = input<string>('#');
  routerLink = input<string | any[]>();
  target = input<'_self' | '_blank'>('_self');
}
