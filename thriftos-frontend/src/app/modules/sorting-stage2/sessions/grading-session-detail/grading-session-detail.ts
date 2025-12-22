/**
 * Grading Session Detail Component
 * Phase 4: Sorting Stage 2 - Grading Workspace
 * 
 * Main workspace for grading Stage 1 category outputs into G1/G2/G3.
 * Includes full lineage traceability header.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Lock,
  Package,
  Layers,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Award,
  Trash2,
  Link,
  Box,
  FileText,
  PackagePlus,
} from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { GradeBucketComponent, GradeBucketUpdate } from '../../workspace/grade-bucket/grade-bucket';
import { SortingStage2Service } from '../../sorting-stage2.service';
import {
  GradeSession,
  GradeBucket,
  Grade,
  GradingTotals,
  GradingLineage,
  CreateGradeBucketRequest,
} from '../../sorting-stage2.models';

@Component({
  selector: 'app-grading-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    GradeBucketComponent,
  ],
  templateUrl: './grading-session-detail.html',
  styleUrl: './grading-session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradingSessionDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly gradingService = inject(SortingStage2Service);

  readonly icons = {
    arrowLeft: ArrowLeft,
    save: Save,
    lock: Lock,
    package: Package,
    layers: Layers,
    scale: Scale,
    checkCircle: CheckCircle2,
    alertTriangle: AlertTriangle,
    plus: Plus,
    award: Award,
    trash: Trash2,
    link: Link,
    box: Box,
    fileText: FileText,
    packagePlus: PackagePlus,
  };

  // Service state
  readonly loading = this.gradingService.loading;
  readonly session = this.gradingService.currentSession;
  readonly buckets = this.gradingService.buckets;
  readonly grades = this.gradingService.grades;

  // Local state
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showCloseConfirm = signal(false);
  readonly showAddBucket = signal(false);

  // New bucket form
  readonly newBucket = signal<{ gradeId: string; weightKg: number; count: number } | null>(null);

  // Computed: Session is editable
  readonly isEditable = computed(() => {
    const s = this.session();
    return s?.status === 'OPEN';
  });

  // Computed: Grading totals
  readonly gradingTotals = computed((): GradingTotals => {
    const s = this.session();
    if (!s) {
      return { totalInputWeight: 0, totalGradedWeight: 0, totalItemCount: 0, wasteWeight: 0, yieldPercentage: 0 };
    }
    
    const buckets = s.gradeBuckets || [];
    const totalGradedWeight = buckets.reduce((sum, b) => sum + this.toNum(b.outputWeightKg), 0);
    const totalItemCount = buckets.reduce((sum, b) => sum + (b.outputCount || 0), 0);
    const inputWeight = this.toNum(s.categoryOutput?.weightKg);
    const wasteWeight = Math.max(0, inputWeight - totalGradedWeight);
    const yieldPercentage = inputWeight > 0 ? (totalGradedWeight / inputWeight) * 100 : 0;
    
    return { totalInputWeight: inputWeight, totalGradedWeight, totalItemCount, wasteWeight, yieldPercentage };
  });

  // Computed: Lineage information
  readonly lineage = computed((): GradingLineage => {
    const s = this.session();
    const co = s?.categoryOutput;
    return {
      containerId: co?.containerId || undefined,
      containerNumber: co?.container?.containerNumber || undefined,
      ragId: co?.ragId || undefined,
      ragCode: co?.rag?.ragCode || undefined,
      stage1SessionId: co?.sortSessionId || undefined,
      categoryId: co?.categoryId || undefined,
      categoryName: co?.category?.name || undefined,
      originalWeight: this.toNum(co?.weightKg),
    };
  });

  // Computed: Remaining weight for new allocations
  readonly remainingWeight = computed(() => {
    const totals = this.gradingTotals();
    return Math.max(0, totals.totalInputWeight - totals.totalGradedWeight);
  });

  // Computed: Available grades (not yet used)
  readonly availableGrades = computed(() => {
    const allGrades = this.grades();
    const usedGradeIds = new Set((this.session()?.gradeBuckets || []).map(b => b.gradeId));
    return allGrades.filter(g => !usedGradeIds.has(g.id));
  });

  // Computed: Can close session
  readonly canClose = computed(() => {
    const totals = this.gradingTotals();
    const buckets = this.session()?.gradeBuckets || [];
    return this.isEditable() && buckets.length > 0 && totals.totalGradedWeight > 0;
  });

  // Computed: Validation: Can add new weight
  readonly canAddWeight = computed(() => {
    const newB = this.newBucket();
    if (!newB) return true;
    const remaining = this.remainingWeight();
    return newB.weightKg <= remaining;
  });

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      this.loadData(sessionId);
    }
  }

  ngOnDestroy(): void {
    this.gradingService.clearCurrentSession();
  }

  private loadData(sessionId: string): void {
    // Load grades and session in parallel
    this.gradingService.getGrades().subscribe();
    this.gradingService.getSession(sessionId).subscribe({
      error: (err: any) => {
        this.error.set(err.message || 'Failed to load session');
      },
    });
  }

  // =============================================================
  // BUCKET OPERATIONS
  // =============================================================

  startAddBucket(): void {
    const availableGrades = this.availableGrades();
    if (availableGrades.length === 0) {
      this.error.set('All grades have been allocated');
      return;
    }
    this.newBucket.set({
      gradeId: availableGrades[0].id,
      weightKg: 0,
      count: 0,
    });
    this.showAddBucket.set(true);
  }

  cancelAddBucket(): void {
    this.newBucket.set(null);
    this.showAddBucket.set(false);
  }

  saveNewBucket(): void {
    const newB = this.newBucket();
    const sessionId = this.session()?.id;
    if (!newB || !sessionId) return;

    if (newB.weightKg <= 0) {
      this.error.set('Weight must be greater than 0');
      return;
    }

    if (!this.canAddWeight()) {
      this.error.set('Weight exceeds remaining available weight');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const request: CreateGradeBucketRequest = {
      gradeId: newB.gradeId,
      outputWeightKg: newB.weightKg,
      outputCount: newB.count,
    };

    this.gradingService.createBucket(sessionId, request).subscribe({
      next: () => {
        this.cancelAddBucket();
        this.loadData(sessionId);
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to add grade bucket');
        this.saving.set(false);
      },
    });
  }

  onBucketUpdated(update: GradeBucketUpdate): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    this.saving.set(true);
    this.error.set(null);

    this.gradingService.updateBucket(update.bucketId, {
      outputWeightKg: update.outputWeightKg,
      outputCount: update.outputCount,
    }).subscribe({
      next: () => {
        this.loadData(sessionId);
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to update bucket');
        this.saving.set(false);
      },
    });
  }

  onBucketDeleted(bucketId: string): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    if (!confirm('Delete this grade bucket?')) return;

    this.saving.set(true);
    this.error.set(null);

    this.gradingService.deleteBucket(bucketId).subscribe({
      next: () => {
        this.loadData(sessionId);
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to delete bucket');
        this.saving.set(false);
      },
    });
  }

  // =============================================================
  // SESSION OPERATIONS
  // =============================================================

  promptClose(): void {
    this.showCloseConfirm.set(true);
  }

  cancelClose(): void {
    this.showCloseConfirm.set(false);
  }

  confirmClose(): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    this.saving.set(true);
    this.error.set(null);
    this.showCloseConfirm.set(false);

    this.gradingService.closeSession(sessionId).subscribe({
      next: () => {
        this.loadData(sessionId);
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to close session');
        this.saving.set(false);
      },
    });
  }

  // =============================================================
  // HELPERS
  // =============================================================

  toNum(val: any): number {
    if (val === null || val === undefined) return 0;
    return typeof val === 'string' ? parseFloat(val) : val;
  }

  formatWeight(kg: number | string): string {
    const num = this.toNum(kg);
    return num.toFixed(2);
  }

  getGradeForBucket(bucket: GradeBucket): Grade | null {
    return bucket.grade || this.grades().find(g => g.id === bucket.gradeId) || null;
  }

  getBucketMaxWeight(bucket: GradeBucket): number {
    const currentWeight = this.toNum(bucket.outputWeightKg);
    return this.remainingWeight() + currentWeight;
  }

  getGradeName(gradeId: string): string {
    const grade = this.grades().find(g => g.id === gradeId);
    return grade?.name || 'Unknown Grade';
  }

  updateNewBucketGrade(gradeId: string): void {
    const current = this.newBucket();
    if (current) {
      this.newBucket.set({ ...current, gradeId });
    }
  }

  updateNewBucketWeight(weight: number): void {
    const current = this.newBucket();
    if (current) {
      this.newBucket.set({ ...current, weightKg: weight });
    }
  }

  updateNewBucketCount(count: number): void {
    const current = this.newBucket();
    if (current) {
      this.newBucket.set({ ...current, count });
    }
  }

  // =============================================================
  // START REPACK (Navigate to Repack module)
  // =============================================================

  startRepack(): void {
    const session = this.session();
    if (!session || session.status !== 'CLOSED') {
      this.error.set('Session must be closed before repacking');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // Create a new repack session via backend
    this.http.post<{ id: string }>('/api/repack/sessions', {}).subscribe({
      next: (repackSession) => {
        this.saving.set(false);
        // Navigate to the new repack session with gradeSessionId for lineage
        this.router.navigate(['/app/repack', repackSession.id], {
          queryParams: { gradeSessionId: session.id }
        });
      },
      error: (err: any) => {
        this.error.set(err.error?.message || 'Failed to create repack session');
        this.saving.set(false);
      },
    });
  }
}
