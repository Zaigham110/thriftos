/**
 * Executive Dashboard - Company Owner Cockpit
 * Phase 1 & 2: Financial, Production, and Operational Risk Overview
 */

import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  LucideAngularModule,
  DollarSign,
  TrendingUp,
  Truck,
  Scale,
  ShieldAlert,
  Package,
  BarChart3,
  Layers,
  ShoppingBag,
  Users,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Award,
  Zap,
  Clock,
  AlertTriangle,
  ChevronRight,
  Download,
  Filter,
  X,
  FileText,
  Building2,
  Activity,
} from 'lucide-angular';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppStackComponent,
  AppGridComponent,
  AppCardComponent,
  AppKpiCardComponent,
  AppSelectComponent,
  AppInputComponent,
  AppFormFieldComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  type SelectOption,
  type ChartPoint,
  AppChartComponent,
} from '../../../shared/ui';

import { TenantService } from '../../../core/tenant/tenant.service';
import { MoneyService } from '../../../core/money/money.service';
import {
  DashboardDataService,
  type DashboardFilters,
  type DashboardCategoryYieldRow,
  type ExecutiveOverview,
  type MaterialBalanceFlow,
  type OperatorLeaderboardRow,
  type ContainerAuditRow,
  type CustomerRiskRow,
  type InventoryGradeRow,
} from './dashboard-data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppGridComponent,
    AppCardComponent,
    AppKpiCardComponent,
    AppSelectComponent,
    AppInputComponent,
    AppFormFieldComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppChartComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly money = inject(MoneyService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Interactive View Tabs
  protected readonly activeView = signal<'overview' | 'financial' | 'operations' | 'logistics' | 'customers'>('overview');

  // Interactive Side Control Drawers
  protected readonly selectedContainer = signal<ContainerAuditRow | null>(null);
  protected readonly selectedCustomer = signal<CustomerRiskRow | null>(null);

  // Icons
  readonly icons = {
    DollarSign,
    TrendingUp,
    Truck,
    Scale,
    ShieldAlert,
    Package,
    BarChart3,
    Layers,
    ShoppingBag,
    Users,
    CheckCircle2,
    RefreshCw,
    ArrowRight,
    Sparkles,
    Award,
    Zap,
    Clock,
    AlertTriangle,
    ChevronRight,
    Download,
    Filter,
    X,
    FileText,
    Building2,
    Activity,
  };

  // Filters
  protected readonly period = signal<'7d' | '30d' | '90d' | 'custom'>('30d');
  protected readonly categoryId = signal<string>('');
  protected readonly workerId = signal<string>('');
  protected readonly customStart = signal<string>('');
  protected readonly customEnd = signal<string>('');

  protected readonly periodOptions: SelectOption[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' },
  ];

  // Data Signals
  protected readonly tenantName = computed(() => this.tenantService.tenant()?.name ?? 'Enterprise Workspace');
  protected readonly categoryOptions = computed<SelectOption[]>(() => {
    const cats = this.tenantService.categories();
    const opts = cats
      .filter((c) => c.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ value: c.id, label: c.name }));
    return [{ value: '', label: 'All categories' }, ...opts];
  });

  // KPIs
  protected readonly kpiSalesRevenue = signal(0);
  protected readonly kpiProcurementCost = signal(0);
  protected readonly kpiNetMargin = signal(0);
  protected readonly kpiSortedWeightKg = signal(0);
  protected readonly kpiYieldPct = signal(0);
  protected readonly kpiWastePct = signal(0);

  protected readonly kpiSalesRevenueChange = signal<string | undefined>(undefined);
  protected readonly kpiProcurementCostChange = signal<string | undefined>(undefined);
  protected readonly kpiNetMarginChange = signal<string | undefined>(undefined);
  protected readonly kpiSortedWeightChange = signal<string | undefined>(undefined);
  protected readonly kpiYieldChange = signal<string | undefined>(undefined);
  protected readonly kpiWasteChange = signal<string | undefined>(undefined);

  protected readonly kpiSalesRevenueChangeType = computed(() => this.changeType(this.kpiSalesRevenueChange()));
  protected readonly kpiProcurementCostChangeType = computed(() => this.changeType(this.kpiProcurementCostChange()));
  protected readonly kpiNetMarginChangeType = computed(() => this.changeType(this.kpiNetMarginChange()));
  protected readonly kpiSortedWeightChangeType = computed(() => this.changeType(this.kpiSortedWeightChange()));
  protected readonly kpiYieldChangeType = computed(() => this.changeType(this.kpiYieldChange()));
  protected readonly kpiWasteChangeType = computed(() => this.changeType(this.kpiWasteChange()));

  protected readonly salesSparkline = signal<number[]>([]);
  protected readonly procurementSparkline = signal<number[]>([]);
  protected readonly sortedWeightSparkline = signal<number[]>([]);
  protected readonly yieldSparkline = signal<number[]>([]);
  protected readonly wasteSparkline = signal<number[]>([]);

  // Charts
  protected readonly revenuePoints = signal<ChartPoint[]>([]);
  protected readonly volumePoints = signal<ChartPoint[]>([]);
  protected readonly categoryYieldPoints = signal<ChartPoint[]>([]);

  // Detailed Datasets
  protected readonly materialFlow = signal<MaterialBalanceFlow | null>(null);
  protected readonly executiveOverview = signal<ExecutiveOverview | null>(null);
  protected readonly operatorLeaderboard = signal<OperatorLeaderboardRow[]>([]);
  protected readonly containerAudits = signal<ContainerAuditRow[]>([]);
  protected readonly customerRisks = signal<CustomerRiskRow[]>([]);
  protected readonly inventoryGrades = signal<InventoryGradeRow[]>([]);

  constructor(
    private readonly tenantService: TenantService,
    private readonly data: DashboardDataService,
  ) {
    this.tenantService.loadTenant().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.tenantService.loadCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    effect(() => {
      void this.period();
      void this.categoryId();
      void this.workerId();
      void this.customStart();
      void this.customEnd();
      this.reload();
    });
  }

  onViewChange(view: 'overview' | 'financial' | 'operations' | 'logistics' | 'customers'): void {
    this.activeView.set(view);
  }

  onPeriodChange(value: string | number): void {
    this.period.set(value as any);
  }

  onCategoryChange(value: string | number): void {
    this.categoryId.set(String(value ?? ''));
  }

  onWorkerChange(value: string): void {
    this.workerId.set(value ?? '');
  }

  onCustomStartChange(value: string): void {
    this.customStart.set(value ?? '');
  }

  onCustomEndChange(value: string): void {
    this.customEnd.set(value ?? '');
  }

  openContainerDrawer(cont: ContainerAuditRow): void {
    this.selectedContainer.set(cont);
  }

  closeContainerDrawer(): void {
    this.selectedContainer.set(null);
  }

  openCustomerDrawer(cust: CustomerRiskRow): void {
    this.selectedCustomer.set(cust);
  }

  closeCustomerDrawer(): void {
    this.selectedCustomer.set(null);
  }

  exportExecutiveSummary(): void {
    window.print();
  }

  protected readonly activeFilters = computed<DashboardFilters>(() => {
    const { startDate, endDate } = this.resolveRange();
    return {
      startDate,
      endDate,
      categoryId: this.categoryId() || undefined,
      workerId: this.workerId().trim() ? this.workerId().trim() : undefined,
    };
  });

  private resolveRange(): { startDate?: string; endDate?: string; days: number } {
    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const presetDays = this.period() === '7d' ? 7 : this.period() === '90d' ? 90 : this.period() === 'custom' ? 0 : 30;

    if (this.period() === 'custom') {
      const startDate = this.customStart() || undefined;
      const endDate = this.customEnd() || undefined;
      return { startDate, endDate, days: 30 };
    }

    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (presetDays - 1));
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    return { startDate: toIso(start), endDate: toIso(end), days: presetDays };
  }

  private reload(): void {
    const filters = this.activeFilters();
    if (this.period() === 'custom' && (!filters.startDate || !filters.endDate)) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.data
      .getSummary(filters)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((e) => {
          const status = e?.status;
          const message =
            status === 403
              ? 'Missing REPORTS_VIEW permission for dashboard analytics.'
              : e?.error?.message || e?.message || 'Failed to load executive dashboard data';
          this.error.set(message);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (!res) return;

        const summary = res.data;

        this.kpiSalesRevenue.set(Number(summary.kpis.salesRevenue?.value ?? 0));
        this.kpiProcurementCost.set(Number(summary.kpis.procurementCost?.value ?? 0));
        this.kpiNetMargin.set(Number(summary.kpis.netOperationalMargin?.value ?? 0));
        this.kpiSortedWeightKg.set(Number(summary.kpis.sortedWeightKg?.value ?? 0));
        this.kpiYieldPct.set(Number(summary.kpis.yieldPct?.value ?? 0));
        this.kpiWastePct.set(Number(summary.kpis.wastePct?.value ?? 0));

        this.kpiSalesRevenueChange.set(summary.kpis.salesRevenue?.change);
        this.kpiProcurementCostChange.set(summary.kpis.procurementCost?.change);
        this.kpiNetMarginChange.set(summary.kpis.netOperationalMargin?.change);
        this.kpiSortedWeightChange.set(summary.kpis.sortedWeightKg?.change);
        this.kpiYieldChange.set(summary.kpis.yieldPct?.change);
        this.kpiWasteChange.set(summary.kpis.wastePct?.change);

        this.salesSparkline.set(summary.kpis.salesRevenue?.sparkline ?? []);
        this.procurementSparkline.set(summary.kpis.procurementCost?.sparkline ?? []);
        this.sortedWeightSparkline.set(summary.kpis.sortedWeightKg?.sparkline ?? []);
        this.yieldSparkline.set(summary.kpis.yieldPct?.sparkline ?? []);
        this.wasteSparkline.set(summary.kpis.wastePct?.sparkline ?? []);

        this.revenuePoints.set((summary.analytics.salesRevenueTrend ?? []).map((r) => ({ label: r.bucket, value: Number(r.value) })));
        this.volumePoints.set((summary.analytics.sortedVolumeTrend ?? []).map((r) => ({ label: r.bucket, value: Number(r.value) })));
        this.categoryYieldPoints.set(this.mapCategoryYieldToChartPoints(summary.analytics.categoryYield ?? []));

        this.materialFlow.set(summary.materialBalanceFlow ?? null);
        this.executiveOverview.set(summary.executiveOverview ?? null);
        this.operatorLeaderboard.set(summary.operatorLeaderboard ?? []);
        this.containerAudits.set(summary.containerAudits ?? []);
        this.customerRisks.set(summary.customerRisks ?? []);
        this.inventoryGrades.set(summary.inventoryGrades ?? []);

        this.loading.set(false);
      });
  }

  private mapCategoryYieldToChartPoints(rows: DashboardCategoryYieldRow[]): ChartPoint[] {
    const nameById = new Map(this.tenantService.categories().map((c) => [c.id, c.name] as const));
    return rows.map((r) => ({
      label: nameById.get(r.categoryId) ?? r.categoryId,
      value: Number(r.yieldPct ?? 0),
    }));
  }

  private changeType(change?: string): 'positive' | 'negative' | 'neutral' {
    if (!change) return 'neutral';
    if (change.startsWith('+')) return 'positive';
    if (change.startsWith('-')) return 'negative';
    return 'neutral';
  }

  protected formatCurrency(v: number): string {
    return this.money.format(v || 0, { maximumFractionDigits: 0 });
  }

  protected formatKg(v: number | string | null | undefined): string {
    const num = typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    return `${nf.format(num)} kg`;
  }

  protected formatPct(v: number): string {
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
    return `${nf.format(v)}%`;
  }
}
