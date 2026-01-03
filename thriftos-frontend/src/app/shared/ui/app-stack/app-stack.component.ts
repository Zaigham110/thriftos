import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type StackDirection = 'vertical' | 'horizontal';
type StackSpacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-stack',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="app-stack" [class]="stackClass"><ng-content /></div>`,
  styleUrl: './app-stack.component.scss'
})
export class AppStackComponent {
  @Input() direction: StackDirection = 'vertical';
  @Input() spacing: StackSpacing = 'md';

  get stackClass(): string {
    return `stack-${this.direction} stack-spacing-${this.spacing}`;
  }
}
