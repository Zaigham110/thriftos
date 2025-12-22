import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';

import { ModalComponent } from '../modal/modal';
import { ButtonComponent } from '../button/button';

export type ConfirmVariant = 'primary' | 'danger';

@Component({
  selector: 'ui-confirm-dialog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ModalComponent, ButtonComponent],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Confirm');
  readonly message = input<string>('Are you sure?');
  readonly confirmText = input<string>('Confirm');
  readonly cancelText = input<string>('Cancel');
  readonly confirmVariant = input<ConfirmVariant>('primary');
  readonly loading = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly warningIcon = AlertTriangle;

  onConfirm(): void {
    if (!this.loading()) {
      this.confirmed.emit();
    }
  }

  onCancel(): void {
    if (!this.loading()) {
      this.cancelled.emit();
    }
  }
}
