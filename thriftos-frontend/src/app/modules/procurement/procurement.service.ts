/**
 * Procurement Service - API client for all procurement operations
 * Phase 2: Procurement UI
 * 
 * Backend APIs (AUTHORITATIVE):
 * Vendors:
 *   POST   /procurement/vendors
 *   GET    /procurement/vendors
 * 
 * Purchase Orders:
 *   POST   /procurement/purchase-orders
 *   GET    /procurement/purchase-orders
 *   GET    /procurement/purchase-orders/:id
 *   PATCH  /procurement/purchase-orders/:id
 *   PATCH  /procurement/purchase-orders/:id/receive
 *   PATCH  /procurement/purchase-orders/:id/close
 * 
 * Containers:
 *   POST   /procurement/containers
 *   GET    /procurement/containers
 *   GET    /procurement/containers/:id
 *   PATCH  /procurement/containers/:id
 *   PATCH  /procurement/containers/:id/weights
 *   PATCH  /procurement/containers/:id/status
 *   GET    /procurement/containers/:id/cost-breakdown
 *   POST   /procurement/containers/:id/charges
 *   GET    /procurement/containers/:id/charges
 *   DELETE /procurement/containers/:id/charges/:chargeId
 * 
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, forkJoin, of, map } from 'rxjs';
import {
  Vendor,
  CreateVendorRequest,
  PurchaseOrder,
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  PurchaseOrderListResponse,
  PurchaseOrderFilters,
  Container,
  CreateContainerRequest,
  UpdateContainerRequest,
  UpdateContainerWeightsRequest,
  UpdateContainerStatusRequest,
  ContainerListResponse,
  ContainerFilters,
  ContainerCharge,
  CreateContainerChargeRequest,
  CostBreakdown,
  ProcurementDashboardSummary,
  ProcurementDashboardSummaryResponse,
} from './procurement.models';
import { API_ENDPOINTS } from '../../core/config/api.config';
import { TenantService } from '../../core/tenant/tenant.service';

const API_BASE = API_ENDPOINTS.procurement;

@Injectable({
  providedIn: 'root',
})
export class ProcurementService {
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Vendor state
  private readonly _vendors = signal<Vendor[]>([]);

  // Purchase Order state
  private readonly _purchaseOrders = signal<PurchaseOrder[]>([]);
  private readonly _poTotalCount = signal(0);
  private readonly _poCurrentPage = signal(1);
  private readonly _poTotalPages = signal(1);

  // Container state
  private readonly _containers = signal<Container[]>([]);
  private readonly _containerTotalCount = signal(0);
  private readonly _containerCurrentPage = signal(1);
  private readonly _containerTotalPages = signal(1);


  // Dashboard summary (authoritative backend aggregates)
  private readonly _stats = signal<ProcurementDashboardSummary | null>(null);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly vendors = this._vendors.asReadonly();
  readonly purchaseOrders = this._purchaseOrders.asReadonly();
  readonly poTotalCount = this._poTotalCount.asReadonly();
  readonly poCurrentPage = this._poCurrentPage.asReadonly();
  readonly poTotalPages = this._poTotalPages.asReadonly();
  readonly containers = this._containers.asReadonly();
  readonly containerTotalCount = this._containerTotalCount.asReadonly();
  readonly containerCurrentPage = this._containerCurrentPage.asReadonly();
  readonly containerTotalPages = this._containerTotalPages.asReadonly();
  readonly stats = this._stats.asReadonly();

  // Computed values
  readonly activeVendors = computed(() => this._vendors().filter(v => v.isActive));

  constructor(
    private readonly http: HttpClient,
    private readonly tenantService: TenantService,
  ) {}

  private normalizeContainer(raw: any): Container {
    // Backward/forward compatibility:
    // - Legacy API: grossWeight, netWeight, (optional) tareWeight
    // - New API: grossWeightKg, tareWeightKg, netWeightKg
    const grossWeight = Number(raw?.grossWeight ?? raw?.grossWeightKg ?? 0);
    const netWeight = Number(raw?.netWeight ?? raw?.netWeightKg ?? 0);

    const tareFromLegacy = raw?.tareWeight;
    const tareFromKg = raw?.tareWeightKg;
    const tareWeight =
      tareFromLegacy === undefined && tareFromKg === undefined
        ? undefined
        : (tareFromLegacy ?? tareFromKg) === null
          ? null
          : Number(tareFromLegacy ?? tareFromKg);

    return {
      ...raw,
      grossWeight,
      netWeight,
      tareWeight,
    } as Container;
  }

  // =============================================================
  // VENDORS
  // =============================================================

  /**
   * Load all vendors for the current tenant
   */
  loadVendors(includeInactive = false): Observable<Vendor[]> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (includeInactive) {
      params = params.set('includeInactive', 'true');
    }

    return this.http.get<Vendor[]>(`${API_BASE}/vendors`, { params }).pipe(
      tap((vendors) => {
        this._vendors.set(vendors);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new vendor
   */
  createVendor(data: CreateVendorRequest): Observable<Vendor> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Vendor>(`${API_BASE}/vendors`, data).pipe(
      tap((vendor) => {
        this._vendors.update((vendors) => [...vendors, vendor]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // PURCHASE ORDERS
  // =============================================================

  /**
   * Load purchase orders with filters
   */
  loadPurchaseOrders(filters: PurchaseOrderFilters = {}): Observable<PurchaseOrderListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<PurchaseOrderListResponse>(`${API_BASE}/purchase-orders`, { params }).pipe(
      tap((response) => {
        this._purchaseOrders.set(response.data);
        this._poTotalCount.set(response.total);
        this._poCurrentPage.set(response.page);
        this._poTotalPages.set(response.totalPages);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get a single purchase order by ID
   */
  getPurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${API_BASE}/purchase-orders/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new purchase order
   */
  createPurchaseOrder(data: CreatePurchaseOrderRequest): Observable<PurchaseOrder> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<PurchaseOrder>(`${API_BASE}/purchase-orders`, data).pipe(
      tap(() => {
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update a purchase order
   */
  updatePurchaseOrder(id: string, data: UpdatePurchaseOrderRequest): Observable<PurchaseOrder> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<PurchaseOrder>(`${API_BASE}/purchase-orders/${id}`, data).pipe(
      tap((updatedPO) => {
        this._purchaseOrders.update((pos) =>
          pos.map((po) => (po.id === id ? updatedPO : po))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Mark purchase order as received
   */
  receivePurchaseOrder(id: string): Observable<PurchaseOrder> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<PurchaseOrder>(`${API_BASE}/purchase-orders/${id}/receive`, {}).pipe(
      tap((updatedPO) => {
        this._purchaseOrders.update((pos) =>
          pos.map((po) => (po.id === id ? updatedPO : po))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Close a purchase order
   */
  closePurchaseOrder(id: string): Observable<PurchaseOrder> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<PurchaseOrder>(`${API_BASE}/purchase-orders/${id}/close`, {}).pipe(
      tap((updatedPO) => {
        this._purchaseOrders.update((pos) =>
          pos.map((po) => (po.id === id ? updatedPO : po))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // CONTAINERS
  // =============================================================

  /**
   * Load containers with filters
   */
  loadContainers(filters: ContainerFilters = {}): Observable<ContainerListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters.purchaseOrderId) params = params.set('purchaseOrderId', filters.purchaseOrderId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<ContainerListResponse>(`${API_BASE}/containers`, { params }).pipe(
      map((response) => ({
        ...response,
        data: (response.data || []).map((c: any) => this.normalizeContainer(c)),
      })),
      tap((response) => {
        this._containers.set(response.data);
        this._containerTotalCount.set(response.total);
        this._containerCurrentPage.set(response.page);
        this._containerTotalPages.set(response.totalPages);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get a single container by ID
   */
  getContainer(id: string): Observable<Container> {
    return this.http.get<Container>(`${API_BASE}/containers/${id}`).pipe(
      map((c: any) => this.normalizeContainer(c)),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new container
   */
  createContainer(data: CreateContainerRequest): Observable<Container> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Container>(`${API_BASE}/containers`, data).pipe(
      map((c: any) => this.normalizeContainer(c)),
      tap(() => {
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update a container
   */
  updateContainer(id: string, data: UpdateContainerRequest): Observable<Container> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Container>(`${API_BASE}/containers/${id}`, data).pipe(
      map((c: any) => this.normalizeContainer(c)),
      tap((updatedContainer) => {
        this._containers.update((containers) =>
          containers.map((c) => (c.id === id ? updatedContainer : c))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update container weights (gross/tare); backend computes net.
   */
  updateContainerWeights(id: string, data: UpdateContainerWeightsRequest): Observable<Container> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Container>(`${API_BASE}/containers/${id}/weights`, data).pipe(
      map((c: any) => this.normalizeContainer(c)),
      tap((updatedContainer) => {
        this._containers.update((containers) =>
          containers.map((c) => (c.id === id ? updatedContainer : c))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update container status
   */
  updateContainerStatus(id: string, data: UpdateContainerStatusRequest): Observable<Container> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Container>(`${API_BASE}/containers/${id}/status`, data).pipe(
      map((c: any) => this.normalizeContainer(c)),
      tap((updatedContainer) => {
        this._containers.update((containers) =>
          containers.map((c) => (c.id === id ? updatedContainer : c))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get container cost breakdown
   */
  getContainerCostBreakdown(id: string): Observable<CostBreakdown> {
    return this.http.get<CostBreakdown>(`${API_BASE}/containers/${id}/cost-breakdown`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get container charges
   */
  getContainerCharges(id: string): Observable<ContainerCharge[]> {
    return this.http.get<ContainerCharge[]>(`${API_BASE}/containers/${id}/charges`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Add a charge to a container
   */
  addContainerCharge(containerId: string, data: CreateContainerChargeRequest): Observable<ContainerCharge> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<ContainerCharge>(`${API_BASE}/containers/${containerId}/charges`, data).pipe(
      tap(() => {
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Delete a container charge
   */
  deleteContainerCharge(containerId: string, chargeId: string): Observable<void> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete<void>(`${API_BASE}/containers/${containerId}/charges/${chargeId}`).pipe(
      tap(() => {
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // INCOMING BALES
  // =============================================================








  // =============================================================
  // DASHBOARD STATS
  // =============================================================

  /**
   * Load procurement stats for dashboard
   * Combines multiple API calls to build stats
   */
  loadStats(filters?: { startDate?: string; endDate?: string }): Observable<ProcurementDashboardSummary> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);

    return this.http
      .get<ProcurementDashboardSummaryResponse>(`${API_BASE}/dashboard/summary`, { params })
      .pipe(
        map((res) => res.data),
        tap((summary) => {
          this._stats.set(summary);
          this._loading.set(false);
        }),
        catchError((error) => this.handleError(error)),
      );
  }

  // =============================================================
  // UTILITY METHODS
  // =============================================================

  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    this._loading.set(false);

    let message = 'An unexpected error occurred';

    if (error.status === 400) {
      message = error.error?.message || 'Invalid request';
    } else if (error.status === 401) {
      message = 'Unauthorized - please log in again';
    } else if (error.status === 403) {
      message = 'Access denied';
    } else if (error.status === 404) {
      message = 'Resource not found';
    } else if (error.status === 409) {
      message = error.error?.message || 'Duplicate entry exists';
    } else if (error.status === 500) {
      message = error.error?.message || 'Internal server error';
      console.error('Server error details:', error.error);
    } else if (error.status === 0) {
      message = 'Unable to connect to server';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    this._error.set(message);
    return throwError(() => ({ status: error.status, message }));
  }
}
