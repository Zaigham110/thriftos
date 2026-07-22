/**
 * Sorting Output Registry List Component
 * Phase 2: Sorting Module UI
 * 
 * High-density directory table and KPI cards for finished Grade Outputs.
 */

import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Sparkles,
  Layers,
  Package,
  Truck,
  FileText,
  RefreshCw,
  ArrowRight,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-angular';

import type { GradeOutput, GradingOutputStatus } from '../../sorting-stage2/sorting-stage2.models';
import { GRADING_OUTPUT_STATUS_CONFIG as STATUS_CONFIG } from '../../sorting-stage2/sorting-stage2.models';
import { SortingFacadeService } from '../sorting-facade.service';
import { MoneyPipe } from '../../../core/money/money.pipe';
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
  selector: 'app-sorting-outputs-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DecimalPipe,
    MoneyPipe,
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
  templateUrl: './sorting-outputs.page.html',
  styleUrl: './sorting-outputs.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingOutputsPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sorting', route: '/app/sorting/stage-1' },
    { label: 'Output Registry' },
  ];

  readonly icons = {
    Sparkles,
    Layers,
    Package,
    Truck,
    FileText,
    RefreshCw,
    ArrowRight,
    PackageCheck,
    CheckCircle2,
    AlertCircle,
    Eye,
  };

  readonly rows = signal<GradeOutput[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly marking = signal(false);
  readonly markingOutputId = signal<string | null>(null);

  readonly confirmRepackDialog = signal(false);
  readonly pendingRepackOutput = signal<GradeOutput | null>(null);

  // Computed KPI Metrics
  readonly availableCount = computed(() => {
    return this.rows().filter((r) => !r.status || r.status === 'AVAILABLE' || r.status === 'READY_FOR_REPACK').length;
  });

  readonly totalRemainingWeight = computed(() => {
    return this.rows().reduce((sum, r) => {
      const rem = Number((r as any).remainingAmount ?? (r as any).totalAmount ?? (r as any).weightKg ?? 0);
      return sum + rem;
    }, 0);
  });

  readonly totalAllocatedCost = computed(() => {
    return this.rows().reduce((sum, r) => sum + Number((r as any).allocatedCost ?? 0), 0);
  });

  ngOnInit(): void {
    this.load();
  }

  load(page = this.page(), pageSize = this.pageSize()): void {
    this.loading.set(true);
    this.error.set(null);

    this.facade.outputs(page, pageSize).subscribe({
      next: (resp) => {
        this.rows.set(resp.data);
        this.total.set(resp.total);
        this.page.set(resp.page);
        this.pageSize.set(resp.limit);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load grade outputs');
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: string | undefined): string {
    const s = (status ?? 'AVAILABLE') as GradingOutputStatus;
    return STATUS_CONFIG[s]?.label ?? status ?? 'Available';
  }

  canMarkReady(row: GradeOutput): boolean {
    const status = row.status ?? 'AVAILABLE';
    return status === 'AVAILABLE' || status === 'PARTIALLY_USED';
  }

  promptMarkReadyForRepack(row: GradeOutput): void {
    if (!this.canMarkReady(row)) return;
    this.pendingRepackOutput.set(row);
    this.confirmRepackDialog.set(true);
  }

  cancelMarkReady(): void {
    this.confirmRepackDialog.set(false);
    this.pendingRepackOutput.set(null);
  }

  confirmMarkReady(): void {
    const row = this.pendingRepackOutput();
    if (!row) return;

    this.confirmRepackDialog.set(false);
    this.marking.set(true);
    this.markingOutputId.set(row.id);

    this.facade.markOutputReadyForRepack(row.id).subscribe({
      next: () => {
        this.marking.set(false);
        this.markingOutputId.set(null);
        this.pendingRepackOutput.set(null);
        this.load();
      },
      error: (err) => {
        this.marking.set(false);
        this.markingOutputId.set(null);
        this.error.set(err?.message || 'Failed to mark output as ready');
      },
    });
  }

  outputCode(row: GradeOutput): string {
    return `OUT-${String(row.id).slice(0, 8).toUpperCase()}`;
  }

  viewDetails(row: GradeOutput): void {
    this.router.navigate(['/app/sorting/outputs', row.id]);
  }

  isRepackEligible(row: GradeOutput): boolean {
    const remaining = Number((row as any).remainingAmount ?? (row as any).totalAmount ?? (row as any).weightKg ?? 0);
    const status = String(row.status ?? 'AVAILABLE');
    return remaining > 0 && status === 'READY_FOR_REPACK';
  }

  startRepack(row: GradeOutput): void {
    this.router.navigate(['/app/packaging/repack/new'], {
      queryParams: { fromGradingOutputId: row.id },
    });
  }

  totalKg(o: any): number {
    return Number(o?.totalAmount ?? o?.weightKg ?? 0);
  }

  usedKg(o: any): number {
    return Number(o?.usedAmount ?? 0);
  }

  remainingKg(o: any): number {
    return Number(o?.remainingAmount ?? this.totalKg(o) ?? 0);
  }
}
