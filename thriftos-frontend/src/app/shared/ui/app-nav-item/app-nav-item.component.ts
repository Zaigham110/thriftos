import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppIconComponent } from '../app-icon/app-icon.component';

export type NavItemIconName = string;

/**
 * app-nav-item
 * Sidebar navigation item using lucide icons via <app-icon name="..." />.
 */
@Component({
  selector: 'app-nav-item',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="nav-item"
      [routerLink]="route"
      routerLinkActive="active"
      [routerLinkActiveOptions]="{ exact: exact }"
    >
      <app-icon [name]="icon" size="sm" />
      <span class="nav-label">{{ label }}</span>
    </a>
  `,
  styles: [
    `
      .nav-item {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        width: 100%;
        text-decoration: none;
        border-radius: var(--border-radius-sm);
        padding: var(--space-sm);
        color: var(--app-text-secondary);
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-table-header);
      }

      .nav-item:hover {
        background: var(--app-bg-page);
        color: var(--app-text-primary);
      }

      .nav-item:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--app-primary-light);
      }

      .nav-item.active {
        background: var(--app-primary-light);
        color: var(--app-text-primary);
        font-weight: var(--font-weight-section-title);
      }

      .nav-item.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 6px;
        bottom: 6px;
        width: 3px;
        background: var(--app-primary);
        border-radius: 999px;
      }

      .nav-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class AppNavItemComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) route!: string;
  @Input({ required: true }) icon!: NavItemIconName;
  @Input() exact = false;
}
