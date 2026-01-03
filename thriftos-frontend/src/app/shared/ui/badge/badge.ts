import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'secondary'
  | 'outline'
  | 'destructive';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'ui-badge, app-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.html',
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('default');
  readonly size = input<BadgeSize>('md');

  get badgeClasses(): string {
    const mappedVariant = this.mapVariant(this.variant());
    return `badge badge-${mappedVariant} badge-${this.size()}`;
  }

  private mapVariant(variant: BadgeVariant): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
    switch (variant) {
      case 'secondary':
      case 'outline':
        return 'default';
      case 'destructive':
        return 'danger';
      default:
        return variant;
    }
  }
}
