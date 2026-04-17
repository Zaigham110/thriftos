import { Injectable, computed, inject } from '@angular/core';
import { TenantService } from '../tenant/tenant.service';

export type MoneyFormatOptions = {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

@Injectable({ providedIn: 'root' })
export class MoneyService {
  private readonly tenantService = inject(TenantService);

  private readonly currencyCode = computed(() => this.tenantService.tenant()?.currencyCode ?? 'USD');
  private readonly locale = computed(() => this.tenantService.tenant()?.locale ?? undefined);

  format(amount: number | string | null | undefined, opts: MoneyFormatOptions = {}): string {
    const numeric = typeof amount === 'string' ? Number(amount) : amount;
    if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '';

    const nf = new Intl.NumberFormat(this.locale(), {
      style: 'currency',
      currency: this.currencyCode(),
      maximumFractionDigits: opts.maximumFractionDigits,
      minimumFractionDigits: opts.minimumFractionDigits,
    });

    return nf.format(numeric);
  }
}
