/**
 * Incoming Loose Bale List Component
 * Phase 2: Procurement UI
 * 
 * High-density directory listing all incoming loose bales with KPI metric cards and financial unit rates.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Package,
  Layers,
  Scale,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  RefreshCw,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { IncomingBale } from '../../procurement.models';
import { MoneyPipe } from '../../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-incoming-bale-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './incoming-bale-list.html',
  styleUrl: './incoming-bale-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingBaleListComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly router = inject(Router);

  readonly incomingBales = this.procurementService.incomingBales;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;
  readonly totalCount = this.procurementService.incomingBaleTotalCount;
  readonly currentPage = this.procurementService.incomingBaleCurrentPage;

  readonly icons = {
    Package,
    Layers,
    Scale,
    DollarSign,
    CheckCircle2,
    Clock,
    ArrowRight,
    Eye,
    RefreshCw,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Procurement', route: '/receive/records' },
    { label: 'Loose Bales', route: '/receive/records/loose-bales' },
  ];

  // KPI Metrics computed from incoming bales dataset
  readonly totalWeightSum = computed(() => {
    return this.incomingBales().reduce((sum, b) => sum + Number(b.weightKg || 0), 0);
  });

  readonly totalCostSum = computed(() => {
    return this.incomingBales().reduce((sum, b) => sum + Number(b.cost || 0), 0);
  });

  readonly averageCostPerKg = computed(() => {
    const weight = this.totalWeightSum();
    if (weight === 0) return 0;
    return this.totalCostSum() / weight;
  });

  ngOnInit(): void {
    this.loadBales();
  }

  loadBales(page = 1): void {
    this.procurementService.loadIncomingBales({ page, limit: 50 }).subscribe();
  }

  onRowClick(bale: IncomingBale): void {
    this.router.navigate(['/receive/records/loose-bales', bale.id]);
  }

  getCostPerKg(bale: IncomingBale): number {
    const weight = Number(bale.weightKg);
    if (!weight || weight === 0) return 0;
    return Number(bale.cost || 0) / weight;
  }

  clearError(): void {
    this.procurementService.clearError();
  }
}
