/**
 * Stage 1 Sorting Workspace Component
 * Phase 2: Sorting Module UI
 * 
 * Interactive breakdown workspace for sorting Rags and Loose Bales into Raw Material Categories.
 */

import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  LucideAngularModule,
  ArrowLeft,
  Package,
  Layers,
  Scale,
  Play,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  Building2,
  Truck,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-angular';

import { RagService } from '../../procurement/rags/rag.service';
import { ProcurementService } from '../../procurement/procurement.service';
import { SortingStage1Service } from '../../sorting-stage1/sorting-stage1.service';
import type { Category, SortCategoryBucket, SortSession } from '../../sorting-stage1/sorting-stage1.models';
import { SortingFacadeService } from '../sorting-facade.service';
import type { WasteCategory, WasteLineItem } from '../sorting-facade.service';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppDialogComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

@Component({
  selector: 'app-sorting-stage1-start-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './sorting-stage1-start.page.html',
  styleUrl: './sorting-stage1-start.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingStage1StartPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);
  private readonly procurementService = inject(ProcurementService);
  private readonly sortingStage1 = inject(SortingStage1Service);
  private readonly facade = inject(SortingFacadeService);

  private readonly subs = new Subscription();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rag = signal<any | null>(null);
  readonly itemSourceType = signal<'RAG' | 'LOOSE_BALE'>('RAG');
  readonly session = signal<SortSession | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly buckets = signal<SortCategoryBucket[]>([]);

  readonly wasteCategories = signal<WasteCategory[]>([]);
  readonly wasteLineItems = signal<WasteLineItem[]>([]);

  readonly icons = {
    ArrowLeft,
    Package,
    Layers,
    Scale,
    Play,
    CheckCircle2,
    Lock,
    Plus,
    Trash2,
    Pencil,
    AlertTriangle,
    Building2,
    Truck,
    FileText,
    Clock,
    Sparkles,
  };

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
  readonly pieceCount = new FormControl<number>(0, { nonNullable: true });
  readonly allocationUnitMode = new FormControl<'KG' | 'PCS'>('KG', { nonNullable: true });

  readonly wasteCategoryId = new FormControl<string>('', { nonNullable: true });
  readonly wasteAmount = new FormControl<number>(0, { nonNullable: true });

  readonly categoryOptions = computed(() =>
    (this.categories() || [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: c.name, value: c.id }))
  );

  readonly wasteCategoryOptions = computed(() =>
    (this.wasteCategories() || [])
      .filter((c) => c.isActive)
      .map((c) => ({ label: `${c.name} (${c.unitType})`, value: c.id }))
  );

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const item = this.rag();
    const code = item ? (item.ragCode || item.baleCode || 'Workspace') : 'Workspace';
    return [
      { label: 'Sorting', route: '/app/sorting/stage-1' },
      { label: 'Stage 1', route: '/app/sorting/stage-1' },
      { label: code },
    ];
  });

  /** Totals computation: Input, Allocated, Waste, Remaining, Yield */
  readonly totals = computed(() => {
    const session: any = this.session();
    const input = Number(session?.totalInputWeight ?? this.rag()?.weightKg ?? 0);
    const allocated = Number(session?.totalOutputWeight ?? 0);
    const waste = Number(session?.declaredWasteAmount ?? 0);
    const remaining = Math.max(0, input - allocated - waste);
    const yieldPercent = input > 0 ? (allocated / input) * 100 : 0;
    const allocatedPercent = input > 0 ? Math.min(100, (allocated / input) * 100) : 0;
    const wastePercent = input > 0 ? Math.min(100 - allocatedPercent, (waste / input) * 100) : 0;
    const remainingPercent = Math.max(0, 100 - allocatedPercent - wastePercent);
    return {
      input,
      allocated,
      waste,
      remaining,
      yieldPercent,
      allocatedPercent,
      wastePercent,
      remainingPercent,
    };
  });

  /** Can seal when session is started */
  readonly canSeal = computed(() => {
    if (!this.started() || this.isClosed()) return false;
    return true;
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
      return `⚠️ There is ${remaining.toFixed(2)} KG remaining in the intake.\n\n` +
        `This remaining weight will be automatically logged as waste upon sealing.\nPlease select the target waste category.`;
    }
    return `Sealing this session will lock all category allocations and finalize Stage 1 outputs.\n\n` +
      `Total Input: ${t.input.toFixed(2)} KG\n` +
      `Allocated to ${catCount} Categories: ${t.allocated.toFixed(2)} KG\n` +
      `Logged Waste (${wasteCount} lines): ${t.waste.toFixed(2)} KG\n` +
      `Yield Percentage: ${t.yieldPercent.toFixed(1)}%`;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('ragId');
    if (!id) {
      this.error.set('Missing target ID');
      this.loading.set(false);
      return;
    }

    const stateType = history.state?.sourceType as 'RAG' | 'LOOSE_BALE';
    if (stateType) {
      this.itemSourceType.set(stateType);
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      forkJoin({
        rag: this.ragService.getRag(id).pipe(catchError(() => of(null))),
        bale: this.procurementService.getIncomingBale(id).pipe(catchError(() => of(null))),
        categories: this.sortingStage1.loadCategories(),
        summary: this.facade.stage1Summary(id),
        wasteCategories: this.facade.wasteCategories(),
      }).subscribe({
        next: ({ rag, bale, categories, summary, wasteCategories }) => {
          if (rag) {
            this.rag.set(rag);
            this.itemSourceType.set('RAG');
          } else if (bale) {
            this.rag.set({
              id: bale.id,
              ragCode: bale.baleCode,
              container: bale.container,
              purchaseOrder: bale.purchaseOrder,
              rawCategory: bale.rawCategory,
              vendor: bale.vendor,
              weightKg: bale.weightKg,
            });
            this.itemSourceType.set('LOOSE_BALE');
          } else {
            this.error.set('Target item not found');
            this.loading.set(false);
            return;
          }

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
    const item = this.rag();
    if (!item) return;

    this.showStartConfirm.set(false);
    this.loading.set(true);
    this.error.set(null);

    const sourceType = this.itemSourceType();
    this.subs.add(
      this.facade.stage1Start(item.id, sourceType).subscribe({
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
    const count = Number(this.pieceCount.value ?? 0);

    if (!sessionId) {
      this.error.set('Please start the session first');
      return;
    }
    if (!categoryId) {
      this.error.set('Please select a category');
      return;
    }
    if (!(amount > 0)) {
      this.error.set('Enter an amount > 0 KG');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage1Allocate(sessionId, categoryId, amount, count > 0 ? count : undefined).subscribe({
        next: (summary) => {
          this.session.set(summary.session);
          this.buckets.set(summary.buckets || []);
          this.wasteLineItems.set((summary as any).wasteLineItems || []);
          this.amountKg.setValue(0);
          this.pieceCount.setValue(0);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to allocate category weight');
          this.loading.set(false);
        },
      })
    );
  }

  closeConfirm(): void {
    const remaining = this.totals().remaining;
    if (remaining > 0) {
      this.sealWasteCategoryId.setValue('');
      this.showSealWastePrompt.set(true);
    } else {
      this.showCloseConfirm.set(true);
    }
  }

  closeSealWastePromptCancel(): void {
    this.showSealWastePrompt.set(false);
    this.sealWasteCategoryId.setValue('');
  }

  closeSealWastePromptConfirm(): void {
    if (!this.sealWasteCategoryId.value) {
      this.error.set('Please select a waste category for the remaining weight');
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
          this.error.set(err?.message || 'Failed to seal session');
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
      this.error.set('Please start the session first');
      return;
    }

    const categoryId = this.wasteCategoryId.value;
    const amount = Number(this.wasteAmount.value ?? 0);
    if (!categoryId) {
      this.error.set('Please select a waste category');
      return;
    }
    if (!(amount > 0)) {
      this.error.set('Enter a waste amount > 0 KG');
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
      this.error.set('Enter a weight > 0 KG');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.facade.stage1UpdateBucket(bucket.id, weight).subscribe({
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

  private refreshSummary(): void {
    const item = this.rag();
    if (!item?.id) {
      this.loading.set(false);
      return;
    }

    this.subs.add(
      this.facade.stage1Summary(item.id).subscribe({
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
}
