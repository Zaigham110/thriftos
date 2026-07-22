/**
 * Repack Unit Registry List Component
 * Phase 2: Repack Module UI
 * 
 * High-density directory table and KPI cards for Repack & Packaging units.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Box,
  Package,
  Plus,
  RefreshCw,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRight,
  Warehouse,
} from 'lucide-angular';

import { RepackService } from '../repack.service';
import { RepackUnit, RepackStatus } from '../repack.models';
import { AuthService } from '../../../core/auth/auth';
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
  selector: 'app-repack-index',
  standalone: true,
  imports: [
    CommonModule,
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
    AppDialogComponent,
  ],
  templateUrl: './repack-index.page.html',
  styleUrl: './repack-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackIndexComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly repackService = inject(RepackService);
  private readonly authService = inject(AuthService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Packaging', route: '/app/packaging/repack' },
    { label: 'Repack Registry' },
  ];

  readonly icons = {
    Box,
    Package,
    Plus,
    RefreshCw,
    Layers,
    Sparkles,
    CheckCircle2,
    Clock,
    Trash2,
    ArrowRight,
    Warehouse,
  };

  readonly allUnits = signal<RepackUnit[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly statusFilter = signal<'ALL' | RepackStatus>('ALL');

  // Computed KPI Metrics
  readonly draftCount = computed(() => {
    return this.allUnits().filter((u) => u.status === 'DRAFT').length;
  });

  readonly sealedCount = computed(() => {
    return this.allUnits().filter((u) => u.status === 'SEALED').length;
  });

  readonly totalPackedWeight = computed(() => {
    return this.allUnits().reduce((sum, u) => sum + Number(u.allocatedAmount || 0), 0);
  });

  readonly filteredUnits = computed(() => {
    const filter = this.statusFilter();
    const units = this.allUnits();
    if (filter === 'ALL') return units;
    return units.filter((u) => u.status === filter);
  });

  // Delete modal state
  readonly showDeleteModal = signal(false);
  readonly unitToDelete = signal<RepackUnit | null>(null);
  readonly deleting = signal(false);

  readonly canCreate = computed(() => this.authService.hasPermission('REPACK_CREATE'));
  readonly canDelete = computed(() => this.authService.hasPermission('REPACK_DELETE'));

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.repackService.getAllUnits().subscribe({
      next: (units) => {
        this.allUnits.set(units || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load repack units');
        this.loading.set(false);
      },
    });
  }

  openWorkspace(unit: RepackUnit): void {
    this.router.navigate(['/app/packaging/repack', unit.id]);
  }

  createNew(): void {
    this.router.navigate(['/app/packaging/repack/new']);
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
        this.error.set(err?.message || 'Failed to delete repack unit');
      },
    });
  }

  packedAmount(unit: RepackUnit): number {
    if (unit.allocatedAmount !== undefined && unit.allocatedAmount !== null && !isNaN(Number(unit.allocatedAmount))) {
      return Number(unit.allocatedAmount);
    }
    return Number((unit as any).weightKg ?? (unit as any).pcsCount ?? 0);
  }

  targetAmount(unit: RepackUnit): number {
    if (unit.targetAmount !== undefined && unit.targetAmount !== null && Number(unit.targetAmount) > 0) {
      return Number(unit.targetAmount);
    }
    return this.packedAmount(unit);
  }

  progressPercent(unit: RepackUnit): number {
    if (unit.status === 'SEALED') return 100;
    const target = this.targetAmount(unit);
    const packed = this.packedAmount(unit);
    if (target <= 0) return 0;
    return Math.min(100, (packed / target) * 100);
  }
}
