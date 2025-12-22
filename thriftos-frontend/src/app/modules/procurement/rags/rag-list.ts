/**
 * Rag List Component
 * Phase 2.5: Container Breakdown
 * 
 * Displays list of Rags/Bales for a container with status-based filtering.
 * Shows "Start Sorting" action for NOT_STARTED rags only.
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
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Plus,
  Play,
  Edit2,
  Trash2,
  Package,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag, RagStatus, RAG_STATUS_CONFIG, RAG_SOURCE_TYPE_LABELS } from './rag.models';
import { Container, ContainerStatus } from '../procurement.models';
import { SortingStage1Service } from '../../sorting-stage1/sorting-stage1.service';

import {
  ButtonComponent,
  AlertComponent,
  BadgeComponent,
  SkeletonComponent,
  EmptyStateComponent,
  ConfirmDialogComponent,
} from '../../../shared/ui';
import { RagCreateDrawerComponent } from './rag-create-drawer';
import { RagEditDrawerComponent } from './rag-edit-drawer';

@Component({
  selector: 'app-rag-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    LucideAngularModule,
    ButtonComponent,
    AlertComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    RagCreateDrawerComponent,
    RagEditDrawerComponent,
  ],
  templateUrl: './rag-list.html',
  styleUrl: './rag-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);
  private readonly sortingService = inject(SortingStage1Service);

  // =============================================================
  // INPUTS
  // =============================================================

  readonly container = input.required<Container>();

  // =============================================================
  // ICONS
  // =============================================================

  readonly icons = {
    plus: Plus,
    play: Play,
    edit: Edit2,
    trash: Trash2,
    package: Package,
    eye: Eye,
    eyeOff: EyeOff,
    alertCircle: AlertCircle,
  };

  // =============================================================
  // STATE
  // =============================================================

  readonly rags = signal<Rag[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);
  
  // Filter state
  readonly showSorted = signal(false);
  
  // Drawer state
  readonly showCreateDrawer = signal(false);
  readonly showEditDrawer = signal(false);
  readonly editingRag = signal<Rag | null>(null);
  
  // Delete confirmation
  readonly showDeleteConfirm = signal(false);
  readonly deletingRag = signal<Rag | null>(null);
  
  // Start Sorting confirmation
  readonly showSortingConfirm = signal(false);
  readonly sortingRag = signal<Rag | null>(null);

  // =============================================================
  // COMPUTED
  // =============================================================

  /**
   * Filter rags based on showSorted toggle
   * By default, hide SORTED rags (Phase 2.5 requirement)
   */
  readonly filteredRags = computed(() => {
    const allRags = this.rags();
    if (this.showSorted()) {
      return allRags;
    }
    return allRags.filter((r) => r.status !== 'SORTED');
  });

  /**
   * Container must be RECEIVED or later to allow adding rags
   */
  readonly canAddRags = computed(() => {
    const cont = this.container();
    const allowedStatuses: ContainerStatus[] = ['ARRIVED', 'CLEARED'];
    return allowedStatuses.includes(cont.status);
  });

  /**
   * Container must not be closed
   */
  readonly isContainerClosed = computed(() => {
    return this.container().status === 'CLOSED';
  });

  /**
   * Calculate total weight of all rags in container
   */
  readonly currentTotalWeight = computed(() => {
    return this.rags().reduce((sum, rag) => sum + Number(rag.weightKg), 0);
  });

  readonly sortedCount = computed(() => {
    return this.rags().filter((r) => r.status === 'SORTED').length;
  });

  readonly totalCount = computed(() => this.rags().length);

  /**
   * Delete confirmation message
   */
  readonly deleteConfirmMessage = computed(() => {
    const rag = this.deletingRag();
    return `Are you sure you want to delete rag "${rag?.ragCode ?? ''}"? This action cannot be undone.`;
  });

  /**
   * Start sorting confirmation message
   */
  readonly sortingConfirmMessage = computed(() => {
    const rag = this.sortingRag();
    return `Start Sorting Stage 1 for rag "${rag?.ragCode ?? ''}"? This will create a new sorting session and the rag status will change to In Sorting.`;
  });

  // =============================================================
  // LIFECYCLE
  // =============================================================

  ngOnInit(): void {
    this.loadRags();
  }

  // =============================================================
  // DATA LOADING
  // =============================================================

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

  // =============================================================
  // ACTIONS
  // =============================================================

  toggleShowSorted(): void {
    this.showSorted.update((v) => !v);
  }

  openCreateDrawer(): void {
    this.showCreateDrawer.set(true);
  }

  closeCreateDrawer(): void {
    this.showCreateDrawer.set(false);
  }

  onRagCreated(rag: Rag): void {
    this.rags.update((rags) => [rag, ...rags]);
    this.showCreateDrawer.set(false);
  }

  openEditDrawer(rag: Rag): void {
    if (rag.status !== 'NOT_STARTED') {
      this.error.set('Only rags with status "Not Started" can be edited');
      return;
    }
    this.editingRag.set(rag);
    this.showEditDrawer.set(true);
  }

  closeEditDrawer(): void {
    this.showEditDrawer.set(false);
    this.editingRag.set(null);
  }

  onRagUpdated(updatedRag: Rag): void {
    this.rags.update((rags) =>
      rags.map((r) => (r.id === updatedRag.id ? updatedRag : r))
    );
    this.showEditDrawer.set(false);
    this.editingRag.set(null);
  }

  // Delete
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

  // Start Sorting
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

    // Create sorting session and redirect
    this.sortingService.createSession({ ragId: rag.id }).subscribe({
      next: (session) => {
        this.actionLoading.set(false);
        // Redirect to sorting session
        this.router.navigate(['/app/sorting/stage1', session.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to start sorting session');
        this.actionLoading.set(false);
        this.sortingRag.set(null);
      },
    });
  }

  // =============================================================
  // HELPERS
  // =============================================================

  getStatusBadgeVariant(status: RagStatus): 'default' | 'warning' | 'success' | 'danger' {
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
    return rag.status === 'NOT_STARTED';
  }

  clearError(): void {
    this.error.set(null);
  }

  trackByRagId(_: number, rag: Rag): string {
    return rag.id;
  }
}
