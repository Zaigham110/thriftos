import { Component, signal, computed, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../core/config/api.config';
import { TenantService } from '../../../core/tenant/tenant.service';

interface InventoryItemRow {
  id: string;
  weightKg: number;
  pcsCount: number;
  avgCost: number;
  status: string;
  unitCode?: string;
  qrCode?: string;
  createdAt: string;
  category?: { name: string };
  grade?: { name: string };
  warehouse?: { name: string; code?: string };
  repackUnit?: {
    unitCode: string;
    qrLabel?: { qrCode: string };
    category?: { name: string };
    grade?: { name: string };
  };
}

interface InventoryTraceability {
  repackUnit: { unitCode: string; status: string };
  sourceAllocations: Array<{
    amountUsed: number;
    gradingOutput?: {
      grade?: { name: string };
      categoryOutput?: {
        category?: { name: string };
        sortSession?: { rag?: { ragCode: string; container?: { containerNumber: string; purchaseOrder?: { poNumber: string; vendor?: { name: string } } } } };
      };
    };
  }>;
}

@Component({
  selector: 'app-mobile-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mobile-inventory-view">
      <!-- Top Search & Scanner Box -->
      <div class="scanner-search-card">
        <div class="card-title">
          <span class="icon">🔍</span>
          <h3>QR Code & Stock Scanner</h3>
        </div>

        <div class="search-input-group">
          <div class="input-with-icon">
            <span class="search-ico">📱</span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (keyup.enter)="searchOrScan()"
              placeholder="Scan QR Code or Enter Unit SKU (e.g. PK-2026-001)..."
              class="scan-field"
            />
          </div>
          <button type="button" class="scan-btn" (click)="searchOrScan()">Lookup SKU</button>
          @if (canUseCamera()) {
            <button type="button" class="camera-scan-btn" (click)="startCameraScan()">Use camera</button>
          }
        </div>
        @if (cameraScanning()) {
          <div class="camera-preview">
            <video #cameraPreview autoplay muted playsinline></video>
            <div><span>Point the camera at a sealed QR label</span><button type="button" (click)="stopCameraScan()">Cancel</button></div>
          </div>
        }
      </div>

      <!-- STATUS ALERT -->
      <div *ngIf="statusMessage()" role="status" aria-live="polite" class="status-alert" [class.success]="statusType() === 'success'" [class.error]="statusType() === 'error'">
        <span>{{ statusMessage() }}</span>
        <button type="button" class="dismiss-btn" (click)="statusMessage.set('')">✕</button>
      </div>

      <!-- ========================================================= -->
      <!-- TRACEABILITY & ORIGIN AUDIT CARD (WHEN ITEM SCANNED) -->
      <!-- ========================================================= -->
      <div *ngIf="scannedItem() as item" class="scanned-result-card">
        <div class="scanned-header">
          <div class="title-left">
            <span class="badge-sku">{{ item.unitCode || item.repackUnit?.unitCode || item.id }}</span>
            <span class="status-pill" [class.avail]="item.status === 'AVAILABLE'" [class.sold]="item.status === 'SOLD'">
              {{ item.status }}
            </span>
          </div>
          <button type="button" class="clear-res-btn" (click)="closeInspection()">✕ Close</button>
        </div>

        <!-- Product Badges -->
        <div class="product-badges-row">
          <div class="p-badge cat">
            <span class="lbl">Category</span>
            <span class="val">{{ item.category?.name || item.repackUnit?.category?.name || 'Textiles' }}</span>
          </div>
          <div class="p-badge grade">
            <span class="lbl">Quality Grade</span>
            <span class="val">{{ item.grade?.name || item.repackUnit?.grade?.name || 'Grade A' }}</span>
          </div>
        </div>

        <!-- Financial & Weight Metrics Grid -->
        <div class="metrics-grid-4">
          <div class="m-cell">
            <span class="m-lbl">Net Weight</span>
            <span class="m-val">{{ item.weightKg }} KG</span>
          </div>
          <div class="m-cell">
            <span class="m-lbl">Pieces</span>
            <span class="m-val">{{ item.pcsCount || 0 }} PCS</span>
          </div>
          <div class="m-cell">
            <span class="m-lbl">Cost / KG</span>
            <span class="m-val">{{ (item.avgCost || 0) | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
          <div class="m-cell highlight">
            <span class="m-lbl">Total Value</span>
            <span class="m-val">{{ ((item.weightKg || 0) * (item.avgCost || 0)) | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
        </div>

        <!-- Traceability Origin Chain -->
        <div class="trace-chain-box">
          <div class="chain-title">
            <span>🔗 Audit Traceability Chain</span>
          </div>

          <div class="chain-nodes">
            <div class="node-item">
              <span class="node-icon">📦</span>
              <div class="node-details">
                <span class="n-title">Repack Unit Code</span>
                <span class="n-val font-mono">{{ item.repackUnit?.unitCode || item.unitCode || 'PK-001' }}</span>
              </div>
            </div>

            <div class="node-item">
              <span class="node-icon">📱</span>
              <div class="node-details">
                <span class="n-title">QR Code Payload</span>
                <span class="n-val font-mono">{{ item.qrCode || item.repackUnit?.qrLabel?.qrCode || ('REPACK:' + (item.unitCode || 'PK-001')) }}</span>
              </div>
            </div>

            <div class="node-item">
              <span class="node-icon">🏢</span>
              <div class="node-details">
                <span class="n-title">Warehouse Bin Location</span>
                <span class="n-val">{{ item.warehouse?.name || 'Main Warehouse Storage' }}</span>
              </div>
            </div>
          </div>

          @if (traceability(); as trace) {
            <div class="source-lineage">
              <span class="n-title">Verified source identity</span>
              @for (source of trace.sourceAllocations; track $index) {
                <span class="lineage-value">
                  {{ source.gradingOutput?.categoryOutput?.sortSession?.rag?.container?.purchaseOrder?.vendor?.name || 'Direct intake' }}
                  · {{ source.gradingOutput?.categoryOutput?.sortSession?.rag?.container?.purchaseOrder?.poNumber || 'No PO' }}
                  · bale {{ source.gradingOutput?.categoryOutput?.sortSession?.rag?.ragCode || 'Unknown' }}
                  · {{ source.amountUsed }} kg
                </span>
              }
              @if (!trace.sourceAllocations.length) {
                <span class="lineage-value muted">No source allocation was returned for this item.</span>
              }
            </div>
          } @else if (traceLoading()) {
            <span class="lineage-value muted">Loading verified lineage…</span>
          }
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- GLOBAL INVENTORY EXPLORER LIST -->
      <!-- ========================================================= -->
      <div class="inventory-list-card">
        <div class="list-header">
          <h3>📦 Real-Time Inventory Stock</h3>
          <div class="filter-tabs">
            <button type="button" [class.active]="selectedStatusFilter() === 'ALL'" (click)="setStatusFilter('ALL')">All</button>
            <button type="button" [class.active]="selectedStatusFilter() === 'AVAILABLE'" (click)="setStatusFilter('AVAILABLE')">Available</button>
            <button type="button" [class.active]="selectedStatusFilter() === 'SOLD'" (click)="setStatusFilter('SOLD')">Sold</button>
          </div>
        </div>

        <div *ngIf="filteredItems().length === 0" class="empty-list-box">
          <p>No inventory items match the selected filter.</p>
        </div>

        <div class="stock-cards-stack">
          <div *ngFor="let item of filteredItems(); trackBy: trackById" class="stock-row-card" (click)="inspectItem(item)">
            <div class="card-left">
              <span class="sku-title">{{ item.repackUnit?.unitCode || item.unitCode || item.id.slice(-8) }}</span>
              <span class="cat-grade">{{ item.category?.name || 'Category' }} • <strong>{{ item.grade?.name || 'Grade' }}</strong></span>
            </div>
            <div class="card-right">
              <span class="w-val">{{ item.weightKg }} KG</span>
              <span class="status-tag" [class.avail]="item.status === 'AVAILABLE'" [class.sold]="item.status === 'SOLD'">
                {{ item.status }}
              </span>
            </div>
          </div>
        </div>

        <button *ngIf="hasMoreInventory()" type="button" class="load-more-btn" [disabled]="loadingMore()" (click)="loadMoreInventory()">
          {{ loadingMore() ? 'Loading more stock…' : 'Load more stock' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .mobile-inventory-view {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .scanner-search-card, .scanned-result-card, .inventory-list-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
      .icon { font-size: 1.2rem; }
    }

    .search-input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .camera-scan-btn { min-height: 44px; border: 1px solid #714b67; border-radius: 9px; background: #fff; color: #714b67; font-weight: 750; }
    .camera-preview { overflow: hidden; border: 1px solid #d8c6d3; border-radius: 10px; background: #241c22; color: #fff; }
    .camera-preview video { display: block; width: 100%; max-height: 280px; object-fit: cover; }
    .camera-preview div { display: flex; align-items: center; justify-content: space-between; gap: .6rem; padding: .55rem .7rem; font-size: .75rem; }
    .camera-preview button { min-height: 36px; border: 1px solid rgba(255,255,255,.5); border-radius: 6px; background: transparent; color: #fff; font-weight: 700; }

    .input-with-icon {
      display: flex;
      align-items: center;
      border: 2px solid #714b67;
      border-radius: 10px;
      padding: 0 0.75rem;
      background: #ffffff;
    }

    .search-ico { font-size: 1.2rem; }

    .scan-field {
      flex: 1;
      height: 48px;
      border: none;
      outline: none;
      padding: 0 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .scan-btn {
      height: 44px;
      background: #714b67;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
    }

    .status-alert {
      padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between;
      &.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
      &.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    }

    .dismiss-btn { background: transparent; border: none; font-weight: 700; cursor: pointer; opacity: 0.7; }

    .scanned-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.5rem;
    }

    .title-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .badge-sku {
      font-family: monospace;
      font-weight: 800;
      font-size: 1rem;
      color: #111827;
    }

    .status-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;

      &.avail { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
      &.sold { background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; }
    }

    .clear-res-btn {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
    }

    .product-badges-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .p-badge {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      display: flex;
      flex-direction: column;

      .lbl { font-size: 0.68rem; color: #6b7280; text-transform: uppercase; }
      .val { font-size: 0.88rem; font-weight: 700; color: #111827; }

      &.grade .val { color: #714b67; }
    }

    .metrics-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.4rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 0.5rem;
      border-radius: 8px;
    }

    .m-cell {
      display: flex;
      flex-direction: column;
      align-items: center;

      .m-lbl { font-size: 0.65rem; color: #6b7280; text-transform: uppercase; }
      .m-val { font-size: 0.8rem; font-weight: 700; color: #111827; }

      &.highlight .m-val { color: #059669; }
    }

    .trace-chain-box {
      background: #fdf4ff;
      border: 1px solid #f5d0fe;
      border-radius: 8px;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .chain-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #714b67;
    }

    .chain-nodes {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .node-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
    }

    .node-icon { font-size: 1rem; }

    .node-details {
      display: flex;
      flex-direction: column;

      .n-title { font-size: 0.68rem; color: #6b7280; }
      .n-val { font-size: 0.8rem; font-weight: 700; color: #111827; }
      .font-mono { font-family: monospace; }
    }

    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #111827; }
    }

    .filter-tabs {
      display: flex;
      gap: 0.25rem;
      background: #f3f4f6;
      padding: 2px;
      border-radius: 6px;

      button {
        border: none;
        background: transparent;
        border-radius: 4px;
        padding: 3px 8px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #4b5563;
        cursor: pointer;

        &.active {
          background: #ffffff;
          color: #714b67;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
      }
    }

    .empty-list-box {
      text-align: center; padding: 1.5rem; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; font-size: 0.82rem; color: #6b7280;
    }

    .stock-cards-stack {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .load-more-btn {
      width: 100%; min-height: 48px; margin-top: .75rem; border: 1px solid #d1d5db; border-radius: 8px;
      background: #fff; color: #714b67; font-weight: 700; cursor: pointer;
      &:disabled { opacity: .65; cursor: wait; }
    }

    .stock-row-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: background 0.15s;

      &:hover { background: #fdf4ff; border-color: #714b67; }
    }

    .card-left {
      display: flex;
      flex-direction: column;

      .sku-title { font-family: monospace; font-weight: 800; font-size: 0.88rem; color: #111827; }
      .cat-grade { font-size: 0.78rem; color: #4b5563; }
    }

    .source-lineage { display: grid; gap: .3rem; padding-top: .85rem; border-top: 1px dashed #d1d5db; }
    .lineage-value { color: #374151; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .72rem; line-height: 1.45; }
    .lineage-value.muted { color: #6b7280; font-family: inherit; }

    .card-right {
      display: flex;
      align-items: center;
      gap: 0.6rem;

      .w-val { font-weight: 700; font-size: 0.85rem; color: #111827; }
      .status-tag {
        font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
        &.avail { background: #ecfdf5; color: #065f46; }
        &.sold { background: #f3f4f6; color: #4b5563; }
      }
    }
  `],
})
export class MobileInventoryComponent implements OnInit, OnDestroy {
  @ViewChild('cameraPreview') private cameraPreview?: ElementRef<HTMLVideoElement>;
  private readonly tenantService = inject(TenantService);
  protected readonly inventoryItems = signal<InventoryItemRow[]>([]);
  protected readonly scannedItem = signal<InventoryItemRow | null>(null);
  protected readonly traceability = signal<InventoryTraceability | null>(null);
  protected readonly traceLoading = signal(false);
  protected readonly cameraScanning = signal(false);
  protected readonly canUseCamera = computed(() => {
    const policy = this.tenantService.tenant()?.capturePolicy || 'ALL';
    return policy === 'ALL' || policy === 'CAMERA_SCAN';
  });
  private cameraStream: MediaStream | null = null;
  private cameraFrame: number | null = null;

  searchQuery = '';
  selectedStatusFilter = signal<'ALL' | 'AVAILABLE' | 'SOLD'>('ALL');

  protected readonly statusMessage = signal<string>('');
  protected readonly statusType = signal<'success' | 'error'>('success');
  protected readonly inventoryPage = signal(1);
  protected readonly inventoryTotalPages = signal(1);
  protected readonly loadingMore = signal(false);
  protected readonly hasMoreInventory = computed(() => this.inventoryPage() < this.inventoryTotalPages());

  readonly filteredItems = computed(() => {
    const list = this.inventoryItems();
    const filter = this.selectedStatusFilter();
    if (filter === 'ALL') return list;
    return list.filter((i) => i.status === filter);
  });

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.tenantService.loadTenant().subscribe({ error: () => undefined });
    this.fetchInventoryList();
  }

  ngOnDestroy(): void {
    this.stopCameraScan();
  }

  setStatusFilter(filter: 'ALL' | 'AVAILABLE' | 'SOLD'): void {
    this.selectedStatusFilter.set(filter);
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  fetchInventoryList(): void {
    this.inventoryPage.set(1);
    this.inventoryTotalPages.set(1);
    this.http.get<any>(`${API_BASE_URL}/inventory?page=1&limit=50`).subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : (res?.data || res?.items || []);
        this.inventoryItems.set(items);
        this.inventoryTotalPages.set(Number(res?.totalPages) || 1);
      },
      error: () => {},
    });
  }

  loadMoreInventory(): void {
    if (!this.hasMoreInventory() || this.loadingMore()) return;
    const nextPage = this.inventoryPage() + 1;
    this.loadingMore.set(true);
    this.http.get<any>(`${API_BASE_URL}/inventory?page=${nextPage}&limit=50`).subscribe({
      next: (res) => {
        const nextItems = Array.isArray(res) ? res : (res?.data || res?.items || []);
        const existingIds = new Set(this.inventoryItems().map((item) => item.id));
        this.inventoryItems.update((items) => [...items, ...nextItems.filter((item: InventoryItemRow) => !existingIds.has(item.id))]);
        this.inventoryPage.set(nextPage);
        this.inventoryTotalPages.set(Number(res?.totalPages) || nextPage);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
        this.statusType.set('error');
        this.statusMessage.set('Unable to load more stock. Please retry.');
      },
    });
  }

  searchOrScan(): void {
    const query = this.searchQuery.trim();
    if (!query) return;

    this.statusMessage.set('');

    // First try resolving via QR scanner endpoint
    this.http.get<any>(`${API_BASE_URL}/sales/scan/qr/${encodeURIComponent(query)}`).subscribe({
      next: (res) => {
        if (res && res.id) {
          this.openInspection(res);
          this.statusType.set('success');
          this.statusMessage.set(`Found item: ${res.repackUnit?.unitCode || res.id}`);
        } else {
          this.fallbackSearchInList(query);
        }
      },
      error: () => {
        this.fallbackSearchInList(query);
      },
    });
  }

  private fallbackSearchInList(query: string): void {
    const qLower = query.toLowerCase();
    const match = this.inventoryItems().find((i) => {
      const code = (i.repackUnit?.unitCode || i.unitCode || i.id).toLowerCase();
      const qr = (i.qrCode || i.repackUnit?.qrLabel?.qrCode || '').toLowerCase();
      return code.includes(qLower) || qr.includes(qLower);
    });

    if (match) {
      this.openInspection(match);
      this.statusType.set('success');
      this.statusMessage.set(`Matched SKU: ${match.repackUnit?.unitCode || match.id}`);
    } else {
      this.statusType.set('error');
      this.statusMessage.set(`No inventory SKU found matching "${query}"`);
    }
  }

  inspectItem(item: InventoryItemRow): void {
    this.openInspection(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async startCameraScan(): Promise<void> {
    if (!this.canUseCamera()) return;
    const BarcodeDetector = (window as any).BarcodeDetector;
    if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      this.statusType.set('error');
      this.statusMessage.set('Camera scanning is not supported by this browser. Use a hardware scanner or enter the unit code.');
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.cameraScanning.set(true);
      setTimeout(() => {
        const video = this.cameraPreview?.nativeElement;
        if (!video || !this.cameraStream) return;
        video.srcObject = this.cameraStream;
        void video.play().then(() => this.readCameraFrame(new BarcodeDetector({ formats: ['qr_code'] })));
      });
    } catch {
      this.statusType.set('error');
      this.statusMessage.set('Camera access was not granted. Use a hardware scanner or enter the unit code.');
      this.stopCameraScan();
    }
  }

  protected stopCameraScan(): void {
    if (this.cameraFrame !== null) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = null;
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    this.cameraScanning.set(false);
  }

  private async readCameraFrame(detector: { detect(video: HTMLVideoElement): Promise<Array<{ rawValue: string }>> }): Promise<void> {
    const video = this.cameraPreview?.nativeElement;
    if (!video || !this.cameraScanning()) return;
    try {
      const codes = await detector.detect(video);
      const value = codes[0]?.rawValue;
      if (value) {
        this.searchQuery = value;
        this.stopCameraScan();
        this.searchOrScan();
        return;
      }
    } catch {
      // A frame can be unavailable while the stream starts; keep scanning.
    }
    this.cameraFrame = requestAnimationFrame(() => void this.readCameraFrame(detector));
  }

  private openInspection(item: InventoryItemRow): void {
    this.scannedItem.set(item);
    this.traceability.set(null);
    this.traceLoading.set(true);
    this.http.get<InventoryTraceability>(`${API_BASE_URL}/inventory/${item.id}/traceability`).subscribe({
      next: (trace) => {
        this.traceability.set(trace);
        this.traceLoading.set(false);
      },
      error: () => this.traceLoading.set(false),
    });
  }

  protected closeInspection(): void {
    this.scannedItem.set(null);
    this.traceability.set(null);
    this.traceLoading.set(false);
  }
}
