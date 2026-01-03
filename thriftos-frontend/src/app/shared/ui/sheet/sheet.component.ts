import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { cn } from '../utils/cn';

export type SheetSide = 'left' | 'right';

@Component({
  selector: 'app-sheet-content, ui-sheet-content',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" (click)="close()"></div>
      <div [class]="panelClasses">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetContentComponent implements OnInit {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly hostClass = signal<string>('');

  readonly side = input<SheetSide>('right');
  readonly closed = output<void>();

  ngOnInit(): void {
    this.hostClass.set(this.elementRef.nativeElement.className || '');
  }

  close(): void {
    this.closed.emit();
  }

  get panelClasses(): string {
    const sideClass = this.side() === 'left' ? 'left-0' : 'right-0';
    return cn(
      'absolute inset-y-0 w-[280px] bg-background border shadow-lg',
      sideClass,
      this.hostClass(),
    );
  }
}
