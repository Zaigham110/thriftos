/**
 * Tenants Service - Super Admin tenant management API
 * Phase 1: Authentication & Shell
 * 
 * Backend APIs (AUTHORITATIVE):
 * POST   /superadmin/tenants
 * GET    /superadmin/tenants
 * GET    /superadmin/tenants/:id
 * PATCH  /superadmin/tenants/:id
 * POST   /superadmin/tenants/:id/impersonate
 */

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import {
  Tenant,
  TenantListResponse,
  CreateTenantRequest,
  CreateTenantResponse,
  UpdateTenantRequest,
  TenantStatus,
} from './tenant.models';
import { API_ENDPOINTS } from '../../../../core/config/api.config';

const API_BASE = `${API_ENDPOINTS.superadmin}/tenants`;

export interface TenantFilters {
  page?: number;
  limit?: number;
  status?: TenantStatus;
}

@Injectable({
  providedIn: 'root',
})
export class TenantsService {
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _tenants = signal<Tenant[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _currentPage = signal(1);
  private readonly _totalPages = signal(1);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly tenants = this._tenants.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();

  constructor(private readonly http: HttpClient) {}

  /**
   * List all tenants with pagination and filtering
   */
  loadTenants(filters: TenantFilters = {}): Observable<TenantListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get<TenantListResponse>(API_BASE, { params }).pipe(
      tap((response) => {
        this._tenants.set(response.data);
        this._totalCount.set(response.total);
        this._currentPage.set(response.page);
        this._totalPages.set(response.totalPages);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get a single tenant by ID
   */
  getTenant(id: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${API_BASE}/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new tenant
   */
  createTenant(data: CreateTenantRequest): Observable<CreateTenantResponse> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<CreateTenantResponse>(API_BASE, data).pipe(
      tap(() => {
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update an existing tenant
   */
  updateTenant(id: string, data: UpdateTenantRequest): Observable<Tenant> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Tenant>(`${API_BASE}/${id}`, data).pipe(
      tap((updatedTenant) => {
        // Update the tenant in the local list
        this._tenants.update((tenants) =>
          tenants.map((t) => (t.id === id ? updatedTenant : t))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Deactivate a tenant
   */
  deactivateTenant(id: string): Observable<Tenant> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Tenant>(`${API_BASE}/${id}/deactivate`, {}).pipe(
      tap((updatedTenant) => {
        this._tenants.update((tenants) =>
          tenants.map((t) => (t.id === id ? updatedTenant : t))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Activate a tenant
   */
  activateTenant(id: string): Observable<Tenant> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Tenant>(`${API_BASE}/${id}/activate`, {}).pipe(
      tap((updatedTenant) => {
        this._tenants.update((tenants) =>
          tenants.map((t) => (t.id === id ? updatedTenant : t))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

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
      message = 'Tenant not found';
    } else if (error.status === 409) {
      message = error.error?.message || 'Company code already exists';
    } else if (error.status === 500) {
      message = error.error?.message || 'Internal server error - please try again';
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
