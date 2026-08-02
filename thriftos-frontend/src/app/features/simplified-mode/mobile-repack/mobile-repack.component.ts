import { Component, signal, computed, OnInit, HostListener, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_BASE_URL } from '../../../core/config/api.config';

interface AvailableStockRow {
  id: string;
  categoryId: string;
  categoryName: string;
  gradeId: string;
  gradeName: string;
  measurementType: 'WEIGHT' | 'QUANTITY';
  remainingAmount: number;
  allocatedCost: number;
  costPerUnit: number;
  ragCode?: string;
}

interface SealedUnitRow {
  id: string;
  unitCode: string;
  weightKg: number;
  pcsCount: number;
  totalCost: number;
  createdAt: string;
  category?: { name: string };
  grade?: { name: string };
  qrLabel?: { qrCode: string };
}

@Component({
  selector: 'app-mobile-repack',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lite-repack-workstation">
      <!-- Mobile View Toggle Tabs (< 1024px) -->
      <div class="view-toggle-tabs mobile-only">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'create'"
          (click)="activeTab.set('create')"
        >
          <span>📦 Repack & QR Generator</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'history'"
          (click)="activeTab.set('history')"
        >
          <span>🏷️ Sealed Stock ({{ sealedUnits().length }})</span>
        </button>
      </div>

      <!-- RESPONSIVE DUAL-COLUMN WORKSTATION (DESKTOP SPLIT / MOBILE STACKED) -->
      <div class="workstation-grid">
        <!-- ========================================================= -->
        <!-- COLUMN 1: REPACK FORM & QR GENERATOR -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'create' || isDesktopView()" class="repack-card">
          <div class="card-header">
            <h3>📦 Repacking Workstation</h3>
            <span class="badge-tag">Grade Output to SKU</span>
          </div>

          <div *ngIf="resumedSessionId()" class="resume-session-banner" role="status">
            Resuming repack session {{ resumedSessionId() }}. New units will remain in this session.
          </div>

          <!-- Status Alert -->
      <div *ngIf="statusMessage()" role="status" aria-live="polite" class="status-alert" [class.success]="statusType() === 'success'" [class.error]="statusType() === 'error'">
            <span>{{ statusMessage() }}</span>
            <button type="button" class="dismiss-btn" (click)="statusMessage.set('')">✕</button>
          </div>

          <!-- Step 1: Select Available Graded Stock Output -->
          <div class="input-group">
            <label>1. Select Graded Stock Output</label>
            <div *ngIf="availableStock().length === 0" class="empty-stock-box">
              <p>No graded stock available. Complete a Stage 2 Grade session first.</p>
            </div>

            <div *ngIf="availableStock().length > 0" class="stock-chip-grid">
              <div
                *ngFor="let s of availableStock(); trackBy: trackById"
                class="stock-card-chip"
                [class.selected]="selectedStockId === s.id"
                (click)="selectStockItem(s)"
              >
                <div class="chip-top">
                  <span class="cat-lbl">{{ s.categoryName }}</span>
                  <span class="grade-pill">{{ s.gradeName }}</span>
                </div>
                <div class="chip-bottom">
                  <span class="rem-weight">Rem: <strong>{{ s.remainingAmount }} KG</strong></span>
                  <span class="unit-cost">{{ s.costPerUnit | currency:'USD':'symbol':'1.2-2' }}/KG</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Target Repack Weight Entry (KG) -->
          <div *ngIf="selectedStockItem" class="input-group">
            <label>2. Target Repack Weight (KG)</label>
            <div class="weight-input-box">
              <input
                type="number"
                step="0.1"
                [(ngModel)]="targetWeight"
                placeholder="0.0"
                class="weight-field"
              />
              <span class="unit-tag">KG</span>
            </div>
            <!-- Quick Preset Weight Buttons -->
            <div class="preset-buttons">
              <button type="button" (click)="addPresetWeight(10)">+10</button>
              <button type="button" (click)="addPresetWeight(25)">+25</button>
              <button type="button" (click)="addPresetWeight(45)">+45</button>
              <button type="button" (click)="addPresetWeight(50)">+50</button>
              <button type="button" (click)="addPresetWeight(100)">+100</button>
            </div>
          </div>

          <!-- Estimated Unit Cost Summary Badge -->
          <div *ngIf="estimatedUnitCost()" class="cost-summary-pill">
            <span class="lbl">Estimated Repack Cost:</span>
            <span class="val">{{ estimatedUnitCost() | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="button"
            class="submit-action-btn"
            [disabled]="!selectedStockItem || !targetWeight || isSubmitting()"
            (click)="createAndSealRepackUnit()"
          >
            <span *ngIf="!isSubmitting()">📦 Create & Seal Repack Unit</span>
            <span *ngIf="isSubmitting()">Sealing Package...</span>
          </button>

          <!-- PRINTABLE QR CODE LABEL DISPLAY -->
          <div *ngIf="sealedQrLabel()" class="qr-label-printable-card">
            <div class="label-header">
              <span class="brand-title">THRIFTOS INVENTORY SKU</span>
              <span class="sealed-tag">SEALED SKU</span>
            </div>

            <div class="qr-matrix-box">
              <div class="fake-qr-code">
                <span class="qr-icon">📱</span>
                <span class="qr-code-text">{{ sealedQrCode() }}</span>
              </div>
            </div>

            <div class="label-meta-grid">
              <div class="meta-row">
                <span class="lbl">Unit Code:</span>
                <span class="val code">{{ sealedUnitCode() }}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Category:</span>
                <span class="val">{{ sealedCategoryName() }}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Grade:</span>
                <span class="val highlight">{{ sealedGradeName() }}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Weight:</span>
                <span class="val">{{ sealedWeight() }} KG</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Landed Cost:</span>
                <span class="val">{{ sealedTotalCost() | currency:'USD':'symbol':'1.2-2' }}</span>
              </div>
            </div>

            <div class="label-actions">
              <button type="button" class="print-btn" (click)="printLabel()">🖨️ Print QR Label</button>
              <button type="button" class="next-btn" (click)="resetForm()">⚡ Repack Next Unit</button>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- COLUMN 2: SEALED STOCK UNITS HISTORY & INVENTORY TABLE -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'history' || isDesktopView()" class="history-card">
          <div class="card-header">
            <h3>🏷️ Sealed Repack Inventory Stock</h3>
            <button type="button" class="refresh-btn" (click)="fetchSealedUnits()">🔄 Refresh</button>
          </div>

          <div *ngIf="sealedUnits().length === 0" class="empty-history-box">
            <p>No sealed repack units generated yet.</p>
          </div>

          <!-- Desktop Table View -->
          <div *ngIf="sealedUnits().length > 0" class="history-table-container desktop-only">
            <table class="lite-table">
              <thead>
                <tr>
                  <th>Unit Code</th>
                  <th>Category</th>
                  <th>Grade</th>
                  <th>Weight</th>
                  <th>Landed Cost</th>
                  <th>Cost / KG</th>
                  <th>QR Code Payload</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of sealedUnits(); trackBy: trackById">
                  <td class="font-mono font-bold">{{ u.unitCode }}</td>
                  <td>{{ u.category?.name || 'Category' }}</td>
                  <td><span class="grade-pill">{{ u.grade?.name || 'Grade' }}</span></td>
                  <td>{{ u.weightKg }} KG</td>
                  <td class="font-bold">{{ (u.totalCost || 0) | currency:'USD':'symbol':'1.2-2' }}</td>
                  <td class="text-green-600 font-semibold">
                    {{ (u.weightKg ? u.totalCost / u.weightKg : 0) | currency:'USD':'symbol':'1.2-2' }}/KG
                  </td>
                  <td class="font-mono text-purple">{{ u.qrLabel?.qrCode || ('REPACK:' + u.unitCode) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards Stack View -->
          <div *ngIf="sealedUnits().length > 0" class="units-card-stack mobile-only">
            <div *ngFor="let u of sealedUnits(); trackBy: trackById" class="unit-history-card">
              <div class="card-top">
                <span class="unit-code-title">{{ u.unitCode }}</span>
                <span class="sealed-status-badge">SEALED</span>
              </div>

              <div class="unit-cat-grade">
                <span>{{ u.category?.name || 'Category' }} — <strong>{{ u.grade?.name || 'Grade' }}</strong></span>
              </div>

              <div class="metrics-grid">
                <div class="metric-cell">
                  <span class="m-lbl">Weight</span>
                  <span class="m-val">{{ u.weightKg }} KG</span>
                </div>
                <div class="metric-cell">
                  <span class="m-lbl">Landed Cost</span>
                  <span class="m-val">{{ (u.totalCost || 0) | currency:'USD':'symbol':'1.2-2' }}</span>
                </div>
                <div class="metric-cell">
                  <span class="m-lbl">Cost / KG</span>
                  <span class="m-val">{{ (u.weightKg ? u.totalCost / u.weightKg : 0) | currency:'USD':'symbol':'1.2-2' }}/KG</span>
                </div>
              </div>

              <div class="card-bottom">
                <span class="qr-text">{{ u.qrLabel?.qrCode || ('REPACK:' + u.unitCode) }}</span>
                <span class="date-lbl">{{ u.createdAt | date:'shortDate' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lite-repack-workstation {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .view-toggle-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: #e5e7eb;
      padding: 4px;
      border-radius: 10px;
    }

    .tab-btn {
      padding: 0.65rem 0.5rem;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #4b5563;
      cursor: pointer;
      &.active { background: #ffffff; color: #714b67; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    }

    .workstation-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    @media (min-width: 1024px) {
      .workstation-grid { grid-template-columns: 460px 1fr; }
      .mobile-only { display: none !important; }
    }

    @media (max-width: 1023px) {
      .desktop-only { display: none !important; }
    }

    .repack-card, .history-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .resume-session-banner {
      padding: .65rem .8rem;
      border-radius: .55rem;
      background: #edf7f2;
      color: #19613d;
      font-size: .85rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
    }

    .badge-tag {
      background: rgba(113, 75, 103, 0.1); color: #714b67; font-size: 0.72rem; font-weight: 700; padding: 4px 9px; border-radius: 6px; letter-spacing: 0.03em;
    }

    .refresh-btn {
      background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 5px 12px; font-size: 0.78rem; font-weight: 700; color: #374151; cursor: pointer; transition: background 0.15s;
      &:hover { background: #e5e7eb; }
    }

    .input-group {
      display: flex; flex-direction: column; gap: 0.55rem;
      label { font-size: 0.82rem; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; }
    }

    .empty-stock-box, .empty-history-box {
      text-align: center; padding: 1.75rem; background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 10px; font-size: 0.85rem; color: #6b7280; font-weight: 500;
    }

    .stock-chip-grid {
      display: flex; flex-direction: column; gap: 0.5rem;
    }

    .stock-card-chip {
      background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; cursor: pointer;
      &.selected { background: #fdf4ff; border-color: #714b67; box-shadow: 0 0 0 2px rgba(113, 75, 103, 0.2); }
    }

    .chip-top {
      display: flex; align-items: center; justify-content: space-between;
      .cat-lbl { font-weight: 700; font-size: 0.88rem; color: #111827; }
      .grade-pill { background: #714b67; color: #ffffff; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    }

    .chip-bottom {
      display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem;
      .rem-weight { color: #374151; }
      .unit-cost { font-weight: 700; color: #059669; }
    }

    .weight-input-box {
      display: flex; align-items: center; border: 2px solid #714b67; border-radius: 10px; overflow: hidden; background: #ffffff;
    }

    .weight-field {
      flex: 1; height: 46px; border: none; padding: 0 1rem; font-size: 1.2rem; font-weight: 700; color: #111827; outline: none;
    }

    .unit-tag { padding: 0 1rem; font-weight: 700; color: #714b67; font-size: 1rem; }

    .preset-buttons {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem;
      button { height: 36px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer; }
    }

    .cost-summary-pill {
      background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.55rem 0.75rem; display: flex; justify-content: space-between; font-size: 0.85rem;
      .lbl { color: #065f46; } .val { font-weight: 700; color: #047857; }
    }

    .submit-action-btn {
      height: 50px; background: #714b67; color: #ffffff; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; cursor: pointer;
      &:disabled { opacity: 0.5; }
    }

    .qr-label-printable-card {
      background: #ffffff; border: 2px solid #111827; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .label-header {
      display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 0.5rem;
      .brand-title { font-weight: 900; font-size: 0.75rem; letter-spacing: 0.08em; color: #111827; }
      .sealed-tag { background: #111827; color: #ffffff; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
    }

    .qr-matrix-box { display: flex; justify-content: center; padding: 0.5rem 0; }

    .fake-qr-code {
      background: #f3f4f6; border: 2px dashed #374151; border-radius: 10px; padding: 1rem 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
      .qr-icon { font-size: 2.2rem; } .qr-code-text { font-family: monospace; font-size: 0.78rem; font-weight: 700; color: #111827; }
    }

    .label-meta-grid { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; }
    .meta-row {
      display: flex; justify-content: space-between;
      .lbl { color: #6b7280; } .val { font-weight: 700; color: #111827; &.code { font-family: monospace; } &.highlight { color: #714b67; } }
    }

    .label-actions {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.25rem;
      button { height: 44px; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; }
      .print-btn { background: #111827; color: #ffffff; }
      .next-btn { background: #714b67; color: #ffffff; }
    }

    .lite-table {
      width: 100%; border-collapse: collapse; font-size: 0.85rem;
      th { text-align: left; padding: 0.65rem 0.75rem; background: #f9fafb; color: #4b5563; font-weight: 700; border-bottom: 1px solid #e5e7eb; }
      td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
    }

    .font-mono { font-family: monospace; }
    .font-bold { font-weight: 700; }
    .text-green-600 { color: #059669; }
    .text-purple { color: #7e22ce; }

    .grade-pill { background: #714b67; color: #ffffff; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; }

    .units-card-stack { display: flex; flex-direction: column; gap: 0.85rem; }
    .unit-history-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .card-top { display: flex; align-items: center; justify-content: space-between; .unit-code-title { font-family: monospace; font-weight: 800; font-size: 0.9rem; color: #111827; } }
    .sealed-status-badge { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
    .unit-cat-grade { font-size: 0.82rem; color: #374151; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; background: #ffffff; border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 8px; }
    .metric-cell { display: flex; flex-direction: column; align-items: center; .m-lbl { font-size: 0.68rem; color: #6b7280; text-transform: uppercase; } .m-val { font-size: 0.8rem; font-weight: 700; color: #111827; } }
    .card-bottom { display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; .qr-text { font-family: monospace; color: #714b67; font-weight: 600; } .date-lbl { color: #9ca3af; } }
    .status-alert { padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; &.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; } &.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; } }
    .dismiss-btn { background: transparent; border: none; font-weight: 700; cursor: pointer; }
  `],
})
export class MobileRepackComponent implements OnInit {
  protected readonly activeTab = signal<'create' | 'history'>('create');
  protected readonly availableStock = signal<AvailableStockRow[]>([]);
  protected readonly sealedUnits = signal<SealedUnitRow[]>([]);

  selectedStockId = '';
  selectedStockItem: AvailableStockRow | null = null;
  targetWeight: number | null = null;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly statusMessage = signal<string>('');
  protected readonly statusType = signal<'success' | 'error'>('success');

  // Sealed Label State Signals
  protected readonly sealedQrLabel = signal<boolean>(false);
  protected readonly sealedUnitCode = signal<string>('');
  protected readonly sealedQrCode = signal<string>('');
  protected readonly sealedCategoryName = signal<string>('');
  protected readonly sealedGradeName = signal<string>('');
  protected readonly sealedWeight = signal<number>(0);
  protected readonly sealedTotalCost = signal<number>(0);
  protected readonly resumedSessionId = signal<string>('');

  readonly isDesktopView = signal<boolean>(window.innerWidth >= 1024);

  readonly estimatedUnitCost = computed(() => {
    if (!this.selectedStockItem || !this.targetWeight || this.targetWeight <= 0) return null;
    return this.targetWeight * (this.selectedStockItem.costPerUnit || 0);
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
  ) {}

  @HostListener('window:resize')
  onResize(): void {
    this.isDesktopView.set(window.innerWidth >= 1024);
  }

  ngOnInit(): void {
    this.fetchAvailableStock();
    this.fetchSealedUnits();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const sessionId = params.get('resume') || '';
      this.resumedSessionId.set(sessionId);
      if (sessionId) {
        this.statusType.set('success');
        this.statusMessage.set('Resumed repack session. Your next unit will be recorded in this session.');
      }
    });
  }

  addPresetWeight(amount: number): void {
    this.targetWeight = (this.targetWeight || 0) + amount;
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  selectStockItem(item: AvailableStockRow): void {
    this.selectedStockId = item.id;
    this.selectedStockItem = item;
  }

  fetchAvailableStock(): void {
    this.http.get<AvailableStockRow[]>(`${API_BASE_URL}/repack/available-stock`).subscribe({
      next: (data) => this.availableStock.set(data || []),
      error: () => {},
    });
  }

  fetchSealedUnits(): void {
    this.http.get<SealedUnitRow[]>(`${API_BASE_URL}/repack/units/sealed`).subscribe({
      next: (data) => this.sealedUnits.set(data || []),
      error: () => {},
    });
  }

  createAndSealRepackUnit(): void {
    const stock = this.selectedStockItem;
    if (!stock || !this.targetWeight || this.targetWeight <= 0) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');
    this.sealedQrLabel.set(false);

    const draftPayload = {
      ...(this.resumedSessionId() ? { repackSessionId: this.resumedSessionId() } : {}),
      categoryId: stock.categoryId,
      gradeId: stock.gradeId,
      measurementType: stock.measurementType || 'WEIGHT',
      targetAmount: this.targetWeight,
      manualAllocations: [
        {
          gradingOutputId: stock.id,
          amountUsed: this.targetWeight,
        },
      ],
    };

    this.http.post<any>(`${API_BASE_URL}/repack/units/manual`, draftPayload).subscribe({
      next: (draftRes) => {
        const unitId = draftRes?.repackUnit?.id;
        if (!unitId) {
          this.isSubmitting.set(false);
          this.statusType.set('error');
          this.statusMessage.set('Failed to initialize draft repack unit');
          return;
        }

        this.http.patch<any>(`${API_BASE_URL}/repack/units/${unitId}/seal`, {}).subscribe({
          next: (sealedRes) => {
            this.isSubmitting.set(false);
            this.statusType.set('success');
            this.statusMessage.set('Repack Unit Sealed & QR Code Generated!');

            const unit = sealedRes || {};
            this.sealedUnitCode.set(unit.unitCode || 'PK-001');
            this.sealedQrCode.set(unit.qrLabel?.qrCode || (`REPACK:${unit.unitCode}`));
            this.sealedCategoryName.set(unit.category?.name || stock.categoryName);
            this.sealedGradeName.set(unit.grade?.name || stock.gradeName);
            this.sealedWeight.set(unit.weightKg || this.targetWeight || 0);
            this.sealedTotalCost.set(unit.totalCost || (this.targetWeight! * stock.costPerUnit));
            this.sealedQrLabel.set(true);

            this.fetchAvailableStock();
            this.fetchSealedUnits();
          },
          error: (err) => {
            this.isSubmitting.set(false);
            this.statusType.set('error');
            this.statusMessage.set(err?.error?.message || 'Failed to seal repack unit');
          },
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to create repack draft');
      },
    });
  }

  printLabel(): void {
    window.print();
  }

  resetForm(): void {
    this.selectedStockId = '';
    this.selectedStockItem = null;
    this.targetWeight = null;
    this.sealedQrLabel.set(false);
    this.statusMessage.set('');
  }
}
