import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import { InventoryItem, InventorySummary, OpenBaleRequest, ReceiveReadyStockRequest, TraceabilityChain } from './inventory.models';

/** Sellable stock: lists, ready stock received, bales opened into pieces. */

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
    source?: 'PROCESSED' | 'PURCHASED';
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

    if (filters?.source) params = params.set('source', filters.source);
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

  /** Stock bought ready to sell (journey 5). */
  receiveReadyStock(body: ReceiveReadyStockRequest): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(this.API, body);
  }

  /** Opens bales into pieces by price tier. */
  openBale(id: string, body: OpenBaleRequest): Observable<{ cost: string; pieces: InventoryItem[] }> {
    return this.http.post<{ cost: string; pieces: InventoryItem[] }>(`${this.API}/${id}/open`, body);
  }
}
