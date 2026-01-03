import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
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
  AppErrorStateComponent,
  AppSelectComponent,
  AppEmptyStateComponent,
  type DataTableColumn,
  type DataTableState,
  type BreadcrumbItem,
  type SelectOption,
} from '../../../../shared/ui';
import { SortingStage2Service } from '../../sorting-stage2.service';
import { GradeSession, GradeStatus, AvailableForGrading } from '../../sorting-stage2.models';

@Component({
  selector: 'app-grading-session-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
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
    AppErrorStateComponent,
    AppSelectComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './grading-session-list.html',
  styleUrl: './grading-session-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradingSessionListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly gradingService = inject(SortingStage2Service);

  // Breadcrumbs
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Sorting Stage 2' },
  ];

  // Local state
  readonly searchQuery = signal('');
  readonly statusFilter = signal<GradeStatus | ''>('');
  readonly pageSize = signal(20);
  readonly startingGrading = signal<string | null>(null);
  readonly startingRepack = signal<string | null>(null);

  // Service state
  readonly loading = this.gradingService.loading;
  readonly error = this.gradingService.error;
  readonly sessions = this.gradingService.sessions;
  readonly totalCount = this.gradingService.totalCount;
  readonly currentPage = this.gradingService.currentPage;
  readonly totalPages = this.gradingService.totalPages;
  
  // Available for grading
  readonly availableForGrading = this.gradingService.availableForGrading;
  readonly availableTotal = computed(() => this.availableForGrading().length);

  // Status options
  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'OPEN', label: 'Open' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  // Table Columns - Available
  readonly availableColumns: DataTableColumn[] = [
    { key: 'category', label: 'Category' },
    { key: 'weight', label: 'Weight', align: 'right' },
    { key: 'container', label: 'Container' },
    { key: 'source', label: 'Source' },
    { key: 'sortedAt', label: 'Sorted At' },
    { key: 'actions', label: '', align: 'right' },
  ];

  // Table Columns - Sessions
  readonly sessionColumns: DataTableColumn[] = [
    { key: 'id', label: 'Session ID', sortable: true },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'inputWeight', label: 'Input Weight', align: 'right' },
    { key: 'outputWeight', label: 'Output Weight', align: 'right' },
    { key: 'createdAt', label: 'Created', sortable: true },
    { key: 'actions', label: '', align: 'right' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.gradingService.loadAvailableForGrading().subscribe();
    this.loadSessions();
  }

  loadSessions(page = 1): void {
    const status = this.statusFilter() || undefined;
    this.gradingService.loadSessions({ 
      status, 
      page, 
      limit: this.pageSize() 
    }).subscribe();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status as GradeStatus | '');
    this.loadSessions(1);
  }

  onTableStateChange(state: DataTableState): void {
    this.loadSessions(state.pageIndex);
  }

  onSessionRowClick(session: GradeSession): void {
    this.router.navigate(['/sorting/stage-2', session.id]);
  }

  startGrading(item: AvailableForGrading): void {
    if (this.startingGrading()) return;
    
    this.startingGrading.set(item.id);
    this.gradingService.startSession(item.id).subscribe({
      next: (session) => {
        this.startingGrading.set(null);
        this.router.navigate(['/sorting/stage-2', session.id]);
      },
      error: () => {
        this.startingGrading.set(null);
      }
    });
  }

  getStatusVariant(status: GradeStatus): 'primary' | 'success' | 'default' {
    switch (status) {
      case 'OPEN':
        return 'primary';
      case 'CLOSED':
        return 'success';
      default:
        return 'default';
    }
  }

  // Helpers for Available Items
  getAvailableCategoryName(item: AvailableForGrading): string {
    return item.category?.name || 'Unknown Category';
  }

  getAvailableContainerRef(item: AvailableForGrading): string {
    return item.container?.containerNumber || 'Unknown';
  }

  getAvailableRagCode(item: AvailableForGrading): string {
    if (item.rag) return item.rag.ragCode;
    return '—';
  }

  // Helpers for Sessions
  getSessionCategoryName(session: GradeSession): string {
    return session.categoryOutput?.category?.name || 'Unknown';
  }
}