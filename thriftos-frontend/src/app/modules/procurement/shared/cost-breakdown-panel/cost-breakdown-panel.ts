/**
 * Cost Breakdown Panel Component
 * Phase 2: Procurement UI
 * 
 * Displays landed cost per KG analysis and charge breakdown summary.
 */

import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { LucideAngularModule, DollarSign, Calculator, Scale, Layers } from 'lucide-angular';
import { CostBreakdown, ChargeType } from '../../procurement.models';
import { MoneyPipe } from '../../../../core/money/money.pipe';

@Component({
  selector: 'app-cost-breakdown-panel',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
  ],
  templateUrl: './cost-breakdown-panel.html',
  styleUrl: './cost-breakdown-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostBreakdownPanelComponent {
  readonly costBreakdown = input<CostBreakdown | null>(null);
  readonly loading = input<boolean>(false);

  readonly icons = {
    DollarSign,
    Calculator,
    Scale,
    Layers,
  };

  readonly hasCharges = computed(() => {
    const breakdown = this.costBreakdown();
    return breakdown && breakdown.charges && breakdown.charges.length > 0;
  });

  getChargeTypeLabel(type: ChargeType): string {
    const labels: Record<ChargeType, string> = {
      CIF: 'CIF (old purchase cost)',
      FREIGHT: 'Freight',
      DUTY: 'Duty',
      TAX: 'Tax',
      CLEARING: 'Clearing',
      PORT_HANDLING: 'Port handling',
      TRANSPORT: 'Transport',
      LABOUR: 'Labour',
      MISC: 'Other',
    };
    return labels[type] || type;
  }
}
