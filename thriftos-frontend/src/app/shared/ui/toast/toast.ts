import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-angular';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

@Component({
  selector: 'ui-toast',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
  readonly variant = input<ToastVariant>('info');
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly dismissible = input<boolean>(true);

  readonly dismissed = output<void>();

  protected readonly icons = {
    success: CheckCircle,
    danger: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    close: X,
  };

  get icon() {
    return this.icons[this.variant()];
  }

  get toastClasses(): string {
    return `toast toast-${this.variant()}`;
  }

  dismiss(): void {
    this.dismissed.emit();
  }
}
