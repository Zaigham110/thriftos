import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AppIconComponent } from '../app-icon/app-icon.component';

/**
 * ===============================
 * APP-KPI-CARD - LOCKED KPI DISPLAY
 * ===============================
 * 
 * ⚠️ DESIGN SYSTEM RULE:
 * - KPIs ALWAYS appear at top of page
 * - Same height everywhere (120px)
 * - NO charts inside KPI cards
 * - Consistent structure: label + value + optional change
 * 
 * CONTRACT:
 * - Height: 120px
 * - Background: var(--app-bg-surface)
 * - Border: var(--app-border-subtle)
 * - Padding: var(--card-padding)
 * - Label: 12px, 400 weight, muted
 * - Value: 20px, 600 weight, primary
 * - Change indicator: Optional with color
 * 
 * USAGE:
 * ```html
 * <app-kpi-card
 *   label="Total Revenue"
 *   value="$125,000"
 *   change="+12.5%"
 *   changeType="positive"
 * />
 * ```
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <div
      class="app-kpi-card"
      [class.is-clickable]="clickable"
      role="button"
      [attr.tabindex]="clickable ? 0 : -1"
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onClick()"
    >
      <div class="kpi-label-row">
        @if (icon) {
          <app-icon class="kpi-icon" [name]="icon" size="sm" />
        }
        <div class="kpi-label">{{ label }}</div>
      </div>

      <div class="kpi-value">{{ value }}</div>

      @if (change) {
        <div class="kpi-secondary" [attr.data-type]="changeType">
          {{ change }}
        </div>
      } @else {
        <div class="kpi-secondary">&nbsp;</div>
      }
    </div>
  `,
  styleUrls: ['./app-kpi-card.component.scss']
})
export class AppKpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() change?: string;
  @Input() changeType?: 'positive' | 'negative' | 'neutral' = 'neutral';

  /** Optional subtle left indicator icon (lucide name via app-icon). */
  @Input() icon?: string;

  /** When true, card becomes keyboard-focusable and emits `clicked`. */
  @Input() clickable = false;
  @Output() clicked = new EventEmitter<void>();

  /**
   * Deprecated (kept for backward compatibility): sparklines are no longer rendered.
   * Provide values only if existing screens still bind this input.
   */
  @Input() sparkline?: number[];
  @Input() sparklineAriaLabel = 'Trend';

  onClick(): void {
    if (!this.clickable) return;
    this.clicked.emit();
  }
}
