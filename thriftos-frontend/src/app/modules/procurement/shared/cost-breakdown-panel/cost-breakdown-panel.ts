/**
 * Cost Breakdown Panel Component
 * Phase 2: Procurement UI
 * 
 * Displays cost breakdown from backend (read-only visualization)
 */

import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { CostBreakdown, ChargeType } from '../../procurement.models';
import { CardComponent, BadgeComponent } from '../../../../shared/ui';

@Component({
  selector: 'app-cost-breakdown-panel',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DecimalPipe, CardComponent, BadgeComponent],
  templateUrl: './cost-breakdown-panel.html',
  styleUrl: './cost-breakdown-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostBreakdownPanelComponent {
  readonly costBreakdown = input<CostBreakdown | null>(null);
  readonly loading = input<boolean>(false);
  readonly currency = input<string>('USD');

  readonly hasCharges = computed(() => {
    const breakdown = this.costBreakdown();
    return breakdown && breakdown.charges && breakdown.charges.length > 0;
  });

  readonly chargesByType = computed(() => {
    const breakdown = this.costBreakdown();
    if (!breakdown?.charges) return [];

    // Group charges by type
    const grouped = breakdown.charges.reduce((acc, charge) => {
      const type = charge.chargeType;
      if (!acc[type]) {
        acc[type] = { type, total: 0, charges: [] };
      }
      acc[type].total += Number(charge.amount);
      acc[type].charges.push(charge);
      return acc;
    }, {} as Record<string, { type: ChargeType; total: number; charges: typeof breakdown.charges }>);

    return Object.values(grouped);
  });

  getChargeTypeLabel(type: ChargeType): string {
    const labels: Record<ChargeType, string> = {
      CIF: 'CIF (Cost, Insurance, Freight)',
      FREIGHT: 'Freight',
      DUTY: 'Duty',
      TAX: 'Tax',
      PORT_HANDLING: 'Port Handling',
      MISC: 'Miscellaneous',
    };
    return labels[type] || type;
  }

  getChargeTypeBadgeVariant(type: ChargeType): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<ChargeType, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      CIF: 'primary',
      FREIGHT: 'default',
      DUTY: 'warning',
      TAX: 'danger',
      PORT_HANDLING: 'default',
      MISC: 'default',
    };
    return variants[type] || 'default';
  }
}
