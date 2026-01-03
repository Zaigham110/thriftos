import { Component, Input } from '@angular/core';

export type SplitRatio = '2-1' | '3-1' | '1-1' | '1-2';

/**
 * ===============================
 * APP-SPLIT - LOCKED 2-COLUMN LAYOUT
 * ===============================
 *
 * ⚠️ DESIGN SYSTEM RULE:
 * - Use for the locked “main + side” dashboard layouts
 * - Prevents ad-hoc grid/flex in screens
 *
 * CONTRACT:
 * - Default: 2-1 ratio
 * - Responsive: stacks on narrow viewports
 * - Contains: <app-split-main> + <app-split-aside>
 */
@Component({
  selector: 'app-split',
  standalone: true,
  template: `
    <div class="app-split" [attr.data-ratio]="ratio">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-split.component.scss'],
})
export class AppSplitComponent {
  @Input() ratio: SplitRatio = '2-1';
}

@Component({
  selector: 'app-split-main',
  standalone: true,
  template: `
    <div class="app-split-main">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-split.component.scss'],
})
export class AppSplitMainComponent {}

@Component({
  selector: 'app-split-aside',
  standalone: true,
  template: `
    <div class="app-split-aside">
      <ng-content />
    </div>
  `,
  styleUrls: ['./app-split.component.scss'],
})
export class AppSplitAsideComponent {}
