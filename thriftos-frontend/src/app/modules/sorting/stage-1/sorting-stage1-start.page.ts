import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import { RagService } from '../../procurement/rags/rag.service';
import type { Rag } from '../../procurement/rags/rag.models';
import { SortingStage1Service } from '../../sorting-stage1/sorting-stage1.service';
import type { Category, SortCategoryBucket, SortSession } from '../../sorting-stage1/sorting-stage1.models';
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
  AppLoadingComponent,
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
  selector: 'app-sorting-stage1-start-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
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
    AppLoadingComponent,
    AppErrorStateComponent,
    AppSplitComponent,
    AppSplitMainComponent,
    AppSplitAsideComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppSelectComponent,
    AppDataTableComponent,
  ],
  templateUrl: './sorting-stage1-start.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage1StartPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);
  private readonly sortingStage1 = inject(SortingStage1Service);
  private readonly facade = inject(SortingFacadeService);

  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rag = signal<Rag | null>(null);
  readonly session = signal<SortSession | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly buckets = signal<SortCategoryBucket[]>([]);

  readonly wasteCategories = signal<WasteCategory[]>([]);
  readonly wasteLineItems = signal<WasteLineItem[]>([]);

  readonly started = computed(() => Boolean(this.session()));
  readonly isClosed = computed(() => this.session()?.status === 'CLOSED');

  readonly showStartConfirm = signal(false);
  readonly showCloseConfirm = signal(false);

  // Bucket (category allocation) edit/delete state
  readonly showDeleteBucketConfirm = signal(false);
  readonly deletingBucketId = signal<string | null>(null);
  readonly editingBucket = signal<SortCategoryBucket | null>(null);
  readonly editBucketWeight = new FormControl<number>(0, { nonNullable: true });

  // Waste line edit/delete state
  readonly showDeleteWasteConfirm = signal(false);
  readonly deletingWasteId = signal<string | null>(null);
  readonly editingWasteId = signal<string | null>(null);

  // Form controls
  readonly categoryId = new FormControl<string>('', { nonNullable: true });
  readonly amountKg = new FormControl<number>(0, { nonNullable: true });

  readonly wasteCategoryId = new FormControl<string>('', { nonNullable: true });
  readonly wasteAmount = new FormControl<number>(0, { nonNullable: true });

  readonly categoryOptions = computed<SelectOption[]>(() =>
    (this.categories() || [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: c.name, value: c.id }))
  );

  readonly wasteCategoryOptions = computed<SelectOption[]>(() =>
    (this.wasteCategories() || [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: `${c.name} (${c.unitType})`, value: c.id }))
  );

  readonly tableColumns: DataTableColumn[] = [
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      filterable: true,
      getValue: (row) => (row as SortCategoryBucket).category?.name ?? (row as SortCategoryBucket).categoryId,
    },
    {
      key: 'allocated',
      label: 'Allocated (kg)',
      align: 'right',
      sortable: true,
      getValue: (row) => (row as SortCategoryBucket).outputWeightKg ?? 0,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      sortable: true,
      getValue: (row) => (row as SortCategoryBucket).updatedAt,
    },
  ];

  readonly wasteTableColumns: DataTableColumn[] = [
    { key: 'category', label: 'Category', sortable: false },
    { key: 'unit', label: 'Unit', sortable: false },
    { key: 'amount', label: 'Amount', align: 'right', sortable: false },
    { key: 'value', label: 'Est. Value', align: 'right', sortable: false },
    { key: 'updatedAt', label: 'Updated', sortable: false },
  ];

  /** Clear totals computation: Input, Allocated, Waste, Remaining, Yield */
  readonly totals = computed(() => {
    const session: any = this.session();
    const input = Number(session?.totalInputWeight ?? this.rag()?.weightKg ?? 0);
    const allocated = Number(session?.totalOutputWeight ?? 0);
    const waste = Number(session?.declaredWasteAmount ?? 0);
    const remaining = Math.max(0, input - allocated - waste);
    const yieldPercent = input > 0 ? (allocated / input) * 100 : 0;
    return { input, allocated, waste, remaining, yieldPercent };
  });

  /** Can seal when session is started (remaining can be > 0, will prompt for waste category) */
  readonly canSeal = computed(() => {
    if (!this.started() || this.isClosed()) return false;
    return true; // Allow seal even if remaining > 0 (will prompt)
  });

  /** Show waste prompt when remaining > 0 */
  readonly showSealWastePrompt = signal(false);
  readonly sealWasteCategoryId = new FormControl<string>('', { nonNullable: true });

  /** Message for seal confirmation dialog */
  readonly sealMessage = computed(() => {
    const t = this.totals();
    const catCount = this.buckets().length;
    const wasteCount = this.wasteLineItems().length;
    const remaining = t.remaining;
    if (remaining > 0) {
      return `⚠️ There is ${remaining.toFixed(2)} kg remaining.\n\n` +
        `This will be automatically added as waste.\nPlease select a waste category.`;
    }
    return `This action cannot be undone.\n\n` +
      `Input: ${t.input.toFixed(2)} kg\n` +
      `Allocated to ${catCount} categories: ${t.allocated.toFixed(2)} kg\n` +
      `Waste (${wasteCount} items): ${t.waste.toFixed(2)} kg\n` +
      `Remaining: ${remaining.toFixed(2)} kg`;
  });

  ngOnInit(): void {
    const ragId = this.route.snapshot.paramMap.get('ragId');
    if (!ragId) {
      this.error.set('Missing ragId');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      forkJoin({
        rag: this.ragService.getRag(ragId),
        categories: this.sortingStage1.loadCategories(),
        summary: this.facade.stage1Summary(ragId),
        wasteCategories: this.facade.wasteCategories(),
      }).subscribe({
        next: ({ rag, categories, summary, wasteCategories }) => {
          this.rag.set(rag);
          this.categories.set((categories || []).filter((c) => c.isActive));
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteCategories.set((wasteCategories || []).filter((c) => c.isActive));
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to load workspace');
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
    const rag = this.rag();
    if (!rag) return;

    this.showStartConfirm.set(false);
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage1Start(rag.id, 'RAG').subscribe({
        next: (summary) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to start sorting session');
          this.loading.set(false);
        },
      })
    );
  }

  allocate(): void {
    if (this.isClosed()) return;

    const sessionId = this.session()?.id;
    const categoryId = this.categoryId.value;
    const amount = Number(this.amountKg.value ?? 0);

    if (!sessionId) {
      this.error.set('Start the session first');
      return;
    }
    if (!categoryId) {
      this.error.set('Select a category');
      return;
    }
    if (!(amount > 0)) {
      this.error.set('Enter an amount > 0');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage1Allocate(sessionId, categoryId, amount).subscribe({
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
    const remaining = this.totals().remaining;
    if (remaining > 0) {
      // Show waste category prompt
      this.sealWasteCategoryId.setValue('');
      this.showSealWastePrompt.set(true);
    } else {
      // No remaining, proceed directly
      this.showCloseConfirm.set(true);
    }
  }

  closeSealWastePromptCancel(): void {
    this.showSealWastePrompt.set(false);
    this.sealWasteCategoryId.setValue('');
  }

  closeSealWastePromptConfirm(): void {
    if (!this.sealWasteCategoryId.value) {
      this.error.set('Please select a waste category');
      return;
    }
    this.showSealWastePrompt.set(false);
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

    // Pass wasteCategoryId if remaining > 0
    const remaining = this.totals().remaining;
    const wasteCategoryId = remaining > 0 ? this.sealWasteCategoryId.value : undefined;

    this.subs.add(
      this.facade.stage1Seal(session.id, wasteCategoryId).subscribe({
        next: (summary: any) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set(summary.wasteLineItems || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to close session');
          this.loading.set(false);
        },
      })
    );
  }

  backToList(): void {
    this.router.navigate(['/app/sorting/stage-1']);
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
      ? this.facade.stage1UpdateWaste(editingId, categoryId, amount)
      : this.facade.stage1AddWaste(sessionId, categoryId, amount);

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
      this.facade.stage1DeleteWaste(id).subscribe({
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

  // ─── Bucket (Category Allocation) Edit/Delete ───────────────────────────────

  editBucket(bucket: SortCategoryBucket): void {
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
      this.facade.stage1UpdateBucket(bucket.id, weight).subscribe({
        next: () => {
          // Re-fetch summary to get updated totals
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

  deleteBucketConfirm(bucket: SortCategoryBucket): void {
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
      this.facade.stage1DeleteBucket(id).subscribe({
        next: () => {
          // Re-fetch summary to get updated totals
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
    const ragId = this.rag()?.id;
    if (!ragId) {
      this.loading.set(false);
      return;
    }

    this.subs.add(
      this.facade.stage1Summary(ragId).subscribe({
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

  traceContainerLabel(): string {
    const rag = this.rag();
    if (!rag) return '—';
    return rag.container?.containerNumber || '—';
  }
}
