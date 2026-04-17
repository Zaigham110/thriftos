/**
 * REPACK WORKSPACE — ALIGNED WITH PROCUREMENT PATTERN
 * ====================================================
 * Table-based workspace with proper page header
 * 
 * State Machine:
 * DRAFT → (allocations) → READY → SEAL → SEALED
 */

import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { RepackService } from '../repack.service';
import { AuthService } from '../../../core/auth/auth';
import { RepackUnit, RepackAllocation, AvailableStock, MeasurementType, Warehouse } from '../repack.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppDialogComponent,
  AppLoadingComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppSelectComponent,
  AppDataTableComponent,
  type DataTableColumn,
} from '../../../shared/ui';

@Component({
  selector: 'app-repack-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppButtonComponent,
    AppStackComponent,
    AppBadgeComponent,
    AppBreadcrumbComponent,
    AppDialogComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppErrorStateComponent,
    AppSelectComponent,
    AppDataTableComponent,
  ],
  templateUrl: './repack-workspace.page.html',
  styleUrl: './repack-workspace.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackWorkspaceComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly repackService = inject(RepackService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  // ============================================
  // BREADCRUMBS
  // ============================================
  
  readonly breadcrumbs = computed(() => {
    const u = this.unit();
    return [
      { label: 'Packaging', link: '/packaging' },
      { label: 'Repack', link: '/packaging/repack' },
      { label: u?.unitCode || 'Workspace', link: undefined },
    ];
  });

  // ============================================
  // TABLE COLUMNS
  // ============================================

  readonly stockColumns: DataTableColumn[] = [
    { key: 'source', label: 'Source', getValue: (row) => this.getSourceLabel(row as AvailableStock) },
    { key: 'remainingAmount', label: 'Available' },
  ];

  readonly allocationColumns: DataTableColumn[] = [
    { key: 'source', label: 'Source', getValue: (row) => this.getSourceLabel(row as RepackAllocation) },
    { key: 'amountUsed', label: 'Amount' },
  ];

  // ============================================
  // CORE STATE
  // ============================================
  
  readonly unitId = signal<string | null>(null);
  readonly unit = signal<RepackUnit | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ============================================
  // NEW MODE STATE (for creating new units)
  // ============================================
  
  readonly isNewMode = signal(false);
  readonly newModeForm = signal({
    categoryId: '',
    gradeId: '',
    targetAmount: 100,
    measurementType: 'WEIGHT' as MeasurementType
  });
  readonly categories = signal<Array<{id: string, name: string}>>([]);
  readonly grades = signal<Array<{id: string, name: string}>>([]);
  readonly creatingDraft = signal(false);

  // ============================================
  // AVAILABLE STOCK
  // ============================================
  
  readonly availableStock = signal<AvailableStock[]>([]);
  readonly loadingStock = signal(false);

  // ============================================
  // ADD ALLOCATION MODAL
  // ============================================
  
  readonly showAddModal = signal(false);
  readonly selectedStock = signal<AvailableStock | null>(null);
  readonly allocAmount = signal<number>(0);
  readonly adding = signal(false);

  // ============================================
  // REMOVE ALLOCATION
  // ============================================
  
  readonly removing = signal(false);

  // ============================================
  // SEAL MODAL
  // ============================================
  
  readonly showSealModal = signal(false);
  readonly selectedWarehouseId = signal<string | null>(null);
  readonly sealing = signal(false);

  // Warehouses reference (tenant-scoped)
  readonly warehouses = signal<Warehouse[]>([]);
  readonly warehouseOptions = computed(() =>
    this.warehouses().map((w) => ({ label: w.name, value: w.id }))
  );

  // ============================================
  // COMPUTED STATE
  // ============================================

  readonly isDraft = computed(() => this.unit()?.status === 'DRAFT');
  readonly isSealed = computed(() => this.unit()?.status === 'SEALED');

  readonly allocatedAmount = computed(() => {
    const u = this.unit();
    if (!u) return 0;
    return Number(u.allocatedAmount) || 0;
  });

  readonly targetAmount = computed(() => {
    const u = this.unit();
    if (!u) return 0;
    return Number(u.targetAmount) || 0;
  });

  readonly remainingAmount = computed(() => {
    return Math.max(0, this.targetAmount() - this.allocatedAmount());
  });

  readonly progressPercent = computed(() => {
    const target = this.targetAmount();
    if (target <= 0) return 0;
    return Math.min(100, (this.allocatedAmount() / target) * 100);
  });

  readonly isReady = computed(() => {
    const remaining = this.remainingAmount();
    return this.isDraft() && remaining < 0.01;
  });

  readonly canSeal = computed(() => {
    return this.isDraft() && this.allocations().length > 0 && this.authService.hasPermission('REPACK_ALLOCATE');
  });

  readonly sealTooltip = computed(() => {
    if (this.isSealed()) return 'Unit is already sealed';
    if (!this.isDraft()) return 'Unit must be in DRAFT status';
    if (this.allocations().length === 0) return 'Cannot seal: No allocations added';
    if (!this.authService.hasPermission('REPACK_ALLOCATE')) return 'Insufficient permissions';
    const remaining = this.remainingAmount();
    if (remaining > 0) {
      return `⚠️ Target not met: ${remaining.toFixed(2)} ${this.measurementUnit()} short`;
    }
    return 'Seal this unit and create inventory item';
  });

  readonly measurementUnit = computed(() => {
    const u = this.unit();
    return u?.measurementType === 'WEIGHT' ? 'kg' : 'pcs';
  });

  readonly allocations = computed((): RepackAllocation[] => {
    const u = this.unit();
    // Backend returns inputAllocations, frontend model also supports allocations
    return u?.inputAllocations || u?.allocations || [];
  });

  readonly canAddAllocationsInNewMode = computed(() => {
    if (!this.isNewMode()) return true;
    const form = this.newModeForm();
    return !!(form.categoryId && form.gradeId && form.targetAmount > 0);
  });

  readonly newModeTargetAmount = computed(() => {
    return this.isNewMode() ? this.newModeForm().targetAmount : 0;
  });

  readonly newModeMeasurementUnit = computed(() => {
    return this.isNewMode() && this.newModeForm().measurementType === 'WEIGHT' ? 'kg' : 'pcs';
  });

  // ============================================
  // LIFECYCLE
  // ============================================

  ngOnInit(): void {
    // Check if we're in "new" mode
    const mode = this.route.snapshot.queryParamMap.get('mode');
    if (mode === 'new') {
      this.isNewMode.set(true);
      this.loading.set(false);
      this.loadReferenceData();
      this.loadWarehouses();
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.unitId.set(id);
      this.loadUnit(id);
    } else {
      this.router.navigate(['/packaging/repack']);
    }

    this.loadWarehouses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // DATA LOADING
  // ============================================

  loadReferenceData(): void {
    this.repackService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: (err) => console.error('Failed to load categories:', err)
    });
    this.repackService.getGrades().subscribe({
      next: (grds) => this.grades.set(grds),
      error: (err) => console.error('Failed to load grades:', err)
    });
  }

  loadWarehouses(): void {
    this.repackService.getWarehouses().subscribe({
      next: (ws) => this.warehouses.set(ws),
      error: (err) => console.error('Failed to load warehouses:', err),
    });
  }

  // Called when category/grade changes in new mode form
  loadAvailableStockForNewMode(): void {
    const form = this.newModeForm();
    if (!form.categoryId || !form.gradeId) {
      this.availableStock.set([]);
      return;
    }

    this.loadingStock.set(true);
    this.repackService.getAvailableStock(
      form.categoryId,
      form.gradeId,
      form.measurementType
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stock) => {
          this.availableStock.set(stock || []);
          this.loadingStock.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingStock.set(false);
        },
      });
  }

  loadUnit(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.repackService.getUnit(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (unit) => {
          this.unit.set(unit);
          this.loading.set(false);

          // Load available stock if draft
          if (unit.status === 'DRAFT') {
            this.loadAvailableStock(unit);
          }
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  loadAvailableStock(unit: RepackUnit): void {
    if (!unit.categoryId || !unit.gradeId) return;

    this.loadingStock.set(true);

    this.repackService.getAvailableStock(
      unit.categoryId,
      unit.gradeId,
      unit.measurementType
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stock) => {
          this.availableStock.set(stock || []);
          this.loadingStock.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingStock.set(false);
        },
      });
  }

  // ============================================
  // ADD ALLOCATION
  // ============================================

  openAddModal(stock: AvailableStock): void {
    const maxAmount = Math.min(stock.remainingAmount, this.remainingAmount());
    this.selectedStock.set(stock);
    this.allocAmount.set(maxAmount);
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.selectedStock.set(null);
    this.allocAmount.set(0);
  }

  onAllocAmountChange(value: string | number): void {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    this.allocAmount.set(num);
  }

  confirmAddAllocation(): void {
    const stock = this.selectedStock();
    const amount = this.allocAmount();
    
    if (!stock || amount <= 0) return;

    // NEW MODE: Create draft with first allocation
    if (this.isNewMode()) {
      const form = this.newModeForm();
      if (!form.categoryId || !form.gradeId) {
        this.error.set('Please select category and grade');
        return;
      }

      this.creatingDraft.set(true);
      this.adding.set(true);

      this.repackService.createDraftWithAllocation(
        {
          categoryId: form.categoryId,
          gradeId: form.gradeId,
          measurementType: form.measurementType,
          targetAmount: form.targetAmount,
        },
        {
          gradingOutputId: stock.id,
          amountUsed: amount,
        }
      )
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (unit) => {
            this.creatingDraft.set(false);
            this.adding.set(false);
            this.isNewMode.set(false);
            this.unitId.set(unit.id);
            this.unit.set(unit);
            this.closeAddModal();
            // Update URL to remove ?mode=new and add the ID
            this.router.navigate(['/packaging/repack', unit.id], { replaceUrl: true });
            // Reload to get full data
            this.loadUnit(unit.id);
          },
          error: (err) => {
            this.creatingDraft.set(false);
            this.adding.set(false);
            this.error.set(err.message);
          },
        });
      return;
    }

    // EXISTING DRAFT: Add allocation normally
    const unitId = this.unitId();
    if (!unitId) return;

    this.adding.set(true);

    this.repackService.addAllocation(unitId, {
      gradingOutputId: stock.id,
      amountUsed: amount,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.adding.set(false);
          this.closeAddModal();
          this.loadUnit(unitId);
        },
        error: (err) => {
          this.adding.set(false);
          this.error.set(err.message);
        },
      });
  }

  // ============================================
  // REMOVE ALLOCATION
  // ============================================

  removeAllocation(allocation: RepackAllocation): void {
    const unitId = this.unitId();
    if (!unitId) return;

    if (!confirm('Remove this allocation? The stock will be released.')) return;

    this.removing.set(true);

    this.repackService.removeAllocation(unitId, allocation.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.removing.set(false);
          this.loadUnit(unitId);
        },
        error: (err) => {
          this.removing.set(false);
          this.error.set(err.message);
        },
      });
  }

  // ============================================
  // SEAL
  // ============================================

  openSealModal(): void {
    this.showSealModal.set(true);
  }

  closeSealModal(): void {
    this.showSealModal.set(false);
    this.selectedWarehouseId.set(null);
  }

  confirmSeal(): void {
    const unitId = this.unitId();
    if (!unitId) return;

    // warehouseId is optional - can be null
    const warehouseId = this.selectedWarehouseId();

    this.sealing.set(true);

    this.repackService.sealDraft(unitId, warehouseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sealing.set(false);
          this.closeSealModal();
          this.router.navigate(['/packaging/repack']);
        },
        error: (err) => {
          this.sealing.set(false);
          this.error.set(err.message);
        },
      });
  }

  // ============================================
  // HELPERS
  // ============================================

  // Update form methods for new mode
  updateNewModeCategory(categoryId: string): void {
    const form = this.newModeForm();
    this.newModeForm.set({ ...form, categoryId });
    this.loadAvailableStockForNewMode();
  }

  updateNewModeGrade(gradeId: string): void {
    const form = this.newModeForm();
    this.newModeForm.set({ ...form, gradeId });
    this.loadAvailableStockForNewMode();
  }

  updateNewModeTarget(targetAmount: number): void {
    const form = this.newModeForm();
    this.newModeForm.set({ ...form, targetAmount });
  }

  updateNewModeMeasurement(measurementType: string): void {
    const form = this.newModeForm();
    this.newModeForm.set({ ...form, measurementType: measurementType as MeasurementType });
  }

  getSourceLabel(item: AvailableStock | RepackAllocation): string {
    if ('containerNumber' in item && item.containerNumber) {
      return item.containerNumber;
    }
    if ('ragCode' in item && item.ragCode) {
      return item.ragCode;
    }
    return 'Source';
  }

  getStatusLabel(): string {
    const u = this.unit();
    if (!u) return 'DRAFT';
    if (u.status === 'SEALED') return 'SEALED';
    if (this.isReady()) return 'READY';
    return 'DRAFT';
  }

  getStatusVariant(): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
    const u = this.unit();
    if (!u) return 'default';
    if (u.status === 'SEALED') return 'success';
    if (this.isReady()) return 'primary';
    return 'warning';
  }

  goBack(): void {
    this.router.navigate(['/packaging/repack']);
  }
}
