import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-angular';

export type AlertVariant =
  | 'default'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'destructive';

@Component({
  selector: 'ui-alert, app-alert',
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
    destructive: AlertCircle,
    close: X,
  };

  get alertClasses(): string {
    const variant =
      this.variant() === 'destructive' ? 'danger' : this.variant() === 'default' ? 'info' : this.variant();
    return `alert alert-${variant}`;
  }

  get icon() {
    const key = (this.variant() === 'default' ? 'info' : this.variant()) as Exclude<
      AlertVariant,
      'default'
    >;
    return this.icons[key];
  }

  dismiss(): void {
    this.dismissed.emit();
  }
}
