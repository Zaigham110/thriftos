/**
 * Stage 2 Grading Ready Queue Page Component
 * 
 * High-density queue directory for Stage 2 Quality Grading & Classification.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Layers,
  Sparkles,
  Scale,
  Play,
  ArrowRight,
  RefreshCw,
  Clock,
  Package,
} from 'lucide-angular';

import type { AvailableForGrading } from '../../sorting-stage2/sorting-stage2.models';
import { SortingFacadeService } from '../sorting-facade.service';
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
  selector: 'app-sorting-stage2-ready-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
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
  templateUrl: './sorting-stage2-ready.page.html',
  styleUrl: './sorting-stage2-ready.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage2ReadyPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sorting', route: '/app/sorting/stage-1' },
    { label: 'Stage 2 — Quality Grading' },
  ];

  readonly icons = {
    Layers,
    Sparkles,
    Scale,
    Play,
    ArrowRight,
    RefreshCw,
    Clock,
    Package,
  };

  readonly rows = signal<AvailableForGrading[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  // Computed KPI Metrics
  readonly notStartedCount = computed(() => {
    return this.rows().filter((r) => !r.gradeStatus || r.gradeStatus === 'NOT_STARTED').length;
  });

  readonly inProgressCount = computed(() => {
    return this.rows().filter((r) => r.gradeStatus === 'IN_PROGRESS').length;
  });

  readonly totalGradingWeight = computed(() => {
    return this.rows().reduce((sum, r) => sum + Number(r.weightKg || 0), 0);
  });

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page(), pageSize = this.pageSize()): void {
    this.loading.set(true);
    this.error.set(null);

    this.facade.stage2Queue(page, pageSize).subscribe({
      next: (resp) => {
        this.rows.set(resp.data);
        this.total.set(resp.total);
        this.page.set(resp.page);
        this.pageSize.set(resp.limit);
        this.totalPages.set(resp.totalPages ?? 1);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load available category outputs');
        this.loading.set(false);
      },
    });
  }

  grade(output: AvailableForGrading): void {
    this.router.navigate(['/app/sorting/stage-2', output.id]);
  }

  clearError(): void {
    this.error.set(null);
  }
}
