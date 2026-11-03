/**
 * Container List Component
 * Phase 2: Procurement UI
 * 
 * High-density directory listing all ocean freight containers with KPI metric cards, status filters, and logistics specs.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Truck,
  Anchor,
  Calendar,
  Scale,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Filter,
  Plus,
  RefreshCw,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { Container, ContainerStatus, ContainerFilters } from '../../procurement.models';
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
  selector: 'app-container-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './container-list.html',
  styleUrl: './container-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerListComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly router = inject(Router);

  readonly containers = this.procurementService.containers;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;
  readonly totalCount = this.procurementService.containerTotalCount;
  readonly currentPage = this.procurementService.containerCurrentPage;
  readonly totalPages = this.procurementService.containerTotalPages;

  // Active status filter signal
  readonly activeStatusFilter = signal<string>('ALL');

  readonly icons = {
    Truck,
    Anchor,
    Calendar,
    Scale,
    CheckCircle2,
    Clock,
    ArrowRight,
    Eye,
    Filter,
    Plus,
    RefreshCw,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Procurement', route: '/receive/records' },
    { label: 'Containers', route: '/receive/records/containers' },
  ];

  // KPI Metrics computed from current container dataset
  readonly inTransitCount = computed(() => {
    return this.containers().filter((c) => c.status === 'IN_TRANSIT').length;
  });

  readonly arrivedCount = computed(() => {
    return this.containers().filter((c) => c.status === 'ARRIVED' || c.status === 'CLEARED').length;
  });

  readonly closedCount = computed(() => {
    return this.containers().filter((c) => c.status === 'CLOSED').length;
  });

  readonly totalNetWeightSum = computed(() => {
    return this.containers().reduce((sum, c) => sum + Number(c.netWeight || 0), 0);
  });

  readonly filteredContainers = computed(() => {
    const list = this.containers();
    const filter = this.activeStatusFilter();
    if (filter === 'ALL') return list;
    if (filter === 'ARRIVED_CLEARED') {
      return list.filter((c) => c.status === 'ARRIVED' || c.status === 'CLEARED');
    }
    return list.filter((c) => c.status === filter);
  });

  ngOnInit(): void {
    this.loadContainers();
  }

  loadContainers(page = 1): void {
    const filters: ContainerFilters = {
      page,
      limit: 50,
    };
    this.procurementService.loadContainers(filters).subscribe();
  }

  setStatusFilter(status: string): void {
    this.activeStatusFilter.set(status);
  }

  onRowClick(container: Container): void {
    this.router.navigate(['/receive/records/containers', container.id]);
  }

  getStatusLabel(status: ContainerStatus): string {
    const labels: Record<ContainerStatus, string> = {
      IN_TRANSIT: 'In Transit',
      ARRIVED: 'Arrived at Port',
      CLEARED: 'Customs Cleared',
      CLOSED: 'Closed & Reconciled',
    };
    return labels[status] || status;
  }

  clearError(): void {
    this.procurementService.clearError();
  }
}
