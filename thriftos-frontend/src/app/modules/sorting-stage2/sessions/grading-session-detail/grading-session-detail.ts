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

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionBodyComponent,
  AppStackComponent,
  AppWorkspace3PanelComponent,
  AppCardComponent,
  AppButtonComponent,
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppDataTableComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
  type BreadcrumbItem,
  type TableColumn,
} from '../../../../shared/ui';
import { SortingStage2Service } from '../../sorting-stage2.service';
import {
  GradeSession,
  GradeBucket,
  Grade,
  GradingTotals,
  GradingLineage,
  CreateGradeBucketRequest,
} from '../../sorting-stage2.models';

// Legacy type for backwards compatibility
interface GradeBucketUpdate {
  bucketId: string;
  outputWeightKg: number;
  outputCount: number;
}

@Component({
  selector: 'app-grading-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppWorkspace3PanelComponent,
    AppCardComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppBreadcrumbComponent,
    AppDataTableComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './grading-session-detail.html',
  styleUrl: './grading-session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradingSessionDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gradingService = inject(SortingStage2Service);

  protected readonly Math = Math;

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

  // Modal states for 3-panel layout
  readonly showAddGradeModal = signal(false);
  readonly showEditGradeModal = signal(false);
  readonly editingBucketId = signal<string | null>(null);
  readonly modalGradeId = signal<string>('');
  readonly modalWeightKg = signal<number>(0);
  readonly modalCount = signal<number>(0);
  readonly modalSaving = signal(false);

  // Breadcrumbs
  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sorting', link: '/app/sorting/stage2' },
    { label: 'Grading Sessions', link: '/app/sorting/stage2' },
    { label: 'Grading Workspace' },
  ];

  // Table columns for grade buckets
  readonly bucketColumns: TableColumn[] = [
    { key: 'grade', label: 'Grade', sortable: true },
    { key: 'weight', label: 'Weight (kg)', sortable: true },
    { key: 'count', label: 'Count', sortable: true },
    { key: 'percentage', label: '% of Total', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ];

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

  // =============================================================
  // NEW MODAL-BASED METHODS FOR 3-PANEL LAYOUT
  // =============================================================

  openAddGradeModal(): void {
    const availableGrades = this.availableGrades();
    if (availableGrades.length === 0) {
      this.error.set('All grades have been allocated');
      return;
    }
    this.modalGradeId.set(availableGrades[0].id);
    this.modalWeightKg.set(0);
    this.modalCount.set(0);
    this.showAddGradeModal.set(true);
  }

  closeAddGradeModal(): void {
    this.showAddGradeModal.set(false);
    this.modalGradeId.set('');
    this.modalWeightKg.set(0);
    this.modalCount.set(0);
  }

  quickAddGrade(gradeId: string): void {
    this.modalGradeId.set(gradeId);
    this.modalWeightKg.set(0);
    this.modalCount.set(0);
    this.showAddGradeModal.set(true);
  }

  confirmAddGrade(): void {
    const sessionId = this.session()?.id;
    const gradeId = this.modalGradeId();
    const weightKg = this.modalWeightKg();
    const count = this.modalCount();

    if (!sessionId || !gradeId || weightKg <= 0) {
      this.error.set('Grade and weight are required');
      return;
    }

    if (weightKg > this.remainingWeight()) {
      this.error.set(`Weight exceeds remaining capacity (${this.formatWeight(this.remainingWeight())} kg available)`);
      return;
    }

    this.modalSaving.set(true);
    this.error.set(null);

    const request: CreateGradeBucketRequest = {
      gradeId,
      outputWeightKg: weightKg,
      outputCount: count,
    };

    this.gradingService.createBucket(sessionId, request).subscribe({
      next: () => {
        this.closeAddGradeModal();
        this.loadData(sessionId);
        this.modalSaving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to add grade bucket');
        this.modalSaving.set(false);
      },
    });
  }

  openEditGradeModal(bucket: GradeBucket): void {
    this.editingBucketId.set(bucket.id);
    this.modalGradeId.set(bucket.gradeId);
    this.modalWeightKg.set(this.toNum(bucket.outputWeightKg));
    this.modalCount.set(bucket.outputCount || 0);
    this.showEditGradeModal.set(true);
  }

  closeEditGradeModal(): void {
    this.showEditGradeModal.set(false);
    this.editingBucketId.set(null);
    this.modalGradeId.set('');
    this.modalWeightKg.set(0);
    this.modalCount.set(0);
  }

  confirmEditGrade(): void {
    const bucketId = this.editingBucketId();
    const sessionId = this.session()?.id;
    const weightKg = this.modalWeightKg();
    const count = this.modalCount();

    if (!bucketId || !sessionId) return;

    this.modalSaving.set(true);
    this.error.set(null);

    this.gradingService.updateBucket(bucketId, {
      outputWeightKg: weightKg,
      outputCount: count,
    }).subscribe({
      next: () => {
        this.closeEditGradeModal();
        this.loadData(sessionId);
        this.modalSaving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to update grade bucket');
        this.modalSaving.set(false);
      },
    });
  }

  deleteBucket(bucketId: string): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    if (!confirm('Are you sure you want to delete this grade bucket? This action cannot be undone.')) {
      return;
    }

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

  getModalGradeName(): string {
    const gradeId = this.modalGradeId();
    const grade = this.grades().find(g => g.id === gradeId);
    return grade?.name || 'Unknown Grade';
  }

  // =============================================================
  // LEGACY INLINE EDIT METHODS (KEPT FOR BACKWARDS COMPAT)
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

    // Non-mutating entry: navigate to the unified repack create workspace.
    // We pass a single suggested grading output id (non-binding).
    const suggestedOutputId = this.pickSuggestedGradingOutputId(session);
    if (!suggestedOutputId) {
      this.error.set('No grading outputs available for repacking');
      return;
    }

    this.router.navigate(['/app/repack/create'], {
      queryParams: { fromGradingOutputId: suggestedOutputId },
    });
  }

  private pickSuggestedGradingOutputId(session: any): string | null {
    const buckets = (session?.gradeBuckets ?? []) as any[];
    const outputs: any[] = [];

    for (const b of buckets) {
      const bucketOutputs = (b?.gradeOutputs ?? []) as any[];
      for (const o of bucketOutputs) outputs.push(o);
    }

    if (outputs.length === 0) return null;

    // Prefer the output with the largest remaining amount (fallback to totalAmount/weightKg).
    const pick = outputs
      .slice()
      .sort((a, b) => {
        const ar = Number(a?.remainingAmount ?? a?.totalAmount ?? a?.weightKg ?? 0);
        const br = Number(b?.remainingAmount ?? b?.totalAmount ?? b?.weightKg ?? 0);
        return br - ar;
      })[0];

    return pick?.id ?? null;
  }
}
