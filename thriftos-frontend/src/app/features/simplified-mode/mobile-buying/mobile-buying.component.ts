import { Component, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../core/config/api.config';
import { OfflineDraftService } from '../../../core/operations/offline-draft.service';

interface RawCategory {
  id: string;
  name: string;
  code?: string;
}

interface Vendor {
  id: string;
  name: string;
  vendorType?: string;
}

interface RagBuyingRow {
  id: string;
  ragCode: string;
  weightKg: number;
  allocatedCost: number;
  status: 'NOT_STARTED' | 'IN_SORTING' | 'SORTED';
  createdAt: string;
  rawCategory?: { name: string };
  container?: { containerNumber: string };
  notes?: string;
}

@Component({
  selector: 'app-mobile-buying',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lite-buying-workstation">
      <!-- Top Mobile View Toggle Tabs (Mobile/Tablet Only) -->
      <div class="view-toggle-tabs mobile-only">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'buying'"
          (click)="activeTab.set('buying')"
        >
          <span>➕ Record Intake</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'history'"
          (click)="activeTab.set('history')"
        >
          <span>📋 Buyings History ({{ buyingsHistory().length }})</span>
        </button>
      </div>

      <!-- RESPONSIVE DUAL-COLUMN WORKSTATION (DESKTOP SPLIT / MOBILE STACKED) -->
      <div class="workstation-grid">
        <!-- ========================================================= -->
        <!-- COLUMN 1: RAW BALE INTAKE FORM -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'buying' || isDesktopView()" class="buying-card">
          <div class="card-header">
            <h3>🛍️ Raw Bale Intake Workstation</h3>
            <span class="badge-tag">Auto PO Generation</span>
          </div>

          <!-- Status Alert -->
          <div *ngIf="statusMessage()" role="status" aria-live="polite" class="status-alert" [class.success]="statusType() === 'success'" [class.error]="statusType() === 'error'">
            <span>{{ statusMessage() }}</span>
            <button type="button" class="dismiss-btn" (click)="statusMessage.set('')">✕</button>
          </div>

          <!-- 1. Raw Category Selection Chips -->
          <div class="input-group">
            <label>1. Select Raw Category</label>
            <div *ngIf="rawCategories().length === 0" class="loading-placeholder">
              <span>Loading Categories...</span>
            </div>

            <div class="category-chips-grid">
              <button
                type="button"
                *ngFor="let cat of rawCategories(); trackBy: trackById"
                class="category-chip"
                [class.selected]="selectedCategoryId === cat.id"
                (click)="selectedCategoryId = cat.id"
              >
                <span class="cat-name">{{ cat.name }}</span>
              </button>
            </div>
          </div>

          <!-- 2. Combo Net Weight Input & Presets -->
          <div class="input-group">
            <label>2. Total Net Weight (KG)</label>
            <div class="weight-input-container">
              <input
                type="number"
                step="0.1"
                [(ngModel)]="weightKg"
                placeholder="0.0"
                class="weight-field"
              />
              <span class="unit-tag">KG</span>
            </div>
            <!-- Quick Preset Weight Buttons -->
            <div class="preset-buttons">
              <button type="button" (click)="addPresetWeight(50)">+50</button>
              <button type="button" (click)="addPresetWeight(100)">+100</button>
              <button type="button" (click)="addPresetWeight(250)">+250</button>
              <button type="button" (click)="addPresetWeight(500)">+500</button>
            </div>
          </div>

          <!-- 3. Total Purchase Cost Input -->
          <div class="input-group">
            <label>3. Total Cost ($)</label>
            <div class="cost-input-container">
              <span class="curr-tag">$</span>
              <input
                type="number"
                step="0.01"
                [(ngModel)]="allocatedCost"
                placeholder="0.00"
                class="cost-field"
              />
            </div>
          </div>

          <!-- Live Unit Cost Preview -->
          <div *ngIf="unitCostPerKg()" class="unit-cost-preview">
            <span>Calculated Unit Cost:</span>
            <strong>{{ unitCostPerKg() | currency:'USD':'symbol':'1.2-2' }} / KG</strong>
          </div>

          <!-- 4. Vendor Selection -->
          <div class="input-group">
            <label>4. Supplier / Vendor (Optional)</label>
            <select [(ngModel)]="selectedVendorId" class="vendor-select">
              <option value="">-- Direct Supplier / Cash Purchase --</option>
              <option *ngFor="let v of vendors(); trackBy: trackById" [value]="v.id">
                {{ v.name }}
              </option>
            </select>
          </div>

          <!-- Action Submit Button -->
          <button
            type="button"
            class="submit-buy-btn"
            [disabled]="!selectedCategoryId || !weightKg || isSubmitting()"
            (click)="onSubmitIntake()"
          >
            <span *ngIf="!isSubmitting()">⚡ Record Purchase & Auto-PO</span>
            <span *ngIf="isSubmitting()">Saving Intake...</span>
          </button>
        </div>

        <!-- ========================================================= -->
        <!-- COLUMN 2: RECENT BUYINGS & STATUS LIST -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'history' || isDesktopView()" class="history-card">
          <div class="card-header">
            <h3>📋 Recent Buyings History</h3>
            <button type="button" class="refresh-btn" (click)="fetchBuyingsHistory()">🔄 Refresh</button>
          </div>

          <div *ngIf="buyingsHistory().length === 0" class="empty-history-box">
            <p>No recent purchases recorded yet.</p>
          </div>

          <!-- Desktop Table Layout -->
          <div *ngIf="buyingsHistory().length > 0" class="history-table-container desktop-only">
            <table class="lite-table">
              <thead>
                <tr>
                  <th>Bale Code</th>
                  <th>Raw Category</th>
                  <th>Net Weight</th>
                  <th>Total Cost</th>
                  <th>Unit Cost</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of buyingsHistory(); trackBy: trackById">
                  <td class="font-mono font-bold">{{ item.ragCode }}</td>
                  <td>{{ item.rawCategory?.name || 'Raw Bale' }}</td>
                  <td>{{ item.weightKg }} KG</td>
                  <td class="font-bold">{{ item.allocatedCost | currency:'USD':'symbol':'1.2-2' }}</td>
                  <td class="text-green-600 font-semibold">
                    {{ (item.weightKg ? item.allocatedCost / item.weightKg : 0) | currency:'USD':'symbol':'1.2-2' }}/KG
                  </td>
                  <td>
                    <span
                      class="status-pill"
                      [class.not-started]="item.status === 'NOT_STARTED'"
                      [class.in-sorting]="item.status === 'IN_SORTING'"
                      [class.sorted]="item.status === 'SORTED'"
                    >
                      <span class="dot"></span>
                      {{ item.status === 'NOT_STARTED' ? 'Ready to Sort' : item.status === 'IN_SORTING' ? 'In Sorting' : 'Sorted' }}
                    </span>
                  </td>
                  <td>
                    <button
                      *ngIf="item.status === 'NOT_STARTED'"
                      type="button"
                      class="start-sort-shortcut-btn"
                      (click)="goToSorting(item.ragCode)"
                    >
                      ⚡ Start Sort
                    </button>
                    <span *ngIf="item.status !== 'NOT_STARTED'" class="text-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards Stack Layout -->
          <div *ngIf="buyingsHistory().length > 0" class="buyings-card-stack mobile-only">
            <div *ngFor="let item of buyingsHistory(); trackBy: trackById" class="buying-history-card">
              <div class="card-top">
                <span class="bale-code">{{ item.ragCode }}</span>
                <span
                  class="status-pill"
                  [class.not-started]="item.status === 'NOT_STARTED'"
                  [class.in-sorting]="item.status === 'IN_SORTING'"
                  [class.sorted]="item.status === 'SORTED'"
                >
                  <span class="dot"></span>
                  {{ item.status === 'NOT_STARTED' ? 'Ready to Sort' : item.status === 'IN_SORTING' ? 'In Sorting' : 'Sorted' }}
                </span>
              </div>

              <div class="card-body-info">
                <span class="category-name">{{ item.rawCategory?.name || 'Raw Bale' }}</span>
                <span class="creation-time">{{ item.createdAt | date:'short' }}</span>
              </div>

              <div class="metrics-grid">
                <div class="metric-cell">
                  <span class="lbl">Weight</span>
                  <span class="val">{{ item.weightKg }} KG</span>
                </div>
                <div class="metric-cell">
                  <span class="lbl">Total Cost</span>
                  <span class="val">{{ item.allocatedCost | currency:'USD':'symbol':'1.2-2' }}</span>
                </div>
                <div class="metric-cell">
                  <span class="lbl">Unit Cost</span>
                  <span class="val text-green">{{ (item.weightKg ? item.allocatedCost / item.weightKg : 0) | currency:'USD':'symbol':'1.2-2' }}/KG</span>
                </div>
              </div>

              <div *ngIf="item.status === 'NOT_STARTED'" class="card-action-bar">
                <button type="button" class="start-sort-btn" (click)="goToSorting(item.ragCode)">
                  ⚡ Start Sort Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lite-buying-workstation {
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
      &.active {
        background: #ffffff;
        color: #714b67;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
    }

    .workstation-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    @media (min-width: 1024px) {
      .workstation-grid {
        grid-template-columns: 460px 1fr;
      }
      .mobile-only { display: none !important; }
    }

    @media (max-width: 1023px) {
      .desktop-only { display: none !important; }
    }

    .buying-card, .history-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
    }

    .badge-tag {
      background: rgba(113, 75, 103, 0.1);
      color: #714b67;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 6px;
      letter-spacing: 0.03em;
    }

    .refresh-btn {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 5px 12px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #374151;
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: #e5e7eb; }
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;

      label { font-size: 0.82rem; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; }
    }

    .category-chips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
      gap: 0.5rem;
    }

    .category-chip {
      height: 42px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 9px;
      font-size: 0.85rem;
      font-weight: 700;
      color: #374151;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
      }

      &.selected {
        background: linear-gradient(135deg, #714b67 0%, #54344d 100%);
        color: #ffffff;
        border-color: #714b67;
        box-shadow: 0 4px 12px rgba(113, 75, 103, 0.25);
      }
    }

    .weight-input-container, .cost-input-container {
      display: flex;
      align-items: center;
      border: 2px solid #714b67;
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(113, 75, 103, 0.08);
    }

    .weight-field, .cost-field {
      flex: 1;
      height: 48px;
      border: none;
      padding: 0 0.85rem;
      font-size: 1.25rem;
      font-weight: 800;
      color: #111827;
      outline: none;
    }

    .unit-tag, .curr-tag {
      padding: 0 0.85rem;
      font-weight: 800;
      color: #714b67;
      font-size: 1.05rem;
    }

    .preset-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.4rem;

      button {
        height: 38px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        border-radius: 7px;
        font-weight: 700;
        font-size: 0.82rem;
        color: #374151;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: rgba(113, 75, 103, 0.08);
          border-color: #714b67;
          color: #714b67;
        }
      }
    }

    .unit-cost-preview {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 1px solid #6ee7b7;
      border-radius: 10px;
      padding: 0.65rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.88rem;
      color: #065f46;
      font-weight: 600;
    }

    .vendor-select {
      height: 46px;
      border: 1px solid #d1d5db;
      border-radius: 9px;
      padding: 0 0.85rem;
      font-size: 0.88rem;
      font-weight: 600;
      background: #ffffff;
      color: #111827;
    }

    .submit-buy-btn {
      height: 52px;
      background: linear-gradient(135deg, #714b67 0%, #54344d 100%);
      color: #ffffff;
      border: none;
      border-radius: 11px;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(113, 75, 103, 0.3);
      transition: transform 0.15s, box-shadow 0.15s;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(113, 75, 103, 0.4);
      }

      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .lite-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        text-align: left;
        padding: 0.65rem 0.75rem;
        background: #f9fafb;
        color: #4b5563;
        font-weight: 700;
        border-bottom: 1px solid #e5e7eb;
      }

      td {
        padding: 0.65rem 0.75rem;
        border-bottom: 1px solid #e5e7eb;
      }
    }

    .font-mono { font-family: monospace; }
    .font-bold { font-weight: 700; }
    .text-green-600 { color: #059669; }
    .text-muted { color: #9ca3af; }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;

      .dot { width: 6px; height: 6px; border-radius: 50%; }

      &.not-started {
        background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;
        .dot { background: #10b981; }
      }

      &.in-sorting {
        background: #fffbe6; color: #d97706; border: 1px solid #fef08a;
        .dot { background: #f59e0b; }
      }

      &.sorted {
        background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff;
        .dot { background: #a855f7; }
      }
    }

    .start-sort-shortcut-btn {
      background: #714b67;
      color: #ffffff;
      border: none;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .buyings-card-stack {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .buying-history-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      .bale-code { font-family: monospace; font-weight: 800; font-size: 0.95rem; }
    }

    .card-body-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #4b5563;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.4rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      padding: 0.5rem;
      border-radius: 6px;
    }

    .metric-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      .lbl { font-size: 0.68rem; color: #6b7280; text-transform: uppercase; }
      .val { font-size: 0.82rem; font-weight: 700; color: #111827; }
      .text-green { color: #059669; }
    }

    .start-sort-btn {
      width: 100%;
      height: 38px;
      background: #714b67;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
    }

    .status-alert {
      padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between;
      &.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
      &.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    }

    .dismiss-btn { background: transparent; border: none; font-weight: 700; cursor: pointer; }
    .empty-history-box { text-align: center; padding: 1.5rem; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; font-size: 0.82rem; color: #6b7280; }
  `],
})
export class MobileBuyingComponent implements OnInit {
  protected readonly activeTab = signal<'buying' | 'history'>('buying');
  protected readonly rawCategories = signal<RawCategory[]>([]);
  protected readonly vendors = signal<Vendor[]>([]);
  protected readonly buyingsHistory = signal<RagBuyingRow[]>([]);

  selectedCategoryId = '';
  selectedVendorId = '';
  weightKg: number | null = null;
  allocatedCost: number | null = null;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly statusMessage = signal<string>('');
  protected readonly statusType = signal<'success' | 'error'>('success');

  readonly isDesktopView = signal<boolean>(window.innerWidth >= 1024);

  readonly unitCostPerKg = computed(() => {
    if (!this.weightKg || !this.allocatedCost || this.weightKg <= 0) return null;
    return this.allocatedCost / this.weightKg;
  });

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly offlineDrafts: OfflineDraftService,
  ) {}

  @HostListener('window:resize')
  onResize(): void {
    this.isDesktopView.set(window.innerWidth >= 1024);
  }

  ngOnInit(): void {
    this.fetchMasterData();
    this.fetchBuyingsHistory();
  }

  addPresetWeight(amount: number): void {
    this.weightKg = (this.weightKg || 0) + amount;
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  fetchMasterData(): void {
    this.http.get<any>(`${API_BASE_URL}/tenant/raw-categories`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.rawCategories.set(list);
        if (list.length > 0 && !this.selectedCategoryId) {
          this.selectedCategoryId = list[0].id;
        }
      },
      error: () => {},
    });

    this.http.get<any>(`${API_BASE_URL}/procurement/vendors`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.vendors.set(list);
      },
      error: () => {},
    });
  }

  fetchBuyingsHistory(): void {
    this.http.get<any>(`${API_BASE_URL}/procurement/rags?limit=50`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.buyingsHistory.set(list);
      },
      error: () => {},
    });
  }

  onSubmitIntake(): void {
    if (!this.selectedCategoryId || !this.weightKg || this.weightKg <= 0) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const payload = {
      rawCategoryId: this.selectedCategoryId,
      weightKg: this.weightKg,
      allocatedCost: this.allocatedCost || 0,
      ragBaleType: 'BALE',
      vendorId: this.selectedVendorId || undefined,
    };

    this.http.post<any>(`${API_BASE_URL}/procurement/rags`, payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.statusType.set('success');
        this.statusMessage.set(`Bale Purchase recorded successfully! Auto PO: ${res.autoPoNumber || 'CREATED'}`);

        this.weightKg = null;
        this.allocatedCost = null;
        this.fetchBuyingsHistory();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err?.status === 0 && this.offlineDrafts.canQueueOffline()) {
          this.offlineDrafts.enqueue('RAG_INTAKE', payload);
          this.statusType.set('success');
          this.statusMessage.set('Connection lost. Intake saved locally and queued for review/sync.');
          this.weightKg = null;
          this.allocatedCost = null;
          return;
        }
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to record raw bale intake.');
      },
    });
  }

  goToSorting(baleCode: string): void {
    this.router.navigate(['/app/lite/sorting'], { queryParams: { baleCode } });
  }
}
