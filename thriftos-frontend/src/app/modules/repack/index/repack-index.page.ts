/**
 * REPACK INDEX PAGE — ALIGNED WITH PROCUREMENT GOLDEN REFERENCE
 * =============================================================
 * Table-based layout like all other ERP modules
 */

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RepackService } from '../repack.service';
import { RepackUnit, RepackStatus } from '../repack.models';
import { AuthService } from '../../../core/auth/auth';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppDialogComponent,
  AppDataTableComponent,
  type DataTableColumn,
} from '../../../shared/ui';

@Component({
  selector: 'app-repack-index',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppButtonComponent,
    AppStackComponent,
    AppBadgeComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppErrorStateComponent,
    AppDialogComponent,
    AppDataTableComponent,
  ],
  templateUrl: './repack-index.page.html',
  styleUrl: './repack-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackIndexComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly repackService = inject(RepackService);
  private readonly authService = inject(AuthService);

  // Breadcrumbs
  readonly breadcrumbs = [
    { label: 'Packaging', link: '/packaging' },
    { label: 'Repack', link: undefined },
  ];

  // Data — unified list
  readonly allUnits = signal<RepackUnit[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Filter
  readonly statusFilter = signal<'ALL' | RepackStatus>('ALL');

  // Computed filtered list
  readonly filteredUnits = computed(() => {
    const filter = this.statusFilter();
    const units = this.allUnits();
    if (filter === 'ALL') return units;
    return units.filter(u => u.status === filter);
  });

  // Total count for subtitle
  readonly totalCount = computed(() => this.allUnits().length);

  // Table columns — Procurement pattern
  readonly tableColumns: DataTableColumn[] = [
    { key: 'unitCode', label: 'Unit Code', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'category', label: 'Category', getValue: (row) => (row as RepackUnit).category?.name || '—' },
    { key: 'grade', label: 'Grade', getValue: (row) => (row as RepackUnit).grade?.name || '—' },
    { key: 'progress', label: 'Progress' },
    { key: 'createdAt', label: 'Created', sortable: true },
    { key: 'sealedAt', label: 'Sealed' },
  ];

  // Delete modal
  readonly showDeleteModal = signal(false);
  readonly unitToDelete = signal<RepackUnit | null>(null);
  readonly deleting = signal(false);

  // Permissions
  readonly canCreate = computed(() => this.authService.hasPermission('REPACK_CREATE'));
  readonly canDelete = computed(() => this.authService.hasPermission('REPACK_DELETE'));

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    // Load all units (both drafts and sealed)
    this.repackService.getAllUnits().subscribe({
      next: (units) => {
        this.allUnits.set(units || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load repack units');
        this.loading.set(false);
      },
    });
  }

  onRowClick(row: RepackUnit): void {
    this.router.navigate(['/packaging/repack', row.id]);
  }

  getStatusVariant(status: RepackStatus): 'warning' | 'success' {
    return status === 'DRAFT' ? 'warning' : 'success';
  }

  confirmDelete(unit: RepackUnit, event: Event): void {
    event.stopPropagation();
    this.unitToDelete.set(unit);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.unitToDelete.set(null);
  }

  deleteDraft(): void {
    const unit = this.unitToDelete();
    if (!unit) return;

    this.deleting.set(true);
    this.repackService.deleteDraft(unit.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeDeleteModal();
        this.loadData();
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err.message);
      },
    });
  }
}
