import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  LucideAngularModule,
  ShoppingBag,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-angular';

import { SuperAdminDataService, type BillingSummary } from '../super-admin-data.service';
import { MoneyService } from '../../../../core/money/money.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppGridComponent,
  AppKpiCardComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-global-billing',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppGridComponent,
    AppKpiCardComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './global-billing.component.html',
  styleUrl: './global-billing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalBillingComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SuperAdminDataService);
  private readonly money = inject(MoneyService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<BillingSummary | null>(null);

  readonly icons = {
    ShoppingBag,
    RefreshCw,
    TrendingUp,
    DollarSign,
    Building2,
    Calendar,
    AlertTriangle,
    CheckCircle2,
  };

  ngOnInit(): void {
    this.loadBilling();
  }

  loadBilling(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data
      .getBilling()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load global SaaS billing summary');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) this.summary.set(res);
        this.loading.set(false);
      });
  }

  protected formatCurrency(v: number): string {
    return this.money.format(v, { maximumFractionDigits: 0 });
  }
}
