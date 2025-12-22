/**
 * Container List Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/containers
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, ChevronLeft, ChevronRight, Box } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import {
  Container,
  ContainerStatus,
  ContainerFilters,
} from '../../procurement.models';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  BadgeComponent,
  SelectComponent,
  SelectOption,
  SkeletonComponent,
  EmptyStateComponent,
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
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    BadgeComponent,
    SelectComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './container-list.html',
  styleUrl: './container-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerListComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly icons = {
    ChevronLeft,
    ChevronRight,
    Box,
  };

  readonly containers = this.procurementService.containers;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;
  readonly totalCount = this.procurementService.containerTotalCount;
  readonly currentPage = this.procurementService.containerCurrentPage;
  readonly totalPages = this.procurementService.containerTotalPages;

  readonly statusFilter = signal<ContainerStatus | ''>('');

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Procurement', link: '/app/procurement' },
    { label: 'Containers' },
  ];

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'ARRIVED', label: 'Arrived' },
    { value: 'CLEARED', label: 'Cleared' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  clearError(): void {
    this.procurementService.clearError();
  }

  ngOnInit(): void {
    this.loadFromQueryParams();
  }

  private loadFromQueryParams(): void {
    const status = this.route.snapshot.queryParamMap.get('status') as ContainerStatus | null;
    if (status) {
      this.statusFilter.set(status);
    }
    this.loadContainers();
  }

  loadContainers(page = 1): void {
    const filters: ContainerFilters = {
      page,
      limit: 20,
    };

    if (this.statusFilter()) {
      filters.status = this.statusFilter() as ContainerStatus;
    }

    this.procurementService.loadContainers(filters).subscribe();
  }

  onStatusFilterChange(status: string | number): void {
    this.statusFilter.set(String(status) as ContainerStatus | '');
    this.loadContainers(1);
  }

  onRowClick(container: Container): void {
    this.router.navigate(['/app/procurement/containers', container.id]);
  }

  onPageChange(page: number): void {
    this.loadContainers(page);
  }

  getStatusVariant(status: ContainerStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const variants: Record<ContainerStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
      IN_TRANSIT: 'warning',
      ARRIVED: 'primary',
      CLEARED: 'success',
      CLOSED: 'default',
    };
    return variants[status] || 'default';
  }

  getStatusLabel(status: ContainerStatus): string {
    return status.replace('_', ' ');
  }
}
