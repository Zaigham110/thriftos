/**
 * Enterprise Executive Reports & Analytics Dashboard Component
 * Phase 7: Reports & Analytics
 * 
 * Enterprise-level supply chain intelligence dashboard with visual analytics,
 * yield breakdown progress bars, cost flow waterfalls, and dynamic KPIs.
 */

import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  BarChart3,
  TrendingUp,
  Trash2,
  Package,
  DollarSign,
  FileBarChart,
  ArrowRight,
  Sparkles,
  Layers,
  Scale,
  RefreshCw,
  PieChart,
  Activity,
  Boxes,
  Truck,
  Zap,
  ShieldCheck,
} from 'lucide-angular';

import { ReportsService } from '../reports.service';
import type { YieldReportRow, FinalProductCostResponse, InventorySnapshotResponse } from '../reports.models';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

interface EnterpriseReportCard {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: any;
  category: 'OPERATIONS' | 'FINANCIAL' | 'INVENTORY' | 'QUALITY';
  tag: string;
}

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './reports-dashboard.html',
  styleUrl: './reports-dashboard-erp.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly reportsService = inject(ReportsService);

  readonly icons = {
    BarChart3,
    TrendingUp,
    Trash2,
    Package,
    DollarSign,
    FileBarChart,
    ArrowRight,
    Sparkles,
    Layers,
    Scale,
    RefreshCw,
    PieChart,
    Activity,
    Boxes,
    Truck,
    Zap,
    ShieldCheck,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Reports', route: '/reports/detail' },
    { label: 'Enterprise Intelligence Dashboard' },
  ];

  // State Signals
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly yieldData = signal<YieldReportRow[]>([]);
  readonly productCostData = signal<FinalProductCostResponse | null>(null);
  readonly inventorySnapshot = signal<InventorySnapshotResponse | null>(null);

  // Aggregated Key Metrics
  readonly totalYieldInputKg = computed(() => {
    return this.yieldData().reduce((sum, r) => sum + Number(r.inputWeightKg || 0), 0);
  });

  readonly totalYieldOutputKg = computed(() => {
    return this.yieldData().reduce((sum, r) => sum + Number(r.outputWeightKg || 0), 0);
  });

  readonly totalYieldWasteKg = computed(() => {
    return this.yieldData().reduce((sum, r) => sum + Number(r.wasteWeightKg || 0), 0);
  });

  readonly overallYieldPct = computed(() => {
    const input = this.totalYieldInputKg();
    if (input <= 0) return 0;
    return Math.min(100, (this.totalYieldOutputKg() / input) * 100);
  });

  readonly wasteRatioPct = computed(() => {
    const input = this.totalYieldInputKg();
    if (input <= 0) return 0;
    return Math.min(100, (this.totalYieldWasteKg() / input) * 100);
  });

  readonly totalInventoryValuation = computed(() => {
    const costResp = this.productCostData();
    if (costResp?.summary) {
      return costResp.summary.totalCost || 0;
    }
    return 0;
  });

  readonly avgCostPerKg = computed(() => {
    const costResp = this.productCostData();
    if (costResp?.summary && costResp.summary.totalWeightKg > 0) {
      return costResp.summary.totalCost / costResp.summary.totalWeightKg;
    }
    return 0;
  });

  readonly totalSealedUnits = computed(() => {
    const costResp = this.productCostData();
    return costResp?.summary?.totalUnits || 0;
  });

  readonly totalSealedWeightKg = computed(() => {
    const costResp = this.productCostData();
    return costResp?.summary?.totalWeightKg || 0;
  });

  // Enterprise Report Cards Directory
  readonly enterpriseReportCards: EnterpriseReportCard[] = [
    {
      id: 'yield',
      title: 'Yield Audit & Mass Balance',
      description: 'Raw bale intake vs Stage 1 category yield vs Stage 2 quality grade conversion and waste ratio.',
      route: '/reports/detail/yield',
      icon: TrendingUp,
      category: 'OPERATIONS',
      tag: 'High Impact',
    },
    {
      id: 'final-product-cost',
      title: 'Final Sealed Goods Cost & COGS',
      description: 'Backend-derived sealed unit landed cost, labor allocations, container cost cascade, and margins.',
      route: '/reports/detail/final-product-cost',
      icon: DollarSign,
      category: 'FINANCIAL',
      tag: 'COGS Audit',
    },
    {
      id: 'inventory',
      title: 'Finished Inventory Valuation',
      description: 'Warehouse stock levels, grade distribution, storage location valuation ($), and inventory aging.',
      route: '/reports/detail/inventory',
      icon: Package,
      category: 'INVENTORY',
      tag: 'Stock Valuation',
    },
    {
      id: 'procurement-summary',
      title: 'Procurement & Container Costs',
      description: 'PO total landed costs, ocean freight allocations, supplier volume performance, and bale intake.',
      route: '/reports/detail/procurement-summary',
      icon: Truck,
      category: 'FINANCIAL',
      tag: 'Procurement',
    },
    {
      id: 'repack-summary',
      title: 'Repack & Batch Production',
      description: 'Draft vs sealed repack units grouped by category, quality grade, sealed dates, and batch counts.',
      route: '/reports/detail/repack-summary',
      icon: Layers,
      category: 'OPERATIONS',
      tag: 'Batch Repack',
    },
    {
      id: 'sorting-outputs',
      title: 'Sorting Outputs & Grade Breakdown',
      description: 'Stage 1 category outputs and Stage 2 finished grade outputs distribution with lineage tracking.',
      route: '/reports/detail/sorting-outputs',
      icon: BarChart3,
      category: 'QUALITY',
      tag: 'Output Quality',
    },
    {
      id: 'waste',
      title: 'Waste & Material Loss Audit',
      description: 'Stage 1 & Stage 2 categorized waste weight, disposal cost impact, and waste reduction metrics.',
      route: '/reports/detail/waste',
      icon: Trash2,
      category: 'QUALITY',
      tag: 'Loss Control',
    },
    {
      id: 'inventory-movements',
      title: 'Inventory Movement Ledger',
      description: 'Auditable stock intake, allocation, repack reservation, and wholesale sales movement ledger.',
      route: '/reports/detail/inventory-movements',
      icon: ArrowRight,
      category: 'INVENTORY',
      tag: 'Audit Trail',
    },
  ];

  ngOnInit(): void {
    this.loadAllOverviewData();
  }

  loadAllOverviewData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportsService.loadYieldReport().subscribe({
      next: (rows) => {
        this.yieldData.set(rows || []);
      },
      error: () => {},
    });

    this.reportsService.fetchFinalProductCost().subscribe({
      next: (res) => {
        this.productCostData.set(res);
      },
      error: () => {},
    });

    this.reportsService.loadInventorySnapshot().subscribe({
      next: (snap) => {
        this.inventorySnapshot.set(snap);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openReport(route: string): void {
    this.router.navigate([route]);
  }

  getYieldPct(row: YieldReportRow): number {
    const input = Number(row.inputWeightKg || 0);
    if (input <= 0) return 0;
    return Math.min(100, (Number(row.outputWeightKg || 0) / input) * 100);
  }

  getWastePct(row: YieldReportRow): number {
    const input = Number(row.inputWeightKg || 0);
    if (input <= 0) return 0;
    return Math.min(100, (Number(row.wasteWeightKg || 0) / input) * 100);
  }
}
