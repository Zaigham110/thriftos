import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import { InventoryItem, InventorySummary, TraceabilityChain } from './inventory.models';

/**
 * INVENTORY SERVICE - READ-ONLY
 * ==============================
 * Provides read-only access to finalized goods inventory.
 * NO create, update, or delete methods.
 * Inventory is created automatically when repack units are sealed.
 */

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly API = API_ENDPOINTS.stockItems;

  constructor(private readonly http: HttpClient) {}

  /**
   * Get inventory summary/KPIs
   */
  getSummary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.API}/summary`);
  }

  /**
   * List inventory items with filters
   */
  getAll(filters?: {
    categoryId?: string;
    gradeId?: string;
    warehouseId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    query?: string;
    page?: number;
    limit?: number;
  }): Observable<{
    items: InventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    aggregates: {
      totalWeight: number;
      totalPcs: number;
    };
  }> {
    let params = new HttpParams();

    if (filters?.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters?.gradeId) params = params.set('gradeId', filters.gradeId);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters?.toDate) params = params.set('toDate', filters.toDate);
    if (filters?.query) params = params.set('query', filters.query);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<any>(this.API, { params });
  }

  /**
   * Get single inventory item by ID
   */
  getById(id: string): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.API}/${id}`);
  }

  /**
   * Get full traceability chain for an inventory item
   */
  getTraceability(id: string): Observable<TraceabilityChain> {
    return this.http.get<TraceabilityChain>(`${this.API}/${id}/traceability`);
  }

  /**
   * Get filter options (categories, grades, warehouses)
   */
  getFilterOptions(): Observable<{
    categories: Array<{ id: string; name: string }>;
    grades: Array<{ id: string; name: string }>;
    warehouses: Array<{ id: string; name: string }>;
  }> {
    return this.http.get<any>(`${this.API}/filter-options`);
  }
}
