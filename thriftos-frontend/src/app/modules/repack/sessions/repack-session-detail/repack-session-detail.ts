/**
 * Repack Session Detail Component
 * Phase 5: Repack & QR Code Generation
 * 
 * Main workspace for creating repack units from graded outputs.
 * Includes:
 * - Full lineage traceability header (Container → Rag → Stage1 → Stage2)
 * - Grade outputs selection (source items to pack)
 * - Unit creation with weight validation
 * - QR code preview
 * - Session lifecycle (OPEN → CLOSED)
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
  Scale,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Link,
  Box,
  FileText,
  QrCode,
  Layers,
  Star,
  Hash,
  PackagePlus,
  ChevronDown,
  AlertCircle,
  Info,
} from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { RepackService } from '../../repack.service';
import {
  RepackSession,
  RepackUnit,
  UnitType,
  CreateRepackUnitRequest,
  QRLabelResponse,
  RepackTotals,
  Grade,
  Category,
  GradeOutput,
  AvailableForRepackSummary,
  AddRepackItemRequest,
} from '../../repack.models';

// Local form state for adding items to a unit
interface AddItemForm {
  gradeOutputId: string;
  weightKg: number;
  pcsCount: number;
}

@Component({
  selector: 'app-repack-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
  ],
  templateUrl: './repack-session-detail.html',
  styleUrl: './repack-session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackSessionDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repackService = inject(RepackService);

  readonly icons = {
    arrowLeft: ArrowLeft,
    save: Save,
    lock: Lock,
    package: Package,
    scale: Scale,
    checkCircle: CheckCircle2,
    alertTriangle: AlertTriangle,
    plus: Plus,
    trash: Trash2,
    link: Link,
    box: Box,
    fileText: FileText,
    qrCode: QrCode,
    layers: Layers,
    star: Star,
    hash: Hash,
    packagePlus: PackagePlus,
    chevronDown: ChevronDown,
    alertCircle: AlertCircle,
    info: Info,
  };

  // Service state
  readonly loading = this.repackService.loading;
  readonly session = this.repackService.currentSession;
  readonly units = this.repackService.units;
  readonly grades = this.repackService.grades;
  readonly categories = this.repackService.categories;
  readonly gradeOutputs = this.repackService.gradeOutputs;
  readonly availableGradeOutputs = this.repackService.availableGradeOutputs;
  readonly selectedUnit = this.repackService.selectedUnit;
  readonly qrData = this.repackService.qrData;
  readonly repackTotals = this.repackService.repackTotals;
  readonly isEditable = this.repackService.isEditable;

  // Local state
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showCloseConfirm = signal(false);
  readonly showAddUnit = signal(false);
  readonly showAddItem = signal(false);
  readonly gradeSessionId = signal<string | null>(null);

  // Lineage data (derived from grade outputs)
  readonly lineage = computed(() => {
    const outputs = this.gradeOutputs();
    if (outputs.length === 0) return null;
    
    const firstOutput = outputs[0];
    const gradeSession = firstOutput.gradeBucket?.gradeSession;
    const categoryOutput = gradeSession?.categoryOutput;
    
    return {
      gradeSessionId: gradeSession?.id || 'N/A',
      categoryId: categoryOutput?.categoryId || null,
      categoryName: categoryOutput?.category?.name || 'Unknown Category',
      containerId: categoryOutput?.containerId || null,
      containerNumber: categoryOutput?.container?.containerNumber || 'N/A',
      ragId: categoryOutput?.ragId || null,
      ragCode: categoryOutput?.rag?.ragCode || 'N/A',
      sortSessionId: categoryOutput?.sortSessionId || null,
      inputWeight: this.toNum(categoryOutput?.weightKg),
    };
  });

  // New unit form
  readonly newUnit = signal<{
    unitType: UnitType;
    categoryId: string;
    gradeId: string;
    weightKg: number;
    pcsCount: number;
  } | null>(null);

  // Add item to unit form
  readonly addItemForm = signal<AddItemForm | null>(null);
  readonly selectedUnitForItem = signal<RepackUnit | null>(null);

  // Unit type options
  readonly unitTypeOptions: { value: UnitType; label: string }[] = [
    { value: 'KG_BALE', label: 'Weight Bale (KG)' },
    { value: 'PCS_PACK', label: 'Piece Pack (PCS)' },
    { value: 'MIXED_BALE', label: 'Mixed Bale' },
  ];

  // Computed: Can close session (must have units)
  readonly canClose = computed(() => {
    const units = this.units();
    return this.isEditable() && units.length > 0;
  });

  // Computed: Filtered grade outputs for the selected unit (matching category/grade)
  readonly filteredGradeOutputsForUnit = computed(() => {
    const unit = this.selectedUnitForItem();
    const available = this.availableGradeOutputs();
    
    if (!unit) return available;
    
    // For MIXED_BALE, show all outputs
    if (unit.unitType === 'MIXED_BALE') {
      return available.filter(a => a.remainingWeightKg > 0);
    }
    
    // For other types, filter by matching category and grade
    const unitCategory = unit.category?.name?.toLowerCase();
    const unitGrade = unit.grade?.name?.toLowerCase();
    
    return available.filter(a => {
      const matches = a.categoryName.toLowerCase() === unitCategory && 
                      a.gradeName.toLowerCase() === unitGrade;
      return matches && a.remainingWeightKg > 0;
    });
  });

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    const gradeSessionIdParam = this.route.snapshot.queryParamMap.get('gradeSessionId');
    
    if (gradeSessionIdParam) {
      this.gradeSessionId.set(gradeSessionIdParam);
    }
    
    if (sessionId) {
      this.loadData(sessionId);
    }
  }

  ngOnDestroy(): void {
    this.repackService.clearCurrentSession();
  }

  private loadData(sessionId: string): void {
    // Load reference data
    this.repackService.loadReferenceData().subscribe();
    
    // Load session
    this.repackService.getSession(sessionId).subscribe({
      next: () => {
        // After session loads, load grade outputs if we have a gradeSessionId
        const gradeSessionId = this.gradeSessionId();
        if (gradeSessionId) {
          this.repackService.loadAvailableForRepack(gradeSessionId).subscribe({
            error: (err: any) => {
              console.error('Failed to load grade outputs:', err);
            },
          });
        }
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to load session');
      },
    });
  }

  // =============================================================
  // UNIT OPERATIONS
  // =============================================================

  startAddUnit(): void {
    const defaultCategory = this.categories()[0]?.id || '';
    const defaultGrade = this.grades()[0]?.id || '';
    
    this.newUnit.set({
      unitType: 'KG_BALE',
      categoryId: defaultCategory,
      gradeId: defaultGrade,
      weightKg: 0,
      pcsCount: 0,
    });
    this.showAddUnit.set(true);
  }

  cancelAddUnit(): void {
    this.newUnit.set(null);
    this.showAddUnit.set(false);
  }

  // Form update helpers (spread operator doesn't work in templates)
  updateUnitType(value: UnitType): void {
    const current = this.newUnit();
    if (current) {
      this.newUnit.set({ ...current, unitType: value });
    }
  }

  updateCategoryId(value: string): void {
    const current = this.newUnit();
    if (current) {
      this.newUnit.set({ ...current, categoryId: value });
    }
  }

  updateGradeId(value: string): void {
    const current = this.newUnit();
    if (current) {
      this.newUnit.set({ ...current, gradeId: value });
    }
  }

  updateWeightKg(value: number): void {
    const current = this.newUnit();
    if (current) {
      this.newUnit.set({ ...current, weightKg: value });
    }
  }

  updatePcsCount(value: number): void {
    const current = this.newUnit();
    if (current) {
      this.newUnit.set({ ...current, pcsCount: value });
    }
  }

  submitNewUnit(): void {
    const unit = this.newUnit();
    const session = this.session();
    if (!unit || !session) return;

    // Validate
    if (unit.weightKg <= 0) {
      this.error.set('Weight must be greater than 0');
      return;
    }
    if (unit.unitType === 'PCS_PACK' && unit.pcsCount <= 0) {
      this.error.set('Piece count must be greater than 0 for PCS_PACK');
      return;
    }
    if (unit.unitType !== 'MIXED_BALE' && (!unit.categoryId || !unit.gradeId)) {
      this.error.set('Category and Grade are required for non-mixed units');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const dto: CreateRepackUnitRequest = {
      unitType: unit.unitType,
      weightKg: unit.weightKg,
      pcsCount: unit.pcsCount || 0,
    };

    if (unit.unitType !== 'MIXED_BALE') {
      dto.categoryId = unit.categoryId;
      dto.gradeId = unit.gradeId;
    }

    this.repackService.createUnit(session.id, dto).subscribe({
      next: () => {
        this.cancelAddUnit();
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to create unit');
        this.saving.set(false);
      },
    });
  }

  selectUnit(unit: RepackUnit): void {
    this.repackService.selectUnit(unit);
  }

  // =============================================================
  // ADD ITEM TO UNIT (Consume from Grade Output)
  // =============================================================

  startAddItemToUnit(unit: RepackUnit): void {
    this.selectedUnitForItem.set(unit);
    this.addItemForm.set({
      gradeOutputId: '',
      weightKg: 0,
      pcsCount: 0,
    });
    this.showAddItem.set(true);
  }

  cancelAddItem(): void {
    this.addItemForm.set(null);
    this.selectedUnitForItem.set(null);
    this.showAddItem.set(false);
  }

  updateAddItemGradeOutput(value: string): void {
    const form = this.addItemForm();
    if (form) {
      // Get the max available weight for this grade output
      const maxWeight = this.repackService.getRemainingWeight(value);
      const maxPcs = this.repackService.getRemainingPcs(value);
      this.addItemForm.set({
        ...form,
        gradeOutputId: value,
        // Pre-fill with max available (user can adjust)
        weightKg: Math.min(form.weightKg || maxWeight, maxWeight),
        pcsCount: Math.min(form.pcsCount || maxPcs, maxPcs),
      });
    }
  }

  updateAddItemWeight(value: number): void {
    const form = this.addItemForm();
    if (form) {
      const maxWeight = this.repackService.getRemainingWeight(form.gradeOutputId);
      this.addItemForm.set({
        ...form,
        weightKg: Math.min(value, maxWeight),
      });
    }
  }

  updateAddItemPcs(value: number): void {
    const form = this.addItemForm();
    if (form) {
      const maxPcs = this.repackService.getRemainingPcs(form.gradeOutputId);
      this.addItemForm.set({
        ...form,
        pcsCount: Math.min(value, maxPcs),
      });
    }
  }

  getMaxWeightForSelectedOutput(): number {
    const form = this.addItemForm();
    if (!form || !form.gradeOutputId) return 0;
    return this.repackService.getRemainingWeight(form.gradeOutputId);
  }

  getMaxPcsForSelectedOutput(): number {
    const form = this.addItemForm();
    if (!form || !form.gradeOutputId) return 0;
    return this.repackService.getRemainingPcs(form.gradeOutputId);
  }

  submitAddItem(): void {
    const form = this.addItemForm();
    const unit = this.selectedUnitForItem();
    
    if (!form || !unit) return;

    // Validate
    if (!form.gradeOutputId) {
      this.error.set('Please select a grade output to consume');
      return;
    }
    if (form.weightKg <= 0) {
      this.error.set('Weight must be greater than 0');
      return;
    }

    const maxWeight = this.repackService.getRemainingWeight(form.gradeOutputId);
    if (form.weightKg > maxWeight) {
      this.error.set(`Cannot consume ${form.weightKg}kg. Only ${maxWeight.toFixed(2)}kg remaining.`);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const dto: AddRepackItemRequest = {
      gradeOutputId: form.gradeOutputId,
      weightKg: form.weightKg,
      pcsCount: form.pcsCount || 0,
    };

    this.repackService.addItemToUnit(unit.id, dto).subscribe({
      next: () => {
        this.cancelAddItem();
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to add item to unit');
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
    const session = this.session();
    if (!session) return;

    this.saving.set(true);
    this.error.set(null);

    this.repackService.closeSession(session.id).subscribe({
      next: () => {
        this.showCloseConfirm.set(false);
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err.message || 'Failed to close session');
        this.showCloseConfirm.set(false);
        this.saving.set(false);
      },
    });
  }

  // =============================================================
  // HELPERS
  // =============================================================

  toNum(val: any): number {
    return typeof val === 'string' ? parseFloat(val) : (val || 0);
  }

  truncateId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 8)}...` : id;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatWeight(weight: number | string): string {
    const num = this.toNum(weight);
    return num.toFixed(2);
  }

  getUnitTypeBadge(unitType: UnitType): string {
    switch (unitType) {
      case 'KG_BALE':
        return 'KG';
      case 'PCS_PACK':
        return 'PCS';
      case 'MIXED_BALE':
        return 'MIX';
      default:
        return unitType;
    }
  }

  getUnitTypeVariant(unitType: UnitType): 'primary' | 'success' | 'warning' {
    switch (unitType) {
      case 'KG_BALE':
        return 'primary';
      case 'PCS_PACK':
        return 'success';
      case 'MIXED_BALE':
        return 'warning';
      default:
        return 'primary';
    }
  }

  getCategoryName(unit: RepackUnit): string {
    return unit.category?.name || 'Mixed';
  }

  getGradeName(unit: RepackUnit): string {
    return unit.grade?.name || 'Mixed';
  }

  getUnitConsumedWeight(unit: RepackUnit): number {
    if (!unit.repackItems) return 0;
    return unit.repackItems.reduce((sum, item) => sum + this.toNum(item.weightKg), 0);
  }

  getUnitConsumedPcs(unit: RepackUnit): number {
    if (!unit.repackItems) return 0;
    return unit.repackItems.reduce((sum, item) => sum + item.pcsCount, 0);
  }

  getUnitFillPercentage(unit: RepackUnit): number {
    const consumed = this.getUnitConsumedWeight(unit);
    const target = this.toNum(unit.weightKg);
    if (target <= 0) return 0;
    return Math.min(100, (consumed / target) * 100);
  }

  isUnitFull(unit: RepackUnit): boolean {
    return this.getUnitFillPercentage(unit) >= 100;
  }
}
