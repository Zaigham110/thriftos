import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type GridColumns = 1 | 2 | 3 | 4;
type GridGap = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="app-grid" [class]="gridClass"><ng-content /></div>`,
  styleUrl: './app-grid.component.scss'
})
export class AppGridComponent {
  @Input() columns: GridColumns = 2;
  @Input() gap: GridGap = 'md';

  get gridClass(): string {
    return `grid-cols-${this.columns} grid-gap-${this.gap}`;
  }
}
