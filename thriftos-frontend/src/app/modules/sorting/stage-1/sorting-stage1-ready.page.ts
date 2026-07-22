/**
 * Sorting Stage 1 Ready Page Component
 * 
 * High-density queue directory for primary breakdown sorting stage (Rags & Loose Bales).
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Package,
  Layers,
  Scale,
  Play,
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle2,
} from 'lucide-angular';

import { SortingFacadeService, type Stage1QueueItem } from '../sorting-facade.service';
import {
  AppBreadcrumbComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-stage1-ready-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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
  templateUrl: './sorting-stage1-ready.page.html',
  styleUrl: './sorting-stage1-ready.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage1ReadyPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sorting', route: '/app/sorting/stage-1' },
    { label: 'Stage 1 — Primary Breakdown' },
  ];

  readonly icons = {
    Package,
    Layers,
    Scale,
    Play,
    ArrowRight,
    RefreshCw,
    Clock,
    CheckCircle2,
  };

  readonly rows = signal<Stage1QueueItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly total = signal(0);

  // Computed KPI Metrics
  readonly notStartedCount = computed(() => {
    return this.rows().filter((r) => r.status === 'NOT_STARTED').length;
  });

  readonly inSortingCount = computed(() => {
    return this.rows().filter((r) => r.status === 'IN_SORTING').length;
  });

  readonly totalQueueWeight = computed(() => {
    return this.rows().reduce((sum, r) => sum + Number(r.weightKg || 0), 0);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.facade.stage1Queue(1, 1000, undefined).subscribe({
      next: (resp) => {
        this.rows.set(resp.data);
        this.total.set(resp.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load ready rags/bales');
        this.loading.set(false);
      },
    });
  }

  start(item: Stage1QueueItem): void {
    const id = item.sourceType === 'LOOSE_BALE' ? item.sourceId || item.id : item.id;
    const sourceType = item.sourceType || 'RAG';

    this.router.navigate(['/app/sorting/stage-1', id], {
      state: { sourceType },
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  getSourceLabel(item: Stage1QueueItem): string {
    if (item.sourceType === 'LOOSE_BALE') return 'Loose Bale';
    if (item.containerId) return 'Container Rag';
    return 'Loose Rag';
  }
}
