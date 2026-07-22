/**
 * Repack Workspace Component
 * Phase 2: Repack Module UI
 * 
 * Interactive batching workspace for consolidating Stage 2 Grade Outputs into sealed repack units.
 */

import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft,
  Box,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  Sparkles,
  Layers,
  Scale,
  Warehouse as WarehouseIcon,
  FileText,
  AlertTriangle,
  Package,
} from 'lucide-angular';

import { RepackService } from '../repack.service';
import { RepackUnit, RepackAllocation, AvailableStock, MeasurementType, Warehouse } from '../repack.models';
import { AuthService } from '../../../core/auth/auth';
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
  selector: 'app-repack-workspace',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
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

  private readonly subs = new Subscription();

  readonly icons = {
    ArrowLeft,
    Box,
    Plus,
    Trash2,
    Lock,
    CheckCircle2,
    Sparkles,
    Layers,
    Scale,
    Warehouse: WarehouseIcon,
    FileText,
    AlertTriangle,
    Package,
  };

  readonly unitId = signal<string | null>(null);
  readonly unit = signal<RepackUnit | null>(null);
  readonly availableStock = signal<AvailableStock[]>([]);

  readonly loading = signal(true);
  readonly loadingStock = signal(false);
  readonly error = signal<string | null>(null);

  // Form & modal controls
  readonly allocAmount = new FormControl<number>(0, { nonNullable: true });
  readonly selectedStockId = new FormControl<string>('', { nonNullable: true });

  readonly showSealModal = signal(false);
  readonly warehouseIdControl = new FormControl<string>('', { nonNullable: true });
  readonly warehouses = signal<Warehouse[]>([]);

  readonly adding = signal(false);
  readonly removing = signal(false);
  readonly sealing = signal(false);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const u = this.unit();
    return [
      { label: 'Packaging', route: '/app/packaging/repack' },
      { label: 'Repack Registry', route: '/app/packaging/repack' },
      { label: u?.unitCode || 'Workspace' },
    ];
  });

  readonly isDraft = computed(() => this.unit()?.status === 'DRAFT');
  readonly isSealed = computed(() => this.unit()?.status === 'SEALED');

  readonly allocatedAmount = computed(() => Number(this.unit()?.allocatedAmount || 0));
  readonly targetAmount = computed(() => Number(this.unit()?.targetAmount || 0));
  readonly remainingAmount = computed(() => Math.max(0, this.targetAmount() - this.allocatedAmount()));

  readonly progressPercent = computed(() => {
    const target = this.targetAmount();
    if (target <= 0) return 0;
    return Math.min(100, (this.allocatedAmount() / target) * 100);
  });

  readonly canSeal = computed(() => {
    return this.isDraft() && this.allocations().length > 0 && this.remainingAmount() === 0;
  });

  readonly measurementUnit = computed(() => {
    return this.unit()?.measurementType === 'WEIGHT' ? 'KG' : 'PCS';
  });

  readonly allocations = computed((): RepackAllocation[] => {
    const u = this.unit();
    return u?.inputAllocations || u?.allocations || [];
  });

  readonly warehouseOptions = computed(() =>
    this.warehouses().map((w) => ({ label: w.name, value: w.id }))
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing repack unit id');
      this.loading.set(false);
      return;
    }

    this.unitId.set(id);
    this.loadUnit(id);
    this.loadWarehouses();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadUnit(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.subs.add(
      this.repackService.getUnit(id).subscribe({
        next: (unit) => {
          this.unit.set(unit);
          this.loading.set(false);

          if (unit.status === 'DRAFT') {
            this.loadAvailableStock(unit);
          }
        },
        error: (err) => {
          this.error.set(err?.message || 'Failed to load repack workspace');
          this.loading.set(false);
        },
      })
    );
  }

  loadWarehouses(): void {
    this.subs.add(
      this.repackService.getWarehouses().subscribe({
        next: (ws) => this.warehouses.set(ws || []),
        error: (err) => console.error('Failed to load warehouses:', err),
      })
    );
  }

  loadAvailableStock(unit: RepackUnit): void {
    if (!unit.categoryId || !unit.gradeId) return;

    this.loadingStock.set(true);
    this.subs.add(
      this.repackService.getAvailableStock(unit.categoryId, unit.gradeId, unit.measurementType).subscribe({
        next: (stock) => {
          this.availableStock.set(stock || []);
          this.loadingStock.set(false);
        },
        error: (err) => {
          this.loadingStock.set(false);
        },
      })
    );
  }

  onStockSelect(): void {
    const stockId = this.selectedStockId.value;
    const stock = this.availableStock().find((s) => s.id === stockId);
    if (stock) {
      const maxAllocable = Math.min(stock.remainingAmount, this.remainingAmount());
      this.allocAmount.setValue(Number(maxAllocable.toFixed(2)));
    }
  }

  addAllocation(): void {
    const unitId = this.unitId();
    const stockId = this.selectedStockId.value;
    const amount = Number(this.allocAmount.value ?? 0);

    if (!unitId || !stockId || !(amount > 0)) {
      this.error.set('Please select stock and enter an amount > 0.');
      return;
    }

    this.adding.set(true);
    this.error.set(null);

    this.subs.add(
      this.repackService.addAllocation(unitId, {
        gradingOutputId: stockId,
        amountUsed: amount,
      }).subscribe({
        next: () => {
          this.adding.set(false);
          this.selectedStockId.setValue('');
          this.allocAmount.setValue(0);
          this.loadUnit(unitId);
        },
        error: (err) => {
          this.adding.set(false);
          this.error.set(err?.message || 'Failed to add allocation');
        },
      })
    );
  }

  removeAllocation(allocation: RepackAllocation): void {
    const unitId = this.unitId();
    if (!unitId) return;

    this.removing.set(true);
    this.error.set(null);

    this.subs.add(
      this.repackService.removeAllocation(unitId, allocation.id).subscribe({
        next: () => {
          this.removing.set(false);
          this.loadUnit(unitId);
        },
        error: (err) => {
          this.removing.set(false);
          this.error.set(err?.message || 'Failed to remove allocation');
        },
      })
    );
  }

  openSealModal(): void {
    this.showSealModal.set(true);
  }

  closeSealModal(): void {
    this.showSealModal.set(false);
  }

  confirmSeal(): void {
    const unitId = this.unitId();
    if (!unitId) return;

    this.showSealModal.set(false);
    this.sealing.set(true);
    this.error.set(null);

    const warehouseId = this.warehouseIdControl.value || undefined;

    this.subs.add(
      this.repackService.sealDraft(unitId, warehouseId).subscribe({
        next: () => {
          this.sealing.set(false);
          this.router.navigate(['/app/packaging/repack']);
        },
        error: (err) => {
          this.sealing.set(false);
          this.error.set(err?.message || 'Failed to seal repack unit');
        },
      })
    );
  }

  backToList(): void {
    this.router.navigate(['/app/packaging/repack']);
  }

  getSourceLabel(item: any): string {
    if (item.containerNumber) return `Container: ${item.containerNumber}`;
    if (item.ragCode) return `Rag: ${item.ragCode}`;
    return 'Grade Output';
  }
}
