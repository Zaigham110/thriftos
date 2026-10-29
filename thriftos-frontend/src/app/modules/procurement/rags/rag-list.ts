/**
 * Rag List Component
 * Phase 2: Procurement & Intake UI
 * 
 * Embedded component inside Container Detail page displaying intake rags/bales, weight specs, allocated landed costs, and sorting triggers.
 */

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
import {
  LucideAngularModule,
  Plus,
  Pencil,
  Trash2,
  Play,
  Package,
  Layers,
  Scale,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  RefreshCw,
} from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag, RagStatus, RAG_STATUS_CONFIG, RAG_SOURCE_TYPE_LABELS } from './rag.models';
import { Container, ContainerStatus } from '../procurement.models';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBadgeComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-rag-list',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
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

  readonly icons = {
    Plus,
    Pencil,
    Trash2,
    Play,
    Package,
    Layers,
    Scale,
    CheckCircle2,
    Clock,
    ArrowRight,
    Eye,
    RefreshCw,
  };

  readonly filteredRags = computed(() => {
    const allRags = this.rags();
    if (this.showSorted()) {
      return allRags;
    }
    return allRags.filter((r) => r.status !== 'SORTED');
  });

  readonly canAddRags = computed(() => {
    const cont = this.container();
    const allowedStatuses: ContainerStatus[] = ['IN_TRANSIT', 'ARRIVED', 'CLEARED'];
    return allowedStatuses.includes(cont.status);
  });

  readonly isContainerClosed = computed(() => {
    return this.container().status === 'CLOSED';
  });

  readonly currentTotalWeight = computed(() => {
    return this.rags().reduce((sum, rag) => sum + Number(rag.weightKg), 0);
  });

  readonly currentTotalCost = computed(() => {
    return this.rags().reduce((sum, rag) => sum + Number(rag.allocatedCost || 0), 0);
  });

  readonly sortedCount = computed(() => {
    return this.rags().filter((r) => r.status === 'SORTED').length;
  });

  readonly pendingCount = computed(() => {
    return this.rags().filter((r) => r.status === 'NOT_STARTED').length;
  });

  readonly totalCount = computed(() => this.rags().length);

  readonly deleteConfirmMessage = computed(() => {
    const rag = this.deletingRag();
    return `Are you sure you want to delete intake item "${rag?.ragCode ?? ''}"? Landed cost allocations will recalculate automatically.`;
  });

  readonly sortingConfirmMessage = computed(() => {
    const rag = this.sortingRag();
    return `Start Sorting Stage 1 workspace for intake item "${rag?.ragCode ?? ''}"?`;
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
        this.error.set(err.message || 'Failed to load intake items');
        this.loading.set(false);
      },
    });
  }

  toggleShowSorted(): void {
    this.showSorted.update((v) => !v);
  }

  navigateToCreate(): void {
    const containerId = this.container().id;
    this.router.navigate(['/app/procurement/containers', containerId, 'rags', 'create']);
  }

  navigateToEdit(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only intake items with status "Not Started" can be edited');
      return;
    }
    this.router.navigate(['/app/procurement/rags', rag.id, 'edit']);
  }

  confirmDelete(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only intake items with status "Not Started" can be deleted');
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
        this.error.set(err.message || 'Failed to delete intake item');
        this.showDeleteConfirm.set(false);
        this.deletingRag.set(null);
        this.actionLoading.set(false);
      },
    });
  }

  confirmStartSorting(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only intake items with status "Not Started" can be sorted');
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
    this.router.navigate(['/app/flow/transform', rag.id]);
  }

  getStatusLabel(status: RagStatus): string {
    const labels: Record<RagStatus, string> = {
      NOT_STARTED: 'Not Started',
      IN_SORTING: 'In Sorting',
      SORTED: 'Sorted',
    };
    return labels[status] || status;
  }

  isEditable(rag: Rag): boolean {
    return rag.status === 'NOT_STARTED' && !this.isContainerClosed();
  }

  canStartSorting(rag: Rag): boolean {
    return rag.status === 'NOT_STARTED' && !this.isContainerClosed();
  }

  clearError(): void {
    this.error.set(null);
  }
}
