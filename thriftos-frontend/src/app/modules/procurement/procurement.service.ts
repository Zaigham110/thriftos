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
 *   PATCH  /procurement/containers/:id/status
 *   GET    /procurement/containers/:id/cost-breakdown
 *   POST   /procurement/containers/:id/charges
 *   GET    /procurement/containers/:id/charges
 *   DELETE /procurement/containers/:id/charges/:chargeId
 * 
 * Incoming Bales:
 *   POST   /procurement/incoming-bales
 *   GET    /procurement/incoming-bales
 *   GET    /procurement/incoming-bales/:id
 *   PATCH  /procurement/incoming-bales/:id
 *   DELETE /procurement/incoming-bales/:id
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
  UpdateContainerStatusRequest,
  ContainerListResponse,
  ContainerFilters,
  ContainerCharge,
  CreateContainerChargeRequest,
  CostBreakdown,
  IncomingBale,
  CreateIncomingBaleRequest,
  UpdateIncomingBaleRequest,
  IncomingBaleListResponse,
  IncomingBaleFilters,
  ProcurementStats,
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

  // Incoming Bale state
  private readonly _incomingBales = signal<IncomingBale[]>([]);
  private readonly _baleTotalCount = signal(0);
  private readonly _baleCurrentPage = signal(1);
  private readonly _baleTotalPages = signal(1);

  // Dashboard stats
  private readonly _stats = signal<ProcurementStats | null>(null);

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
  readonly incomingBales = this._incomingBales.asReadonly();
  readonly baleTotalCount = this._baleTotalCount.asReadonly();
  readonly baleCurrentPage = this._baleCurrentPage.asReadonly();
  readonly baleTotalPages = this._baleTotalPages.asReadonly();
  readonly stats = this._stats.asReadonly();

  // Computed values
  readonly activeVendors = computed(() => this._vendors().filter(v => v.isActive));

  constructor(
    private readonly http: HttpClient,
    private readonly tenantService: TenantService,
  ) {}

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

  /**
   * Load incoming bales with filters
   */
  loadIncomingBales(filters: IncomingBaleFilters = {}): Observable<IncomingBaleListResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = this.buildIncomingBaleParams(filters);

    return this.http.get<IncomingBaleListResponse>(`${API_BASE}/incoming-bales`, { params }).pipe(
      tap((response) => {
        this._incomingBales.set(response.data);
        this._baleTotalCount.set(response.total);
        this._baleCurrentPage.set(response.page);
        this._baleTotalPages.set(response.totalPages);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  fetchIncomingBales(filters: IncomingBaleFilters = {}): Observable<IncomingBaleListResponse> {
    const params = this.buildIncomingBaleParams(filters);
    return this.http.get<IncomingBaleListResponse>(`${API_BASE}/incoming-bales`, { params }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  private buildIncomingBaleParams(filters: IncomingBaleFilters = {}): HttpParams {
    let params = new HttpParams();
    if (filters.containerId) params = params.set('containerId', filters.containerId);
    if (filters.purchaseOrderId) params = params.set('purchaseOrderId', filters.purchaseOrderId);
    if (filters.vendorId) params = params.set('vendorId', filters.vendorId);
    if (filters.standalone !== undefined) params = params.set('standalone', filters.standalone.toString());
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return params;
  }

  /**
   * Get a single incoming bale by ID
   */
  getIncomingBale(id: string): Observable<IncomingBale> {
    return this.http.get<IncomingBale>(`${API_BASE}/incoming-bales/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new incoming bale
   */
  createIncomingBale(data: CreateIncomingBaleRequest): Observable<IncomingBale> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<IncomingBale>(`${API_BASE}/incoming-bales`, data).pipe(
      tap(() => {
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update an incoming bale
   */
  updateIncomingBale(id: string, data: UpdateIncomingBaleRequest): Observable<IncomingBale> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<IncomingBale>(`${API_BASE}/incoming-bales/${id}`, data).pipe(
      tap((updatedBale) => {
        this._incomingBales.update((bales) =>
          bales.map((b) => (b.id === id ? updatedBale : b))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Delete an incoming bale
   */
  deleteIncomingBale(id: string): Observable<void> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete<void>(`${API_BASE}/incoming-bales/${id}`).pipe(
      tap(() => {
        this._incomingBales.update((bales) => bales.filter((b) => b.id !== id));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // DASHBOARD STATS
  // =============================================================

  /**
   * Load procurement stats for dashboard
   * Combines multiple API calls to build stats
   */
  loadStats(): Observable<ProcurementStats> {
    this._loading.set(true);
    this._error.set(null);

    // Load all needed data in parallel
    return forkJoin({
      tenant: this.tenantService.loadTenant(),
      openPOs: this.http.get<PurchaseOrderListResponse>(`${API_BASE}/purchase-orders`, {
        params: new HttpParams().set('status', 'OPEN').set('limit', '1'),
      }),
      receivedPOs: this.http.get<PurchaseOrderListResponse>(`${API_BASE}/purchase-orders`, {
        params: new HttpParams().set('status', 'RECEIVED').set('limit', '1'),
      }),
      closedPOs: this.http.get<PurchaseOrderListResponse>(`${API_BASE}/purchase-orders`, {
        params: new HttpParams().set('status', 'CLOSED').set('limit', '1'),
      }),
      containers: this.http.get<ContainerListResponse>(`${API_BASE}/containers`, {
        params: new HttpParams().set('limit', '1000'),
      }),
      bales: this.http.get<IncomingBaleListResponse>(`${API_BASE}/incoming-bales`, {
        params: new HttpParams().set('limit', '1000'),
      }),
    }).pipe(
      map((results) => {
        const containers = results.containers.data || [];
        const bales = results.bales.data || [];

        // Calculate totals
        const totalWeightKg = bales.reduce((sum, b) => sum + Number(b.weightKg || 0), 0);
        const totalBalesCost = bales.reduce((sum, b) => sum + Number(b.cost || 0), 0);

        const stats: ProcurementStats = {
          totalPurchaseOrders: results.openPOs.total + results.receivedPOs.total + results.closedPOs.total,
          openPurchaseOrders: results.openPOs.total,
          receivedPurchaseOrders: results.receivedPOs.total,
          closedPurchaseOrders: results.closedPOs.total,
          totalContainers: results.containers.total,
          containersInTransit: containers.filter((c) => c.status === 'IN_TRANSIT').length,
          containersArrived: containers.filter((c) => c.status === 'ARRIVED' || c.status === 'CLEARED').length,
          totalIncomingBales: results.bales.total,
          standaloneIncomingBales: bales.filter((b) => !b.containerId).length,
          totalWeightKg,
          totalCost: totalBalesCost,
          currency: results.tenant.currency,
        };

        this._stats.set(stats);
        this._loading.set(false);
        return stats;
      }),
      catchError((error) => this.handleError(error))
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
