import { ChangeDetectionStrategy, Component, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly size = input<ModalSize>('md');
  readonly closable = input<boolean>(true);
  readonly closeOnBackdrop = input<boolean>(true);
  readonly closeOnEscape = input<boolean>(true);

  readonly closed = output<void>();

  protected readonly closeIcon = X;

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isOpen() && this.closeOnEscape() && this.closable()) {
      this.close();
    }
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop() && this.closable()) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  get modalClasses(): string {
    return `modal-content modal-${this.size()}`;
  }
}
