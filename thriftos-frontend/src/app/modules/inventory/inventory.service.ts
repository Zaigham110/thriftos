/**
 * Inventory Service
 * Phase 6: Inventory Management
 * 
 * Backend APIs (AUTHORITATIVE):
 * Inventory Items:
 *   GET    /inventory/items           - List inventory items (paginated)
 *   GET    /inventory/items/:id       - Get single inventory item with ledger
 * 
 * Stock Movements (Ledger):
 *   GET    /inventory/movements       - List stock movements (paginated)
 *   GET    /inventory/movements/:id   - Get single movement
 * 
 * Warehouses:
 *   GET    /inventory/warehouses      - List warehouses for tenant
 * 
 * NOTE: Intake is triggered from Repack module (POST /inventory/intake)
 * This module is READ-ONLY for viewing inventory and ledger.
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, forkJoin, of, map } from 'rxjs';
import {
  InventoryItem,
  InventoryItemListResponse,
  InventoryItemFilters,
  StockMovement,
  StockMovementListResponse,
  StockMovementFilters,
  Warehouse,
  InventoryStats,
  InventoryStatus,
  InventoryLineage,
} from './inventory.models';
import { API_ENDPOINTS, API_BASE_URL } from '../../core/config/api.config';

const API_BASE = API_ENDPOINTS.inventory;

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Inventory list state
  private readonly _items = signal<InventoryItem[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _currentPage = signal(1);
  private readonly _totalPages = signal(1);

  // Current item state
  private readonly _currentItem = signal<InventoryItem | null>(null);
  private readonly _movements = signal<StockMovement[]>([]);

  // Reference data state
  private readonly _warehouses = signal<Warehouse[]>([]);

  // Dashboard stats
  private readonly _stats = signal<InventoryStats | null>(null);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly items = this._items.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly currentItem = this._currentItem.asReadonly();
  readonly movements = this._movements.asReadonly();
  readonly warehouses = this._warehouses.asReadonly();
  readonly stats = this._stats.asReadonly();

  // Computed: Total weight in KG
  readonly totalWeightKg = computed(() => {
    return this._items().reduce((sum, item) => {
      const weight = typeof item.weightKg === 'string' ? parseFloat(item.weightKg) : item.weightKg;
      return sum + (weight || 0);
    }, 0);
  });

  // Computed: Total pieces count
  readonly totalPcsCount = computed(() => {
    return this._items().reduce((sum, item) => sum + (item.pcsCount || 0), 0);
  });

  // Computed: Extract lineage from current item
  readonly currentLineage = computed<InventoryLineage | null>(() => {
    const item = this._currentItem();
    if (!item || !item.repackUnit) return null;

    return {
      containerId: item.containerId || item.repackUnit.containerId,
      ragId: item.ragId || item.repackUnit.ragId,
      sortSessionId: item.repackUnit.sortSessionId,
      gradeSessionId: item.repackUnit.gradeSessionId,
      repackUnitId: item.repackUnitId,
      repackUnitCode: item.repackUnit.unitCode,
    };
  });

  constructor(private readonly http: HttpClient) {}

  // =============================================================
  // INVENTORY ITEMS
  // =============================================================

  /**
   * Load inventory items list with filters
   */
  loadItems(filters?: InventoryItemFilters): Observable<InventoryItemListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters?.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters?.gradeId) params = params.set('gradeId', filters.gradeId);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<InventoryItemListResponse>(`${API_BASE}/items`, { params }).pipe(
      tap((response) => {
        this._items.set(response.data || []);
        this._totalCount.set(response.total || 0);
        this._currentPage.set(response.page || 1);
        const limit = response.limit || 20;
        this._totalPages.set(Math.ceil((response.total || 0) / limit));
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Load single inventory item with full details and movements
   */
  loadItem(id: string): Observable<InventoryItem> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<InventoryItem>(`${API_BASE}/items/${id}`).pipe(
      tap((item) => {
        // Validate lineage exists - MANDATORY
        if (!item.repackUnitId || !item.repackUnit) {
          throw new Error('Invalid inventory item: missing repack unit lineage');
        }
        this._currentItem.set(item);
        this._movements.set(item.stockMovements || []);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Clear current item state
   */
  clearCurrentItem(): void {
    this._currentItem.set(null);
    this._movements.set([]);
  }

  // =============================================================
  // STOCK MOVEMENTS (LEDGER)
  // =============================================================

  /**
   * Load stock movements for an inventory item
   */
  loadMovements(filters?: StockMovementFilters): Observable<StockMovementListResponse> {
    let params = new HttpParams();
    if (filters?.inventoryItemId) params = params.set('inventoryItemId', filters.inventoryItemId);
    if (filters?.movementType) params = params.set('movementType', filters.movementType);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<StockMovementListResponse>(`${API_BASE}/movements`, { params }).pipe(
      tap((response) => {
        this._movements.set(response.data || []);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  // =============================================================
  // WAREHOUSES
  // =============================================================

  /**
   * Load warehouses for dropdown
   */
  loadWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${API_BASE}/warehouses`).pipe(
      tap((warehouses) => {
        this._warehouses.set(warehouses || []);
      }),
      catchError((err) => {
        console.error('Failed to load warehouses:', err);
        return of([]);
      })
    );
  }

  // =============================================================
  // DASHBOARD STATS
  // =============================================================

  /**
   * Compute dashboard stats from items list
   * NOTE: In production, this would ideally be a separate backend endpoint
   * For now, we compute from items list
   */
  loadStats(): Observable<InventoryStats> {
    this._loading.set(true);
    this._error.set(null);

    // Load all items (for stats) and warehouses
    return forkJoin([
      this.http.get<InventoryItemListResponse>(`${API_BASE}/items`, {
        params: new HttpParams().set('limit', '1000'),
      }),
      this.loadWarehouses(),
    ]).pipe(
      map(([itemsResponse, warehouses]) => {
        const items = itemsResponse.data || [];

        // Calculate totals
        let totalWeightKg = 0;
        let totalPcsCount = 0;
        const categoryMap = new Map<string, { name: string; count: number; weightKg: number }>();
        const warehouseMap = new Map<string, { name: string; code: string; count: number; weightKg: number }>();
        const statusMap = new Map<InventoryStatus, { count: number; weightKg: number }>();

        for (const item of items) {
          const weight = typeof item.weightKg === 'string' ? parseFloat(item.weightKg) : item.weightKg;
          totalWeightKg += weight || 0;
          totalPcsCount += item.pcsCount || 0;

          // By category
          if (item.categoryId && item.category) {
            const cat = categoryMap.get(item.categoryId) || {
              name: item.category.name,
              count: 0,
              weightKg: 0,
            };
            cat.count += 1;
            cat.weightKg += weight || 0;
            categoryMap.set(item.categoryId, cat);
          }

          // By warehouse
          if (item.warehouseId && item.warehouse) {
            const wh = warehouseMap.get(item.warehouseId) || {
              name: item.warehouse.name,
              code: item.warehouse.code || '',
              count: 0,
              weightKg: 0,
            };
            wh.count += 1;
            wh.weightKg += weight || 0;
            warehouseMap.set(item.warehouseId, wh);
          }

          // By status
          const statusStat = statusMap.get(item.status) || { count: 0, weightKg: 0 };
          statusStat.count += 1;
          statusStat.weightKg += weight || 0;
          statusMap.set(item.status, statusStat);
        }

        const stats: InventoryStats = {
          totalItems: items.length,
          totalWeightKg,
          totalPcsCount,
          byCategory: Array.from(categoryMap.entries()).map(([id, data]) => ({
            categoryId: id,
            categoryName: data.name,
            count: data.count,
            weightKg: data.weightKg,
          })),
          byWarehouse: Array.from(warehouseMap.entries()).map(([id, data]) => ({
            warehouseId: id,
            warehouseName: data.name,
            warehouseCode: data.code,
            count: data.count,
            weightKg: data.weightKg,
          })),
          byStatus: Array.from(statusMap.entries()).map(([status, data]) => ({
            status,
            count: data.count,
            weightKg: data.weightKg,
          })),
        };

        this._stats.set(stats);
        this._loading.set(false);
        return stats;
      }),
      catchError((err) => this.handleError(err))
    );
  }

  // =============================================================
  // REFERENCE DATA
  // =============================================================

  /**
   * Load categories and grades from tenant endpoint
   */
  loadReferenceData(): Observable<{ categories: any[]; grades: any[] }> {
    return forkJoin({
      categories: this.http.get<any[]>(`${API_BASE_URL}/tenant/categories`).pipe(
        catchError(() => of([]))
      ),
      grades: this.http.get<any[]>(`${API_BASE_URL}/tenant/grades`).pipe(
        catchError(() => of([]))
      ),
    });
  }

  // =============================================================
  // ERROR HANDLING
  // =============================================================

  private handleError(err: HttpErrorResponse): Observable<never> {
    this._loading.set(false);

    let message = 'An unexpected error occurred';
    if (err.status === 0) {
      message = 'Unable to connect to server. Please check your connection.';
    } else if (err.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (err.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (err.status === 404) {
      message = 'Resource not found.';
    } else if (err.error?.message) {
      message = err.error.message;
    }

    this._error.set(message);
    return throwError(() => new Error(message));
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }

  // =============================================================
  // UTILITY
  // =============================================================

  /**
   * Format weight for display
   */
  formatWeight(weight: number | string): string {
    const w = typeof weight === 'string' ? parseFloat(weight) : weight;
    if (isNaN(w)) return '0 KG';
    if (w >= 1000) {
      return `${(w / 1000).toFixed(2)} T`;
    }
    return `${w.toFixed(2)} KG`;
  }

  /**
   * Get status badge variant
   */
  getStatusVariant(status: InventoryStatus): 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'RESERVED':
        return 'warning';
      case 'SOLD':
        return 'info';
      default:
        return 'info';
    }
  }
}
