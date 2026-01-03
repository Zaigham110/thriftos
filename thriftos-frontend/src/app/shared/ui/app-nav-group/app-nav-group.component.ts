import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../app-icon/app-icon.component';
import { AppNavItemComponent } from '../app-nav-item/app-nav-item.component';

export interface AppNavGroupItem {
  id: string;
  label: string;
  route: string;
  icon: string;
}

/**
 * app-nav-group
 * Collapsible sidebar group. Expansion state is controlled by parent (app-sidebar).
 */
@Component({
  selector: 'app-nav-group',
  standalone: true,
  imports: [CommonModule, AppIconComponent, AppNavItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nav-group" [class.expanded]="expanded">
      <button class="nav-group-header" type="button" (click)="toggle.emit(id)">
        <div class="nav-group-left">
          <app-icon [name]="icon" size="sm" />
          <span class="nav-group-label">{{ label }}</span>
        </div>
        <app-icon [name]="expanded ? 'chevron-down' : 'chevron-right'" size="sm" />
      </button>

      @if (expanded) {
        <div class="nav-group-items">
          @for (item of items; track item.id) {
            <app-nav-item
              [label]="item.label"
              [route]="item.route"
              [icon]="item.icon"
              [exact]="false"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .nav-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .nav-group-header {
        width: 100%;
        border: none;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-sm);
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        color: var(--app-text-secondary);
        font-size: var(--font-size-table-header);
        font-weight: var(--font-weight-table-header);
      }

      .nav-group-header:hover {
        background: var(--app-bg-page);
        color: var(--app-text-primary);
      }

      .nav-group-header:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--app-primary-light);
      }

      .nav-group.expanded .nav-group-header {
        color: var(--app-text-primary);
        background: var(--app-bg-page);
      }

      .nav-group-left {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        min-width: 0;
      }

      .nav-group-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .nav-group-items {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        margin-left: var(--space-sm);
        padding-left: var(--space-sm);
        border-left: 1px solid var(--app-border-subtle);
      }
    `,
  ],
})
export class AppNavGroupComponent {
  @Input({ required: true }) id!: string;
  @Input({ required: true }) label!: string;
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) items: AppNavGroupItem[] = [];
  @Input() expanded = false;

  @Output() toggle = new EventEmitter<string>();
}
