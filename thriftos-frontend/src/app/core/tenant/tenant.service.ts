/**
 * Tenant Service - lightweight tenant context for feature modules
 * Provides cached tenant profile + category catalog for read-only consumers
 */

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import type { Lang } from '../i18n/i18n.service';
import { SIGNED_OUT_EVENT, sessionCache } from '../auth/session-cache';

export type CategoryType = 'RAG' | 'BALE' | 'GENERAL';

export interface CurrencyMeta {
  code: string;
  symbol: string;
  decimalPlaces: number;
}

export interface TenantProfile {
  id: string;
  name: string;
  companyCode: string;
  currencyCode: string;
  currency: CurrencyMeta;
  currencyLocked?: boolean;
  locale: string;
  enabledModules?: TenantModule[];
  /** 0 = trading only, 1 = category only, 2 = category + grade. */
  sortingStages?: number;
  defaultLanguage?: Lang;
  /** Null until the owner finished the setup wizard. */
  setupCompletedAt?: string | null;
}

/**
 * Modules a tenant can turn on; the first five are on by default. The rest are not part of v1 and stay hidden
 * (and refused by the server) until turned on in `Tenant.enabledModules`. BILLING is read from the SYSTEM business.
 */
export type TenantModule =
  | 'RECEIVE' | 'SORT' | 'STOCK' | 'SELL' | 'KHATA'
  | 'REPORTS' | 'EXPORT' | 'WAREHOUSES' | 'PURCHASE_ORDERS' | 'PAYROLL' | 'BILLING';

const DEFAULT_MODULES: TenantModule[] = ['RECEIVE', 'SORT', 'STOCK', 'SELL', 'KHATA'];

export interface TenantCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  categoryType?: CategoryType;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly _tenant = signal<TenantProfile | null>(null);
  private readonly _categories = signal<TenantCategory[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly tenant = this._tenant.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  constructor(private readonly http: HttpClient) {
    // Nothing about one business stays in memory for the next person who signs in on this phone.
    window.addEventListener(SIGNED_OUT_EVENT, () => {
      this._tenant.set(null);
      this._categories.set([]);
    });
  }

  /** A module is on when the tenant lists it (or, before the tenant loads, the default five are on). */
  isModuleEnabled(module: TenantModule, tenant: TenantProfile | null = this._tenant()): boolean {
    const enabled = tenant?.enabledModules ?? DEFAULT_MODULES;
    return enabled.includes(module);
  }

  loadTenant(force = false): Observable<TenantProfile> {
    if (this._tenant() && !force) {
      return of(this._tenant()!);
    }
    // Installed app opening: this person's business as last seen, refreshed behind.
    const cached = force ? null : sessionCache.tenant<TenantProfile>();
    if (cached) {
      this._tenant.set(cached);
      this.fetchTenant().subscribe({ error: () => undefined });
      return of(cached);
    }
    return this.fetchTenant();
  }

  private fetchTenant(): Observable<TenantProfile> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<TenantProfile>(`${API_BASE_URL}/tenant`).pipe(
      tap((tenant) => {
        this._tenant.set(tenant);
        sessionCache.saveTenant(tenant);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  loadCategories(force = false): Observable<TenantCategory[]> {
    if (this._categories().length > 0 && !force) {
      return of(this._categories());
    }

    this._loading.set(true);
    this._error.set(null);

    return this.http.get<TenantCategory[]>(`${API_BASE_URL}/tenant/categories`).pipe(
      tap((categories) => {
        this._categories.set(categories);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error)),
    );
  }

  loadCategoriesByType(type: CategoryType): Observable<TenantCategory[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<TenantCategory[]>(`${API_BASE_URL}/tenant/categories`, {
      params: { type },
    }).pipe(
      tap(() => this._loading.set(false)),
      catchError((error) => this.handleError(error)),
    );
  }

  loadRawCategories(type?: 'RAG' | 'BALE' | 'BOTH'): Observable<any[]> {
    const options = type ? { params: { type } } : {};
    return this.http.get<any[]>(`${API_BASE_URL}/tenant/raw-categories`, options);
  }

  createRawCategory(data: { name: string; rawType: 'RAG' | 'BALE' | 'BOTH'; sortOrder?: number }): Observable<any> {
    return this.http.post<any>(`${API_BASE_URL}/tenant/raw-categories`, data);
  }

  updateRawCategory(id: string, data: { name?: string; sortOrder?: number }): Observable<any> {
    return this.http.put<any>(`${API_BASE_URL}/tenant/raw-categories/${id}`, data);
  }

  deleteRawCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/tenant/raw-categories/${id}`);
  }

  clearError(): void {
    this._error.set(null);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    this._loading.set(false);
    const message = error.error?.message || 'Failed to load tenant data';
    this._error.set(message);
    return throwError(() => ({ status: error.status, message }));
  }
}
