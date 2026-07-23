/**
 * Sorting Stage 1 Ready Page Component
 * 
 * High-density queue directory for primary breakdown sorting stage (Rags & Loose Bales).
 * Includes Live Operator Speed (KG/hr) Scoreboard Audit.
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
  Zap,
  TrendingUp,
  Award,
  Users,
} from 'lucide-angular';

import { SortingFacadeService, type Stage1QueueItem } from '../sorting-facade.service';
import {
  AppBreadcrumbComponent,
  AppDialogComponent,
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
    AppDialogComponent,
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
    Zap,
    TrendingUp,
    Award,
    Users,
  };

  readonly rows = signal<Stage1QueueItem[]>([]);
  readonly productivity = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isProductivityModalOpen = signal(false);

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
    this.loadProductivity();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.facade.stage1Queue(1, 100).subscribe({
      next: (res) => {
        const items = res?.data || (Array.isArray(res) ? res : []);
        this.rows.set(items);
        this.total.set(res?.total ?? items.length ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load sorting queue');
        this.loading.set(false);
      },
    });
  }

  loadProductivity(): void {
    this.facade.getProductivity().subscribe({
      next: (data) => this.productivity.set(data),
      error: () => this.productivity.set(null),
    });
  }

  start(item: Stage1QueueItem): void {
    const id = item.ragCode ? item.id : item.sourceId || item.id;
    this.router.navigate(['/app/sorting/stage-1', id]);
  }

  openWorkstation(): void {
    this.router.navigate(['/app/sorting/workstation']);
  }

  openProductivityModal(): void {
    this.isProductivityModalOpen.set(true);
  }

  closeProductivityModal(): void {
    this.isProductivityModalOpen.set(false);
  }

  getSourceLabel(item: Stage1QueueItem): string {
    return item.sourceType === 'LOOSE_BALE' ? 'Loose Bale' : 'Container Rag';
  }
}
