import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProcurementService } from '../../procurement.service';
import { IncomingBale } from '../../procurement.models';
import {
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
  selector: 'app-incoming-bale-list',
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
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    DatePipe,
    DecimalPipe,
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

  private readonly lastRequestKey = signal<string>('');

  readonly tableColumns: DataTableColumn[] = [
    { key: 'baleCode', label: 'Bale Code', sortable: true, filterable: true },
    { key: 'name', label: 'Category', sortable: true, getValue: (row) => (row as IncomingBale).rawCategory?.name ?? '' },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as IncomingBale).weightKg,
    },
    {
      key: 'cost',
      label: 'Cost',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as IncomingBale).cost,
    },
    {
      key: 'costPerKg',
      label: 'Cost/kg',
      align: 'right',
      getValue: (row) => (row as IncomingBale).cost / (row as IncomingBale).weightKg,
    },
    { key: 'createdAt', label: 'Created', sortable: true },
  ];

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Procurement', route: '/procurement/dashboard' },
    { label: 'Loose Bales', route: '/procurement/loose-bales' },
  ];

  ngOnInit(): void {
    this.loadBales();
  }

  loadBales(page = 1): void {
    this.procurementService.loadIncomingBales({ page, limit: 20 }).subscribe();
  }

  onTableStateChange(state: DataTableState): void {
    const requestKey = [state.pageIndex, state.pageSize].join('|');
    if (requestKey === this.lastRequestKey()) return;
    this.lastRequestKey.set(requestKey);

    this.procurementService
      .loadIncomingBales({
        page: state.pageIndex,
        limit: state.pageSize,
      })
      .subscribe();
  }

  onRowClick(bale: IncomingBale): void {
    this.router.navigate(['/procurement/loose-bales', bale.id]);
  }
}
