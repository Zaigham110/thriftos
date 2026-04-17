import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';

import { RagService } from './rag.service';
import { Rag, RagStatus, RAG_STATUS_CONFIG, RAG_SOURCE_TYPE_LABELS } from './rag.models';
import { Container, ContainerStatus } from '../procurement.models';
import {
  AppBadgeComponent,
  AppButtonComponent,
  AppCardComponent,
  AppDataTableComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppStackComponent,
  type DataTableColumn,
} from '../../../shared/ui';
import { MoneyPipe } from '../../../core/money/money.pipe';

@Component({
  selector: 'app-rag-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    AppStackComponent,
    AppCardComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppDialogComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './rag-list.html',
  styleUrl: './rag-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);

  readonly container = input.required<Container>();

  readonly rags = signal<Rag[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly showSorted = signal(false);

  readonly showDeleteConfirm = signal(false);
  readonly deletingRag = signal<Rag | null>(null);

  readonly showSortingConfirm = signal(false);
  readonly sortingRag = signal<Rag | null>(null);

  readonly filteredRags = computed(() => {
    const allRags = this.rags();
    if (this.showSorted()) {
      return allRags;
    }
    return allRags.filter((r) => r.status !== 'SORTED');
  });

  readonly canAddRags = computed(() => {
    const cont = this.container();
    const allowedStatuses: ContainerStatus[] = ['ARRIVED', 'CLEARED'];
    return allowedStatuses.includes(cont.status);
  });

  readonly isContainerClosed = computed(() => {
    return this.container().status === 'CLOSED';
  });

  readonly currentTotalWeight = computed(() => {
    return this.rags().reduce((sum, rag) => sum + Number(rag.weightKg), 0);
  });

  readonly sortedCount = computed(() => {
    return this.rags().filter((r) => r.status === 'SORTED').length;
  });

  readonly totalCount = computed(() => this.rags().length);

  readonly ragColumns: DataTableColumn[] = [
    {
      key: 'ragCode',
      label: 'Rag Code',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as Rag).ragCode,
    },
    {
      key: 'ragBaleType',
      label: 'Type',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as Rag).ragBaleType,
    },
    {
      key: 'name',
      label: 'Category',
      sortable: true,
      getValue: (row) => (row as Rag).rawCategory?.name ?? '',
    },
    {
      key: 'weightKg',
      label: 'Weight (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as Rag).weightKg,
    },
    {
      key: 'allocatedCost',
      label: 'Allocated Cost',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as Rag).allocatedCost,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as Rag).status,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      getValue: (row) => (row as Rag).createdAt,
    },
  ];

  readonly deleteConfirmMessage = computed(() => {
    const rag = this.deletingRag();
    return `Are you sure you want to delete rag "${rag?.ragCode ?? ''}"? This action cannot be undone.`;
  });

  readonly sortingConfirmMessage = computed(() => {
    const rag = this.sortingRag();
    return `Start Sorting Stage 1 for rag "${rag?.ragCode ?? ''}"?`;
  });

  ngOnInit(): void {
    this.loadRags();
  }

  loadRags(): void {
    const containerId = this.container().id;
    this.loading.set(true);
    this.error.set(null);

    this.ragService.getRagsForContainer(containerId, { limit: 100 }).subscribe({
      next: (response) => {
        this.rags.set(response.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load rags');
        this.loading.set(false);
      },
    });
  }

  toggleShowSorted(): void {
    this.showSorted.update((v) => !v);
  }

  navigateToCreate(): void {
    const containerId = this.container().id;
    this.router.navigate(['/procurement/containers', containerId, 'rags', 'create']);
  }

  navigateToEdit(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only rags with status "Not Started" can be edited');
      return;
    }
    this.router.navigate(['/procurement/rags', rag.id, 'edit']);
  }

  confirmDelete(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only rags with status "Not Started" can be deleted');
      return;
    }
    this.deletingRag.set(rag);
    this.showDeleteConfirm.set(true);
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.deletingRag.set(null);
  }

  executeDelete(): void {
    const rag = this.deletingRag();
    if (!rag) return;

    this.actionLoading.set(true);
    this.ragService.deleteRag(rag.id).subscribe({
      next: () => {
        this.rags.update((rags) => rags.filter((r) => r.id !== rag.id));
        this.showDeleteConfirm.set(false);
        this.deletingRag.set(null);
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to delete rag');
        this.showDeleteConfirm.set(false);
        this.deletingRag.set(null);
        this.actionLoading.set(false);
      },
    });
  }

  confirmStartSorting(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only rags with status "Not Started" can be sorted');
      return;
    }
    this.sortingRag.set(rag);
    this.showSortingConfirm.set(true);
  }

  cancelStartSorting(): void {
    this.showSortingConfirm.set(false);
    this.sortingRag.set(null);
  }

  executeStartSorting(): void {
    const rag = this.sortingRag();
    if (!rag) return;

    this.actionLoading.set(true);
    this.showSortingConfirm.set(false);

    this.actionLoading.set(false);
    this.sortingRag.set(null);
    this.router.navigate(['/sorting/stage-1', rag.id]);
  }

  getStatusBadgeVariant(status: RagStatus): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    return RAG_STATUS_CONFIG[status]?.variant || 'default';
  }

  getStatusLabel(status: RagStatus): string {
    return RAG_STATUS_CONFIG[status]?.label || status;
  }

  getSourceTypeLabel(sourceType: string): string {
    return RAG_SOURCE_TYPE_LABELS[sourceType as keyof typeof RAG_SOURCE_TYPE_LABELS] || sourceType;
  }

  isEditable(rag: Rag): boolean {
    return rag.status === 'NOT_STARTED' && !this.isContainerClosed();
  }

  canStartSorting(rag: Rag): boolean {
    return rag.status === 'NOT_STARTED' && !this.isContainerClosed();
  }

  getSortingTooltip(rag: Rag): string {
    if (this.isContainerClosed()) {
      return 'Container is closed';
    }
    if (rag.status === 'IN_SORTING') {
      return 'This rag is currently being sorted';
    }
    if (rag.status === 'SORTED') {
      return 'This rag has already been sorted';
    }
    return 'Start Sorting Stage 1 for this rag';
  }

  clearError(): void {
    this.error.set(null);
  }

  trackByRagId(_: number, rag: Rag): string {
    return rag.id;
  }
}
