/**
 * Sorting Session List Component
 * Phase 3: Category Sorting UI
 * 
 * Dense ERP table displaying all sorting sessions
 */

import { Component, OnInit, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppBadgeComponent,
  AppErrorStateComponent,
  AppSelectComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  type DataTableColumn,
  type DataTableState,
  type BreadcrumbItem,
  type SelectOption,
} from '../../../../shared/ui';
import { AuthService } from '../../../../core/auth/auth';
import { SortingStage1Service } from '../../sorting-stage1.service';
import { SortSession, SortStatus } from '../../sorting-stage1.models';

@Component({
  selector: 'app-sorting-session-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppErrorStateComponent,
    AppSelectComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
  ],
  templateUrl: './sorting-session-list.html',
  styleUrl: './sorting-session-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingSessionListComponent implements OnInit {
  private readonly sortingService = inject(SortingStage1Service);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Breadcrumbs
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Sorting Stage 1' },
  ];

  // State
  readonly loading = this.sortingService.loading;
  readonly error = this.sortingService.error;
  readonly sessions = this.sortingService.sessions;
  readonly totalCount = this.sortingService.totalCount;
  readonly currentPage = this.sortingService.currentPage;
  readonly totalPages = this.sortingService.totalPages;

  // Filters
  readonly statusFilter = signal<SortStatus | ''>('');

  // Status options
  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  // Table Columns
  readonly tableColumns: DataTableColumn[] = [
    { key: 'id', label: 'Session ID', sortable: true },
    { key: 'source', label: 'Source' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'inputWeight', label: 'Input Weight', align: 'right' },
    { key: 'outputWeight', label: 'Output Weight', align: 'right' },
    { key: 'wastePct', label: 'Waste %', align: 'right' },
    { key: 'createdAt', label: 'Created', sortable: true },
    { key: 'actions', label: '', align: 'right' },
  ];

  // Permission checks
  readonly canCreate = computed(() => {
    const user = this.authService.user();
    const permissions = this.authService.permissions();
    return (
      user?.isSuperAdmin ||
      permissions.includes('SORTING_STAGE1_CREATE')
    );
  });

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(page = 1): void {
    const status = this.statusFilter() || undefined;
    this.sortingService.loadSessions({ status, page, limit: 20 }).subscribe();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status as SortStatus | '');
    this.loadSessions(1);
  }

  onTableStateChange(state: DataTableState): void {
    this.loadSessions(state.pageIndex);
  }

  onRowClick(session: SortSession): void {
    this.router.navigate(['/sorting/stage-1', session.id]);
  }

  getStatusVariant(status: SortStatus): 'primary' | 'success' | 'default' {
    switch (status) {
      case 'OPEN':
        return 'primary';
      case 'CLOSED':
        return 'success';
      default:
        return 'default';
    }
  }

  getSourceDisplay(session: SortSession): string {
    if (session.rag) {
      return `RAG: ${session.rag.ragCode}`;
    }
    if (session.incomingBale) {
      return `Bale: ${session.incomingBale.baleCode}`;
    }
    return 'Unknown';
  }

  dismissError(): void {
    this.sortingService.clearError();
  }
}
