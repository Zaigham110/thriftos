import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-angular';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'ui-alert',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertComponent {
  readonly variant = input<AlertVariant>('info');
  readonly title = input<string>('');
  readonly dismissible = input<boolean>(false);

  readonly dismissed = output<void>();

  protected readonly icons = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    danger: AlertCircle,
    close: X,
  };

  get alertClasses(): string {
    return `alert alert-${this.variant()}`;
  }

  get icon() {
    return this.icons[this.variant()];
  }

  dismiss(): void {
    this.dismissed.emit();
  }
}
