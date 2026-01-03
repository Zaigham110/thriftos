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
    <div
      class="inline-flex items-center rounded-md border border-border bg-muted text-muted-foreground"
      [class.gap-1.5]="!compact"
      [class.px-2]="!compact"
      [class.py-1]="!compact"
      [class.text-xs]="!compact"
      [class.gap-1]="compact"
      [class.px-1.5]="compact"
      [class.py-0.5]="compact"
      [class.text-[11px]]="compact"
    >
      <lucide-icon [img]="icons.Warehouse" [size]="compact ? 12 : 14"></lucide-icon>
      @if (code && !compact) {
        <span class="font-mono text-xs font-semibold text-foreground">{{ code }}</span>
        <span class="text-muted-foreground/50">·</span>
      }
      <span class="text-muted-foreground">{{ name || 'Unknown' }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehouseBadgeComponent {
  @Input() name: string = '';
  @Input() code: string = '';
  @Input() compact: boolean = false;

  readonly icons = { Warehouse };
}
