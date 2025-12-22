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
    <div class="ledger-table-wrapper">
      @if (movements.length === 0) {
        <div class="ledger-empty">
          <lucide-icon [img]="icons.Clock" [size]="32"></lucide-icon>
          <p>No ledger entries yet</p>
        </div>
      } @else {
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Event Type</th>
              <th class="numeric">Weight (KG)</th>
              <th class="numeric">Pieces</th>
              <th>Reference</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            @for (movement of movements; track movement.id) {
              <tr>
                <td>
                  <div class="movement-type" [class]="'movement-type--' + movement.movementType.toLowerCase()">
                    <lucide-icon [img]="getMovementIcon(movement.movementType)" [size]="14"></lucide-icon>
                    <span>{{ formatMovementType(movement.movementType) }}</span>
                  </div>
                </td>
                <td class="numeric">
                  <span [class.positive]="isPositiveMovement(movement)" [class.negative]="!isPositiveMovement(movement) && movement.movementType !== 'RESERVATION' && movement.movementType !== 'RELEASE'">
                    {{ formatQuantity(movement.quantityKg) }}
                  </span>
                </td>
                <td class="numeric">
                  {{ movement.quantityPcs || 0 }}
                </td>
                <td class="reference">
                  @if (movement.referenceId) {
                    <code>{{ movement.referenceId | slice:0:12 }}...</code>
                  } @else if (movement.metadataJson?.['reason']) {
                    <span class="reason">{{ movement.metadataJson?.['reason'] }}</span>
                  } @else if (movement.metadataJson?.['note']) {
                    <span class="reason">{{ movement.metadataJson?.['note'] }}</span>
                  } @else {
                    <span class="no-ref">—</span>
                  }
                </td>
                <td class="timestamp">
                  {{ movement.createdAt | date:'MMM d, y HH:mm' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .ledger-table-wrapper {
      overflow-x: auto;
    }

    .ledger-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: #64748b;
      text-align: center;

      lucide-icon {
        opacity: 0.3;
        margin-bottom: 0.75rem;
      }

      p {
        margin: 0;
        font-size: 0.875rem;
      }
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;

      th,
      td {
        padding: 0.625rem 0.75rem;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }

      th {
        font-weight: 600;
        color: #475569;
        background: #f9fafb;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.025em;
      }

      td {
        color: #0f172a;
      }

      .numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      tbody tr:hover {
        background: #f8fafc;
      }
    }

    .movement-type {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;

      &--intake {
        background: #dcfce7;
        color: #16a34a;
      }

      &--adjustment {
        background: #fef3c7;
        color: #d97706;
      }

      &--reservation {
        background: #dbeafe;
        color: #2563eb;
      }

      &--release {
        background: #f3e8ff;
        color: #9333ea;
      }

      &--sale {
        background: #fee2e2;
        color: #dc2626;
      }
    }

    .positive {
      color: #16a34a;

      &::before {
        content: '+';
      }
    }

    .negative {
      color: #dc2626;
    }

    .reference {
      code {
        font-size: 0.6875rem;
        padding: 0.125rem 0.375rem;
        background: #f1f5f9;
        border-radius: 0.25rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .reason {
        font-style: italic;
        color: #64748b;
        font-size: 0.75rem;
      }

      .no-ref {
        color: #94a3b8;
      }
    }

    .timestamp {
      color: #64748b;
      font-size: 0.75rem;
      white-space: nowrap;
    }
  `],
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
