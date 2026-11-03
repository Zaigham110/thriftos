import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  LucideAngularModule,
  Zap,
  Building2,
  Users,
  Shield,
  Layers,
  ShoppingBag,
  Activity,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Package,
  Server,
  Database,
  Lock,
  Eye,
} from 'lucide-angular';

import { SuperAdminDataService, type SuperAdminSummary } from '../super-admin-data.service';
import { AuthService } from '../../../../core/auth';
import { MoneyService } from '../../../../core/money/money.service';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppGridComponent,
  AppKpiCardComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppGridComponent,
    AppKpiCardComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './super-admin-dashboard.component.html',
  styleUrl: './super-admin-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SuperAdminDataService);
  private readonly auth = inject(AuthService);
  private readonly money = inject(MoneyService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<SuperAdminSummary | null>(null);
  protected readonly impersonatingId = signal<string | null>(null);

  readonly icons = {
    Zap,
    Building2,
    Users,
    Shield,
    Layers,
    ShoppingBag,
    Activity,
    RefreshCw,
    ArrowRight,
    TrendingUp,
    DollarSign,
    Package,
    Server,
    Database,
    Lock,
    Eye,
  };

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data
      .getSummary()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load platform summary');
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) this.summary.set(res);
        this.loading.set(false);
      });
  }

  impersonate(tenantId: string): void {
    if (this.impersonatingId()) return;
    this.impersonatingId.set(tenantId);

    this.auth
      .impersonateTenant(tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.impersonatingId.set(null);
          void this.router.navigate(['/home/overview']);
        },
        error: () => this.impersonatingId.set(null),
      });
  }

  protected formatCurrency(v: string | number): string {
    const num = typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
    return this.money.format(num, { maximumFractionDigits: 0 });
  }

  protected formatKg(v: string | number): string {
    const num = typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    return `${nf.format(num)} kg`;
  }
}
