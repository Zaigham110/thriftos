import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import type { Grade, GradeBucket } from '../../sorting-stage2/sorting-stage2.models';
import { SortingFacadeService } from '../sorting-facade.service';
import type { WasteCategory, WasteLineItem } from '../sorting-facade.service';
import {
  AppBadgeComponent,
  AppButtonComponent,
  AppCardComponent,
  AppDialogComponent,
  AppErrorStateComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSplitAsideComponent,
  AppSplitComponent,
  AppSplitMainComponent,
  AppStackComponent,
  AppDataTableComponent,
  AppSelectComponent,
  type DataTableColumn,
  type SelectOption,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-stage2-grade-page',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppCardComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppDialogComponent,
    AppErrorStateComponent,
    AppSplitComponent,
    AppSplitMainComponent,
    AppSplitAsideComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppSelectComponent,
    AppDataTableComponent,
  ],
  templateUrl: './sorting-stage2-grade.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage2GradePage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(SortingFacadeService);

  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly categoryOutputId = signal<string | null>(null);

  readonly session = signal<any | null>(null);
  readonly grades = signal<Grade[]>([]);
  readonly buckets = signal<GradeBucket[]>([]);

  readonly wasteCategories = signal<WasteCategory[]>([]);
  readonly wasteLineItems = signal<WasteLineItem[]>([]);

  readonly started = computed(() => Boolean(this.session()));
  readonly isClosed = computed(() => this.session()?.status === 'CLOSED');

  readonly showStartConfirm = signal(false);
  readonly showCloseConfirm = signal(false);

  // Bucket (grade allocation) edit/delete state
  readonly showDeleteBucketConfirm = signal(false);
  readonly deletingBucketId = signal<string | null>(null);
  readonly editingBucket = signal<GradeBucket | null>(null);
  readonly editBucketWeight = new FormControl<number>(0, { nonNullable: true });

  // Waste line edit/delete state
  readonly showDeleteWasteConfirm = signal(false);
  readonly deletingWasteId = signal<string | null>(null);
  readonly editingWasteId = signal<string | null>(null);

  // Form controls
  readonly gradeId = new FormControl<string>('', { nonNullable: true });
  readonly amountKg = new FormControl<number>(0, { nonNullable: true });

  readonly wasteCategoryId = new FormControl<string>('', { nonNullable: true });
  readonly wasteAmount = new FormControl<number>(0, { nonNullable: true });

  readonly gradeOptions = computed<SelectOption[]>(() =>
    (this.grades() || [])
      .filter((g) => g.isActive)
      .sort((a, b) => a.rank - b.rank)
      .map((g) => ({ label: g.name, value: g.id }))
  );

  readonly wasteCategoryOptions = computed<SelectOption[]>(() =>
    (this.wasteCategories() || [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: `${c.name} (${c.unitType})`, value: c.id }))
  );

  readonly tableColumns: DataTableColumn[] = [
    {
      key: 'grade',
      label: 'Grade',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as GradeBucket).grade?.name ?? (row as GradeBucket).gradeId,
    },
    {
      key: 'allocated',
      label: 'Allocated (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as GradeBucket).outputWeightKg ?? 0,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      getValue: (row) => (row as GradeBucket).updatedAt,
    },
  ];

  readonly wasteTableColumns: DataTableColumn[] = [
    { key: 'category', label: 'Category', sortable: false },
    { key: 'unit', label: 'Unit', sortable: false },
    { key: 'amount', label: 'Amount', align: 'right', sortable: false },
    { key: 'value', label: 'Est. Value', align: 'right', sortable: false },
    { key: 'updatedAt', label: 'Updated', sortable: false },
  ];

  /** Clear totals computation: Input, Allocated, Waste, Remaining */
  readonly totals = computed(() => {
    const session = this.session();
    const input = Number(session?.categoryOutput?.weightKg ?? 0);
    const allocated = Number(session?.totalGradeOutputWeight ?? 0);
    const waste = Number(session?.declaredWasteAmount ?? 0);
    const remaining = Math.max(0, input - allocated - waste);
    const yieldPct = input > 0 ? (allocated / input) * 100 : 0;
    return { input, allocated, waste, remaining, yieldPct };
  });

  /** Can seal only when remaining is exactly 0 */
  readonly canSeal = computed(() => {
    if (!this.started() || this.isClosed()) return false;
    return this.totals().remaining === 0;
  });

  /** Message for seal confirmation dialog */
  readonly sealMessage = computed(() => {
    const t = this.totals();
    const gradeCount = this.buckets().length;
    const wasteCount = this.wasteLineItems().length;
    return `This action cannot be undone.\n\n` +
      `Input: ${t.input.toFixed(2)} kg\n` +
      `Allocated to ${gradeCount} grades: ${t.allocated.toFixed(2)} kg\n` +
      `Waste (${wasteCount} items): ${t.waste.toFixed(2)} kg\n` +
      `Remaining: ${t.remaining.toFixed(2)} kg\n` +
      `Yield: ${t.yieldPct.toFixed(1)}%`;
  });

  ngOnInit(): void {
    const categoryOutputId = this.route.snapshot.paramMap.get('categoryOutputId');
    if (!categoryOutputId) {
      this.error.set('Missing categoryOutputId');
      this.loading.set(false);
      return;
    }
    this.categoryOutputId.set(categoryOutputId);
    
    // Auto-load: try to start/resume session immediately
    this.autoLoadSession(categoryOutputId);
  }

  /** Auto-load existing session or prepare for new session */
  private autoLoadSession(categoryOutputId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      forkJoin({
        summary: this.facade.stage2Start(categoryOutputId),
        grades: this.facade.grades(),
        wasteCategories: this.facade.wasteCategories(),
      }).subscribe({
        next: ({ summary, grades, wasteCategories }) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.grades.set(grades || []);
          this.wasteCategories.set((wasteCategories || []).filter((c) => c.isActive));
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to load grading session');
          this.loading.set(false);
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  startConfirm(): void {
    this.showStartConfirm.set(true);
  }

  startCancel(): void {
    this.showStartConfirm.set(false);
  }

  startExecute(): void {
    const categoryOutputId = this.categoryOutputId();
    if (!categoryOutputId) return;

    this.showStartConfirm.set(false);
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      forkJoin({
        summary: this.facade.stage2Start(categoryOutputId),
        grades: this.facade.grades(),
        wasteCategories: this.facade.wasteCategories(),
      }).subscribe({
        next: ({ summary, grades, wasteCategories }) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.grades.set(grades || []);
          this.wasteCategories.set((wasteCategories || []).filter((c) => c.isActive));
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to start grading');
          this.loading.set(false);
        },
      })
    );
  }

  allocate(): void {
    if (this.isClosed()) return;

    const sessionId = this.session()?.id;
    const gradeId = this.gradeId.value;
    const amount = Number(this.amountKg.value ?? 0);

    if (!sessionId) {
      this.error.set('Start the session first');
      return;
    }
    if (!gradeId) {
      this.error.set('Select a grade');
      return;
    }
    if (!(amount > 0)) {
      this.error.set('Enter an amount > 0');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage2Allocate(sessionId, gradeId, amount).subscribe({
        next: (summary) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.amountKg.setValue(0);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to allocate');
          this.loading.set(false);
        },
      })
    );
  }

  closeConfirm(): void {
    if (!this.canSeal()) {
      this.error.set('Cannot seal: Remaining must be 0. Allocate all weight to grades or waste first.');
      return;
    }
    this.showCloseConfirm.set(true);
  }

  closeCancel(): void {
    this.showCloseConfirm.set(false);
  }

  closeExecute(): void {
    const session = this.session();
    if (!session || !this.canSeal()) return;

    this.showCloseConfirm.set(false);
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage2Seal(session.id).subscribe({
        next: (summary) => {
          this.session.set((summary as any).session);
          this.buckets.set((summary as any).buckets || []);
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to close grading session');
          this.loading.set(false);
        },
      })
    );
  }

  backToList(): void {
    this.router.navigate(['/sorting/stage-2']);
  }

  saveWasteLine(): void {
    if (this.isClosed()) return;

    const sessionId = this.session()?.id;
    if (!sessionId) {
      this.error.set('Start the session first');
      return;
    }

    const categoryId = this.wasteCategoryId.value;
    const amount = Number(this.wasteAmount.value ?? 0);
    if (!categoryId) {
      this.error.set('Select a waste category');
      return;
    }
    if (!(amount > 0)) {
      this.error.set('Enter a waste amount > 0');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const editingId = this.editingWasteId();
    const req$ = editingId
      ? this.facade.stage2UpdateWaste(editingId, categoryId, amount)
      : this.facade.stage2AddWaste(sessionId, categoryId, amount);

    this.subs.add(
      req$.subscribe({
        next: (summary: any) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set(summary.wasteLineItems || []);
          this.wasteAmount.setValue(0);
          this.editingWasteId.set(null);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to save waste line');
          this.loading.set(false);
        },
      })
    );
  }

  /** Quick fill the waste form with the remaining amount */
  fillRemainingAsWaste(): void {
    const remaining = this.totals().remaining;
    if (remaining > 0) {
      this.wasteAmount.setValue(Number(remaining.toFixed(2)));
    }
  }

  editWasteLine(line: WasteLineItem): void {
    this.editingWasteId.set(line.id);
    this.wasteCategoryId.setValue(String(line.wasteCategory?.id || ''));
    this.wasteAmount.setValue(Number(line.amount ?? 0));
  }

  cancelEditWaste(): void {
    this.editingWasteId.set(null);
    this.wasteAmount.setValue(0);
  }

  deleteWasteConfirm(line: WasteLineItem): void {
    this.deletingWasteId.set(line.id);
    this.showDeleteWasteConfirm.set(true);
  }

  deleteWasteCancel(): void {
    this.showDeleteWasteConfirm.set(false);
    this.deletingWasteId.set(null);
  }

  deleteWasteExecute(): void {
    const id = this.deletingWasteId();
    if (!id) return;

    this.showDeleteWasteConfirm.set(false);
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage2DeleteWaste(id).subscribe({
        next: (summary: any) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set(summary.wasteLineItems || []);
          this.deletingWasteId.set(null);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to delete waste line');
          this.loading.set(false);
        },
      })
    );
  }

  // ─── Bucket (Grade Allocation) Edit/Delete ───────────────────────────────

  editBucket(bucket: GradeBucket): void {
    this.editingBucket.set(bucket);
    this.editBucketWeight.setValue(Number(bucket.outputWeightKg ?? 0));
  }

  cancelEditBucket(): void {
    this.editingBucket.set(null);
    this.editBucketWeight.setValue(0);
  }

  saveBucket(): void {
    if (this.isClosed()) return;

    const bucket = this.editingBucket();
    if (!bucket) return;

    const weight = Number(this.editBucketWeight.value ?? 0);
    if (!(weight > 0)) {
      this.error.set('Enter a weight > 0');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage2UpdateBucket(bucket.id, weight).subscribe({
        next: () => {
          this.refreshSummary();
          this.editingBucket.set(null);
          this.editBucketWeight.setValue(0);
        },
        error: (err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to update bucket');
          this.loading.set(false);
        },
      })
    );
  }

  deleteBucketConfirm(bucket: GradeBucket): void {
    this.deletingBucketId.set(bucket.id);
    this.showDeleteBucketConfirm.set(true);
  }

  deleteBucketCancel(): void {
    this.showDeleteBucketConfirm.set(false);
    this.deletingBucketId.set(null);
  }

  deleteBucketExecute(): void {
    const id = this.deletingBucketId();
    if (!id) return;

    this.showDeleteBucketConfirm.set(false);
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage2DeleteBucket(id).subscribe({
        next: () => {
          this.refreshSummary();
          this.deletingBucketId.set(null);
        },
        error: (err) => {
          this.error.set(err?.error?.message || err?.message || 'Failed to remove bucket');
          this.loading.set(false);
        },
      })
    );
  }

  /** Re-fetch the session summary to get updated totals after bucket changes */
  private refreshSummary(): void {
    const categoryOutputId = this.categoryOutputId();
    if (!categoryOutputId) {
      this.loading.set(false);
      return;
    }

    this.subs.add(
      this.facade.stage2Start(categoryOutputId).subscribe({
        next: (summary) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to refresh session');
          this.loading.set(false);
        },
      })
    );
  }

  shortId(value: string | null | undefined): string {
    if (!value) return '—';
    return String(value).slice(0, 8).toUpperCase();
  }
}
