/**
 * Sorting Stage 1 Service
 * Phase 3: Category Sorting UI
 * 
 * Backend APIs (AUTHORITATIVE):
 * Sort Sessions:
 *   POST   /sorting/stage1/sessions
 *   GET    /sorting/stage1/sessions
 *   GET    /sorting/stage1/sessions/:id
 *   PATCH  /sorting/stage1/sessions/:id
 *   POST   /sorting/stage1/sessions/:id/close
 * 
 * Sort Category Buckets:
 *   POST   /sorting/stage1/sessions/:id/buckets
 *   PATCH  /sorting/stage1/buckets/:id
 *   DELETE /sorting/stage1/buckets/:id
 * 
 * Category Outputs (read-only):
 *   GET    /sorting/stage1/category-outputs
 *   GET    /sorting/stage1/category-outputs/:id
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, map, forkJoin, of } from 'rxjs';
import {
  SortSession,
  CreateSortSessionRequest,
  UpdateSortSessionRequest,
  SortSessionListResponse,
  SortSessionFilters,
  SortCategoryBucket,
  CreateSortCategoryBucketRequest,
  UpdateSortCategoryBucketRequest,
  CategoryOutput,
  CategoryOutputListResponse,
  SortingTotals,
  SortableSource,
  Category,
  SortStatus,
} from './sorting-stage1.models';
import { API_ENDPOINTS } from '../../core/config/api.config';

const API_BASE = API_ENDPOINTS.sortingStage1;
const PROCUREMENT_API = API_ENDPOINTS.procurement;

@Injectable({
  providedIn: 'root',
})
export class SortingStage1Service {
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Session list state
  private readonly _sessions = signal<SortSession[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _currentPage = signal(1);
  private readonly _totalPages = signal(1);

  // Current session state
  private readonly _currentSession = signal<SortSession | null>(null);
  private readonly _buckets = signal<SortCategoryBucket[]>([]);

  // Categories state
  private readonly _categories = signal<Category[]>([]);

  // Available sources state
  private readonly _sortableSources = signal<SortableSource[]>([]);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly buckets = this._buckets.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly sortableSources = this._sortableSources.asReadonly();

  // Computed: Sorting totals for current session
  readonly sortingTotals = computed<SortingTotals>(() => {
    const session = this._currentSession();
    const buckets = this._buckets();

    if (!session) {
      return {
        totalInputWeight: 0,
        totalSortedWeight: 0,
        totalItemCount: 0,
        yieldPercentage: 0,
      };
    }

    // Convert Decimal strings to numbers
    const toNum = (val: any) => typeof val === 'string' ? parseFloat(val) : (val || 0);
    
    const totalInputWeight = toNum(session.totalInputWeight);
    const totalSortedWeight = buckets
      .reduce((sum, b) => sum + toNum(b.outputWeightKg), 0);
    const totalItemCount = buckets
      .reduce((sum, b) => sum + (b.outputCount || 0), 0);

    const yieldPercentage =
      totalInputWeight > 0
        ? ((totalSortedWeight / totalInputWeight) * 100)
        : 0;

    return {
      totalInputWeight,
      totalSortedWeight,
      totalItemCount,
      yieldPercentage,
    };
  });

  // Computed: Is current session editable
  readonly isSessionEditable = computed(() => {
    const session = this._currentSession();
    return session?.status === 'OPEN';
  });

  // Computed: All category buckets
  readonly categoryBuckets = computed(() => {
    return this._buckets();
  });

  // Computed: Active categories
  readonly activeCategories = computed(() => {
    return this._categories().filter((c) => c.isActive);
  });

  constructor(private readonly http: HttpClient) {}

  // =============================================================
  // SORT SESSIONS
  // =============================================================

  /**
   * Load all sort sessions with optional filters
   */
  loadSessions(filters?: SortSessionFilters): Observable<SortSessionListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.page) {
      params = params.set('page', filters.page.toString());
    }
    if (filters?.limit) {
      params = params.set('limit', filters.limit.toString());
    }

    return this.http
      .get<SortSessionListResponse>(`${API_BASE}/sessions`, { params })
      .pipe(
        tap((response) => {
          this._sessions.set(response.data);
          this._totalCount.set(response.total);
          this._currentPage.set(response.page);
          this._totalPages.set(Math.ceil(response.total / response.limit));
          this._loading.set(false);
        }),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Get a single sort session by ID
   */
  getSession(id: string): Observable<SortSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<any>(`${API_BASE}/sessions/${id}`).pipe(
      map((session) => ({
        ...session,
        buckets: session.sortCategoryBuckets || [],
      })),
      tap((session) => {
        this._currentSession.set(session);
        this._buckets.set(session.buckets || []);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Create a new sort session
   */
  createSession(data: CreateSortSessionRequest): Observable<SortSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<SortSession>(`${API_BASE}/sessions`, data).pipe(
      tap((session) => {
        // Add to list
        this._sessions.update((sessions) => [session, ...sessions]);
        this._currentSession.set(session);
        this._buckets.set([]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Update a sort session
   */
  updateSession(id: string, data: UpdateSortSessionRequest): Observable<SortSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<SortSession>(`${API_BASE}/sessions/${id}`, data).pipe(
      tap((session) => {
        this._currentSession.set(session);
        // Update in list
        this._sessions.update((sessions) =>
          sessions.map((s) => (s.id === id ? session : s))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Close a sort session
   */
  closeSession(id: string): Observable<SortSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<SortSession>(`${API_BASE}/sessions/${id}/close`, {}).pipe(
      tap((session) => {
        this._currentSession.set(session);
        // Update in list
        this._sessions.update((sessions) =>
          sessions.map((s) => (s.id === id ? session : s))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // SORT CATEGORY BUCKETS
  // =============================================================

  /**
   * Add a category bucket to a session
   */
  addBucket(
    sessionId: string,
    data: CreateSortCategoryBucketRequest
  ): Observable<SortCategoryBucket> {
    this._loading.set(true);
    this._error.set(null);

    return this.http
      .post<SortCategoryBucket>(`${API_BASE}/sessions/${sessionId}/buckets`, data)
      .pipe(
        tap((bucket) => {
          this._buckets.update((buckets) => [...buckets, bucket]);
          this._loading.set(false);
        }),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Update a category bucket
   */
  updateBucket(
    bucketId: string,
    data: UpdateSortCategoryBucketRequest
  ): Observable<SortCategoryBucket> {
    this._loading.set(true);
    this._error.set(null);

    return this.http
      .patch<SortCategoryBucket>(`${API_BASE}/buckets/${bucketId}`, data)
      .pipe(
        tap((bucket) => {
          this._buckets.update((buckets) =>
            buckets.map((b) => (b.id === bucketId ? bucket : b))
          );
          this._loading.set(false);
        }),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Delete a category bucket
   */
  deleteBucket(bucketId: string): Observable<void> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete<void>(`${API_BASE}/buckets/${bucketId}`).pipe(
      tap(() => {
        this._buckets.update((buckets) =>
          buckets.filter((b) => b.id !== bucketId)
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // CATEGORIES
  // =============================================================

  /**
   * Load categories for the tenant
   */
  loadCategories(): Observable<Category[]> {
    // Categories come from the tenant endpoint
    return this.http.get<Category[]>('http://localhost:3000/api/tenant/categories').pipe(
      tap((categories) => {
        this._categories.set(categories);
      }),
      catchError((error) => {
        console.error('Failed to load categories:', error);
        return of([]);
      })
    );
  }

  // =============================================================
  // SORTABLE SOURCES
  // =============================================================

  /**
   * Load available sources for sorting (rags + incoming bales)
   */
  loadSortableSources(): Observable<SortableSource[]> {
    this._loading.set(true);
    this._error.set(null);

    // Load rags and incoming bales that are ready for sorting
    return forkJoin({
      rags: this.http.get<any>(`${PROCUREMENT_API}/rags`).pipe(
        map((response: any) => response.data || []),
        catchError(() => of([]))
      ),
      bales: this.http.get<any>(`${PROCUREMENT_API}/incoming-bales?hasOpenSession=false`).pipe(
        map((response: any) => response.data || []),
        catchError(() => of([]))
      ),
    }).pipe(
      map(({ rags, bales }) => {
        const sources: SortableSource[] = [];

        // Map rags - convert Decimal strings to numbers
        (rags || []).forEach((rag: any) => {
          sources.push({
            type: 'rag',
            id: rag.id,
            code: rag.ragCode,
            weightKg: typeof rag.weightKg === 'string' ? parseFloat(rag.weightKg) : rag.weightKg,
            description: `RAG ${rag.ragCode} - ${rag.container?.containerNumber || 'No container'}`,
            hasOpenSession: false,
          });
        });

        // Map incoming bales - convert Decimal strings to numbers
        (bales || []).forEach((bale: any) => {
          sources.push({
            type: 'incomingBale',
            id: bale.id,
            code: bale.baleCode,
            weightKg: typeof bale.weightKg === 'string' ? parseFloat(bale.weightKg) : bale.weightKg,
            description: `Bale ${bale.baleCode} - ${bale.categoryGuess || 'Unknown category'}`,
            hasOpenSession: false,
          });
        });

        return sources;
      }),
      tap((sources) => {
        this._sortableSources.set(sources);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // UTILITY
  // =============================================================

  /**
   * Clear current session state
   */
  clearCurrentSession(): void {
    this._currentSession.set(null);
    this._buckets.set([]);
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

    // Log full error for debugging
    console.error('SortingStage1Service Error:', {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      error: error.error,
      url: error.url,
    });

    if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check your connection.';
    } else if (error.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      message = 'Resource not found.';
    } else if (error.status === 409) {
      message = 'A conflict occurred. The resource may have been modified.';
    } else if (error.status >= 500) {
      message = 'Server error. Please try again later.';
    }

    this._error.set(message);
    return throwError(() => new Error(message));
  }
}
