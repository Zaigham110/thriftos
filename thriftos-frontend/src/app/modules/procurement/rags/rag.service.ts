/**
 * Rag/Bale Service
 * Phase 2.5: Container Breakdown
 * 
 * API client for Rag/Bale CRUD operations with signal-based state
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import {
  Rag,
  RagListResponse,
  RagFilters,
  CreateRagRequest,
  UpdateRagRequest,
} from './rag.models';
import { API_ENDPOINTS } from '../../../core/config/api.config';

const API_BASE = API_ENDPOINTS.procurement;

@Injectable({
  providedIn: 'root',
})
export class RagService {
  private readonly http = inject(HttpClient);

  // =============================================================
  // STATE SIGNALS
  // =============================================================

  private readonly _rags = signal<Rag[]>([]);
  private readonly _currentRag = signal<Rag | null>(null);
  private readonly _total = signal(0);
  private readonly _page = signal(1);
  private readonly _limit = signal(20);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // =============================================================
  // PUBLIC READONLY SIGNALS
  // =============================================================

  readonly rags = this._rags.asReadonly();
  readonly currentRag = this._currentRag.asReadonly();
  readonly total = this._total.asReadonly();
  readonly page = this._page.asReadonly();
  readonly limit = this._limit.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly totalPages = computed(() => Math.ceil(this._total() / this._limit()));

  // =============================================================
  // METHODS
  // =============================================================

  /**
   * Get rags for a specific container
   */
  getRagsForContainer(
    containerId: string,
    filters?: Omit<RagFilters, 'containerId'>
  ): Observable<RagListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('containerId', containerId);

    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.sortableOnly !== undefined) {
      params = params.set('sortableOnly', String(filters.sortableOnly));
    }
    if (filters?.page) {
      params = params.set('page', String(filters.page));
    }
    if (filters?.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.http.get<RagListResponse>(`${API_BASE}/rags`, { params }).pipe(
      tap((response) => {
        this._rags.set(response.data);
        this._total.set(response.total);
        this._page.set(response.page);
        this._limit.set(response.limit);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get all rags for tenant (sortable rags for sorting session creation)
   */
  getSortableRags(page = 1, limit = 20): Observable<RagListResponse> {
    this._loading.set(true);
    this._error.set(null);

    const params = new HttpParams()
      .set('sortableOnly', 'true')
      .set('page', String(page))
      .set('limit', String(limit));

    return this.http.get<RagListResponse>(`${API_BASE}/rags`, { params }).pipe(
      tap((response) => {
        this._rags.set(response.data);
        this._total.set(response.total);
        this._page.set(response.page);
        this._limit.set(response.limit);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Get a single rag by ID
   */
  getRag(id: string): Observable<Rag> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<Rag>(`${API_BASE}/rags/${id}`).pipe(
      tap((rag) => {
        this._currentRag.set(rag);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new rag for a container
   */
  createRag(containerId: string, data: CreateRagRequest): Observable<Rag> {
    this._loading.set(true);
    this._error.set(null);

    return this.http
      .post<Rag>(`${API_BASE}/containers/${containerId}/rags`, data)
      .pipe(
        tap((rag) => {
          // Add to current list
          this._rags.update((rags) => [rag, ...rags]);
          this._total.update((t) => t + 1);
          this._loading.set(false);
        }),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Update a rag (only allowed if status = NOT_STARTED)
   */
  updateRag(id: string, data: UpdateRagRequest): Observable<Rag> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Rag>(`${API_BASE}/rags/${id}`, data).pipe(
      tap((updatedRag) => {
        // Update in list
        this._rags.update((rags) =>
          rags.map((r) => (r.id === id ? updatedRag : r))
        );
        if (this._currentRag()?.id === id) {
          this._currentRag.set(updatedRag);
        }
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Delete a rag (only allowed if status = NOT_STARTED)
   */
  deleteRag(id: string): Observable<void> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete<void>(`${API_BASE}/rags/${id}`).pipe(
      tap(() => {
        // Remove from list
        this._rags.update((rags) => rags.filter((r) => r.id !== id));
        this._total.update((t) => Math.max(0, t - 1));
        if (this._currentRag()?.id === id) {
          this._currentRag.set(null);
        }
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Clear current state
   */
  clearState(): void {
    this._rags.set([]);
    this._currentRag.set(null);
    this._total.set(0);
    this._page.set(1);
    this._error.set(null);
  }

  /**
   * Clear error
   */
  clearError(): void {
    this._error.set(null);
  }

  // =============================================================
  // PRIVATE HELPERS
  // =============================================================

  private handleError(error: any): Observable<never> {
    const message =
      error.error?.message ||
      error.message ||
      'An unexpected error occurred';
    this._error.set(message);
    this._loading.set(false);
    return throwError(() => new Error(message));
  }
}
