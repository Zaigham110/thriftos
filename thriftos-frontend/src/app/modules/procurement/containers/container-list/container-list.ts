import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ProcurementService } from '../../procurement.service';
import {
  Container,
  ContainerStatus,
  ContainerFilters,
} from '../../procurement.models';
import {
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
  type DataTableColumn,
  type DataTableState,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-container-list',
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
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './container-list.html',
  styleUrl: './container-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerListComponent implements OnInit {
  private readonly procurementService = inject(ProcurementService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly containers = this.procurementService.containers;
  readonly loading = this.procurementService.loading;
  readonly error = this.procurementService.error;
  readonly totalCount = this.procurementService.containerTotalCount;
  readonly currentPage = this.procurementService.containerCurrentPage;
  readonly totalPages = this.procurementService.containerTotalPages;

  private readonly lastRequestKey = signal<string>('');

  readonly tableColumns: DataTableColumn[] = [
    { key: 'containerNumber', label: 'Container #', sortable: true, filterable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: '', label: 'All' },
        { value: 'IN_TRANSIT', label: 'In Transit' },
        { value: 'ARRIVED', label: 'Arrived' },
        { value: 'CLEARED', label: 'Cleared' },
        { value: 'CLOSED', label: 'Closed' },
      ],
    },
    {
      key: 'netWeight',
      label: 'Net Weight (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as Container).netWeight,
    },
    { key: 'eta', label: 'ETA', sortable: true },
  ];

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Procurement', route: '/procurement/dashboard' },
    { label: 'Containers', route: '/procurement/containers' },
  ];

  clearError(): void {
    this.procurementService.clearError();
  }

  ngOnInit(): void {
    this.loadFromQueryParams();
  }

  private loadFromQueryParams(): void {
    this.loadContainers();
  }

  loadContainers(page = 1): void {
    const filters: ContainerFilters = {
      page,
      limit: 20,
    };

    this.procurementService.loadContainers(filters).subscribe();
  }

  onTableStateChange(state: DataTableState): void {
    const status = String(state.filters['status'] ?? '').trim();
    const requestKey = [state.pageIndex, state.pageSize, status].join('|');
    if (requestKey === this.lastRequestKey()) return;
    this.lastRequestKey.set(requestKey);

    this.procurementService
      .loadContainers({
        page: state.pageIndex,
        limit: state.pageSize,
        status: status ? (status as ContainerStatus) : undefined,
      })
      .subscribe();
  }

  onRowClick(container: Container): void {
    this.router.navigate(['/procurement/containers', container.id]);
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
