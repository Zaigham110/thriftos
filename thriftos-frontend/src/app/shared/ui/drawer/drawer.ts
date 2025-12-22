import { ChangeDetectionStrategy, Component, input, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

export type DrawerPosition = 'left' | 'right';
export type DrawerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-drawer',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './drawer.html',
  styleUrl: './drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly position = input<DrawerPosition>('right');
  readonly size = input<DrawerSize>('md');
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

  get drawerClasses(): string {
    return `drawer-panel drawer-${this.position()} drawer-${this.size()}`;
  }
}
