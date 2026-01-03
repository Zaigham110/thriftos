/**
 * Inventory Ledger Table Component
 * Phase 6: Inventory Management
 * 
 * Displays chronological stock movement entries.
 * APPEND-ONLY VIEW - no editing or deletion.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { LucideAngularModule, ArrowDownToLine, ArrowUpDown, Lock, Unlock, ShoppingCart, Clock } from 'lucide-angular';
import { StockMovement, MovementType } from '../inventory.models';

@Component({
  selector: 'app-inventory-ledger-table',
  standalone: true,
  imports: [CommonModule, DatePipe, LucideAngularModule],
  template: `
    <div class="ledger-table-wrapper overflow-x-auto">
      @if (movements.length === 0) {
        <div class="ledger-empty flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <lucide-icon [img]="icons.Clock" [size]="32" class="text-muted-foreground"></lucide-icon>
          <p class="m-0">No ledger entries yet</p>
        </div>
      } @else {
        <table class="ledger-table w-full border-collapse text-sm">
          <thead>
            <tr>
              <th class="whitespace-nowrap bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Event Type</th>
              <th class="numeric whitespace-nowrap bg-muted/40 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Weight (KG)</th>
              <th class="numeric whitespace-nowrap bg-muted/40 px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Pieces</th>
              <th class="whitespace-nowrap bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</th>
              <th class="whitespace-nowrap bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            @for (movement of movements; track movement.id) {
              <tr class="border-t">
                <td>
                  <div class="movement-type inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium" [class]="movementTypeClass(movement.movementType)">
                    <lucide-icon [img]="getMovementIcon(movement.movementType)" [size]="14"></lucide-icon>
                    <span>{{ formatMovementType(movement.movementType) }}</span>
                  </div>
                </td>
                <td class="numeric px-3 py-2 text-right tabular-nums">
                  <span
                    class="font-medium"
                    [class.text-secondary]="isPositiveMovement(movement)"
                    [class.text-destructive]="!isPositiveMovement(movement) && movement.movementType !== 'RESERVATION' && movement.movementType !== 'RELEASE'"
                  >
                    {{ isPositiveMovement(movement) ? '+' : '' }}{{ formatQuantity(movement.quantityKg) }}
                  </span>
                </td>
                <td class="numeric px-3 py-2 text-right tabular-nums text-foreground">
                  {{ movement.quantityPcs || 0 }}
                </td>
                <td class="reference px-3 py-2">
                  @if (movement.referenceId) {
                    <code class="rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">{{ movement.referenceId | slice:0:12 }}...</code>
                  } @else if (movement.metadataJson?.['reason']) {
                    <span class="reason text-xs italic text-muted-foreground">{{ movement.metadataJson?.['reason'] }}</span>
                  } @else if (movement.metadataJson?.['note']) {
                    <span class="reason text-xs italic text-muted-foreground">{{ movement.metadataJson?.['note'] }}</span>
                  } @else {
                    <span class="no-ref text-xs text-muted-foreground">—</span>
                  }
                </td>
                <td class="timestamp whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {{ movement.createdAt | date:'MMM d, y HH:mm' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryLedgerTableComponent {
  @Input() movements: StockMovement[] = [];

  readonly icons = {
    ArrowDownToLine,
    ArrowUpDown,
    Lock,
    Unlock,
    ShoppingCart,
    Clock,
  };

  movementTypeClass(type: MovementType): string {
    switch (type) {
      case 'INTAKE':
        return 'bg-secondary/10 text-secondary';
      case 'ADJUSTMENT':
        return 'bg-accent text-accent-foreground';
      case 'RESERVATION':
        return 'bg-primary/10 text-primary';
      case 'RELEASE':
        return 'bg-muted text-foreground';
      case 'SALE':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  getMovementIcon(type: MovementType) {
    switch (type) {
      case 'INTAKE':
        return this.icons.ArrowDownToLine;
      case 'ADJUSTMENT':
        return this.icons.ArrowUpDown;
      case 'RESERVATION':
        return this.icons.Lock;
      case 'RELEASE':
        return this.icons.Unlock;
      case 'SALE':
        return this.icons.ShoppingCart;
      default:
        return this.icons.ArrowUpDown;
    }
  }

  formatMovementType(type: MovementType): string {
    switch (type) {
      case 'INTAKE':
        return 'Intake';
      case 'ADJUSTMENT':
        return 'Adjustment';
      case 'RESERVATION':
        return 'Reserved';
      case 'RELEASE':
        return 'Released';
      case 'SALE':
        return 'Sold';
      default:
        return type;
    }
  }

  formatQuantity(qty: number | string): string {
    const q = typeof qty === 'string' ? parseFloat(qty) : qty;
    if (isNaN(q)) return '0';
    return q.toFixed(2);
  }

  isPositiveMovement(movement: StockMovement): boolean {
    const type = movement.movementType;
    if (type === 'INTAKE' || type === 'RELEASE') {
      return true;
    }
    if (type === 'ADJUSTMENT') {
      const qty = typeof movement.quantityKg === 'string' 
        ? parseFloat(movement.quantityKg) 
        : movement.quantityKg;
      return qty >= 0;
    }
    return false;
  }
}
