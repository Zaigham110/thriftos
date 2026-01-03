import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppChartComponent,
  AppErrorStateComponent,
  AppGridComponent,
  AppKpiCardComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
  type BreadcrumbItem,
  type ChartPoint,
} from '../../../shared/ui';
import { RouterLink } from '@angular/router';
import { ProcurementService } from '../procurement.service';
import { ProcurementDashboardSummary } from '../procurement.models';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-procurement-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppGridComponent,
    AppKpiCardComponent,
    AppCardComponent,
    AppChartComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './procurement-dashboard.html',
  styleUrl: './procurement-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcurementDashboardComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly authService = inject(AuthService);

  readonly summary = signal<ProcurementDashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Procurement', route: '/procurement/dashboard' },
  ];

  readonly canCreate = signal(false);

  ngOnInit(): void {
    this.checkPermissions();
    this.loadSummary();
  }

  private checkPermissions(): void {
    const permissions = this.authService.permissions();
    this.canCreate.set(
      permissions.includes('po.create') || this.authService.isSuperAdmin()
    );
  }

  loadSummary(): void {
    this.loading.set(true);
    this.error.set(null);

    this.procurementService.loadStats().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load procurement dashboard');
        this.loading.set(false);
      },
    });
  }

  readonly kpiActivePos = computed(() => this.summary()?.kpis.activePos ?? 0);
  readonly kpiContainersInTransit = computed(() => this.summary()?.kpis.containersInTransit ?? 0);
  readonly kpiLooseBalesReceived = computed(() => this.summary()?.kpis.looseBalesReceived ?? 0);

  readonly poUtilizationPoints = computed<ChartPoint[]>(() => {
    const rows = this.summary()?.charts.poSpendVsAllocated ?? [];
    return rows.map((p) => ({ label: p.label, value: p.value }));
  });

  readonly vendorDistributionPoints = computed<ChartPoint[]>(() => {
    const rows = this.summary()?.charts.vendorDistribution ?? [];
    return rows.map((r) => ({ label: r.vendorName, value: r.sharePct }));
  });
}
