import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="app-badge" [class]="'badge-' + variant"><ng-content /></span>`,
  styleUrl: './app-badge.component.scss'
})
export class AppBadgeComponent {
  @Input() variant: BadgeVariant = 'default';
}
