/**
 * Warehouse Badge Component
 * Phase 6: Inventory Management
 * 
 * Displays warehouse information in a compact badge format.
 * READ-ONLY display component.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Warehouse } from 'lucide-angular';

@Component({
  selector: 'app-warehouse-badge',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="warehouse-badge" [class.warehouse-badge--compact]="compact">
      <lucide-icon [img]="icons.Warehouse" [size]="compact ? 12 : 14"></lucide-icon>
      @if (code && !compact) {
        <span class="warehouse-code">{{ code }}</span>
        <span class="warehouse-separator">·</span>
      }
      <span class="warehouse-name">{{ name || 'Unknown' }}</span>
    </div>
  `,
  styles: [`
    .warehouse-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      color: #475569;

      &--compact {
        padding: 0.125rem 0.375rem;
        gap: 0.25rem;
        font-size: 0.6875rem;
      }
    }

    .warehouse-code {
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0f172a;
    }

    .warehouse-separator {
      color: #94a3b8;
    }

    .warehouse-name {
      color: #64748b;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehouseBadgeComponent {
  @Input() name: string = '';
  @Input() code: string = '';
  @Input() compact: boolean = false;

  readonly icons = { Warehouse };
}
