/**
 * Sorting Stage 2 Service
 * Phase 4: Grading UI
 * 
 * Backend APIs (AUTHORITATIVE):
 * Grade Sessions:
 *   POST   /sorting/stage2/sessions
 *   GET    /sorting/stage2/sessions
 *   GET    /sorting/stage2/sessions/:id
 *   PATCH  /sorting/stage2/sessions/:id
 *   POST   /sorting/stage2/sessions/:id/close
 * 
 * Grade Buckets:
 *   POST   /sorting/stage2/sessions/:id/buckets
 *   PATCH  /sorting/stage2/buckets/:id
 *   DELETE /sorting/stage2/buckets/:id
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, map, forkJoin, of } from 'rxjs';
import {
  GradeSession,
  CreateGradeSessionRequest,
  UpdateGradeSessionRequest,
  GradeSessionListResponse,
  GradeSessionFilters,
  GradeBucket,
  CreateGradeBucketRequest,
  UpdateGradeBucketRequest,
  GradingTotals,
  Grade,
  GradeStatus,
  AvailableForGrading,
  AvailableForGradingResponse,
} from './sorting-stage2.models';
import { API_ENDPOINTS } from '../../core/config/api.config';

const API_BASE = API_ENDPOINTS.sortingStage2;

@Injectable({
  providedIn: 'root',
})
export class SortingStage2Service {
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Session list state
  private readonly _sessions = signal<GradeSession[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _currentPage = signal(1);
  private readonly _totalPages = signal(1);

  // Available for grading state (category outputs from Stage 1)
  private readonly _availableForGrading = signal<AvailableForGrading[]>([]);
  private readonly _availableTotal = signal(0);
  private readonly _availablePage = signal(1);
  private readonly _availableTotalPages = signal(1);

  // Current session state
  private readonly _currentSession = signal<GradeSession | null>(null);
  private readonly _buckets = signal<GradeBucket[]>([]);

  // Grades state (system-defined: G1, G2, G3)
  private readonly _grades = signal<Grade[]>([]);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly availableForGrading = this._availableForGrading.asReadonly();
  readonly availableTotal = this._availableTotal.asReadonly();
  readonly availablePage = this._availablePage.asReadonly();
  readonly availableTotalPages = this._availableTotalPages.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly buckets = this._buckets.asReadonly();
  readonly grades = this._grades.asReadonly();

  // Computed: Grading totals for current session
  readonly gradingTotals = computed<GradingTotals>(() => {
    const session = this._currentSession();
    const buckets = this._buckets();

    if (!session) {
      return {
        totalInputWeight: 0,
        totalGradedWeight: 0,
        totalItemCount: 0,
        wasteWeight: 0,
        yieldPercentage: 0,
      };
    }

    const toNum = (val: any) => typeof val === 'string' ? parseFloat(val) : (val || 0);
    
    const totalInputWeight = toNum(session.categoryOutput?.weightKg);
    const totalGradedWeight = buckets.reduce(
      (sum, b) => sum + toNum(b.outputWeightKg),
      0
    );
    const totalItemCount = buckets.reduce((sum, b) => sum + (b.outputCount || 0), 0);
    const wasteWeight = Math.max(0, totalInputWeight - totalGradedWeight);
    const yieldPercentage = totalInputWeight > 0 
      ? (totalGradedWeight / totalInputWeight) * 100 
      : 0;

    return { totalInputWeight, totalGradedWeight, totalItemCount, wasteWeight, yieldPercentage };
  });

  constructor(private http: HttpClient) {}

  // =============================================================
  // AVAILABLE FOR GRADING (Category outputs from Stage 1)
  // =============================================================

  /**
   * Get category outputs from Stage 1 that are available for grading
   * (outputs that don't have a grading session yet)
   */
  getAvailableForGrading(options?: { page?: number; limit?: number }): Observable<AvailableForGradingResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (options?.page) params = params.set('page', options.page.toString());
    if (options?.limit) params = params.set('limit', options.limit.toString());

    return this.http.get<AvailableForGradingResponse>(
      `${API_ENDPOINTS.sortingStage1}/category-outputs/available-for-grading`,
      { params }
    ).pipe(
      tap((response) => {
        this._availableForGrading.set(response.data);
        this._availableTotal.set(response.total);
        this._availablePage.set(response.page);
        this._availableTotalPages.set(response.totalPages);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  // =============================================================
  // GRADE SESSION OPERATIONS
  // =============================================================

  /**
   * Get all grading sessions with pagination and filters
   */
  getSessions(filters?: GradeSessionFilters): Observable<GradeSessionListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<GradeSessionListResponse>(`${API_BASE}/sessions`, { params }).pipe(
      tap((response) => {
        this._sessions.set(response.data);
        this._totalCount.set(response.total);
        this._currentPage.set(response.page);
        const pageSize = filters?.limit || 20;
        this._totalPages.set(Math.ceil(response.total / pageSize));
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Get single grading session with full details
   */
  getSession(id: string): Observable<GradeSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<GradeSession>(`${API_BASE}/sessions/${id}`).pipe(
      tap((session) => {
        this._currentSession.set(session);
        this._buckets.set(session.gradeBuckets || []);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Create a new grading session (from Stage 1 CategoryOutput)
   */
  createSession(request: CreateGradeSessionRequest): Observable<GradeSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<GradeSession>(`${API_BASE}/sessions`, request).pipe(
      tap((session) => {
        this._currentSession.set(session);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Update grading session (worker/supervisor assignment)
   */
  updateSession(id: string, request: UpdateGradeSessionRequest): Observable<GradeSession> {
    return this.http.patch<GradeSession>(`${API_BASE}/sessions/${id}`, request).pipe(
      tap((session) => {
        this._currentSession.set(session);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Close grading session - creates immutable GradeOutput records
   */
  closeSession(id: string): Observable<GradeSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<GradeSession>(`${API_BASE}/sessions/${id}/close`, {}).pipe(
      tap((session) => {
        this._currentSession.set(session);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  // =============================================================
  // GRADE BUCKET OPERATIONS
  // =============================================================

  /**
   * Add a grade bucket to a session
   */
  createBucket(sessionId: string, request: CreateGradeBucketRequest): Observable<GradeBucket> {
    return this.http
      .post<GradeBucket>(`${API_BASE}/sessions/${sessionId}/buckets`, request)
      .pipe(
        tap((bucket) => {
          const current = this._buckets();
          this._buckets.set([...current, bucket]);
        }),
        catchError((err) => this.handleError(err))
      );
  }

  /**
   * Update a grade bucket
   */
  updateBucket(bucketId: string, request: UpdateGradeBucketRequest): Observable<GradeBucket> {
    return this.http.patch<GradeBucket>(`${API_BASE}/buckets/${bucketId}`, request).pipe(
      tap((updated) => {
        const current = this._buckets();
        this._buckets.set(current.map((b) => (b.id === bucketId ? updated : b)));
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Delete a grade bucket
   */
  deleteBucket(bucketId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/buckets/${bucketId}`).pipe(
      tap(() => {
        const current = this._buckets();
        this._buckets.set(current.filter((b) => b.id !== bucketId));
      }),
      catchError((err) => this.handleError(err))
    );
  }

  // =============================================================
  // GRADES (System-defined)
  // =============================================================

  /**
   * Get all grades for tenant
   */
  getGrades(): Observable<Grade[]> {
    return this.http.get<Grade[]>(`${API_ENDPOINTS.grades}`).pipe(
      tap((grades) => {
        // Sort by rank (G1 = rank 1, G2 = rank 2, etc.)
        const sorted = grades.sort((a, b) => a.rank - b.rank);
        this._grades.set(sorted);
      }),
      catchError((err) => {
        console.error('Failed to load grades:', err);
        this._error.set('Failed to load grades');
        return throwError(() => err);
      })
    );
  }

  // =============================================================
  // STATE MANAGEMENT
  // =============================================================

  /**
   * Clear current session state
   */
  clearCurrentSession(): void {
    this._currentSession.set(null);
    this._buckets.set([]);
    this._error.set(null);
  }

  /**
   * Reset all state
   */
  reset(): void {
    this._sessions.set([]);
    this._totalCount.set(0);
    this._currentPage.set(1);
    this._totalPages.set(1);
    this._currentSession.set(null);
    this._buckets.set([]);
    this._grades.set([]);
    this._error.set(null);
    this._loading.set(false);
  }

  // =============================================================
  // ERROR HANDLING
  // =============================================================

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';

    if (error.error?.message) {
      message = Array.isArray(error.error.message)
        ? error.error.message.join(', ')
        : error.error.message;
    } else if (error.status === 0) {
      message = 'Unable to connect to server';
    } else if (error.status === 401) {
      message = 'Session expired. Please login again.';
    } else if (error.status === 403) {
      message = 'You do not have permission to perform this action';
    } else if (error.status === 404) {
      message = 'Resource not found';
    } else if (error.status === 409) {
      message = error.error?.message || 'Conflict: Resource already exists or is in use';
    }

    this._error.set(message);
    this._loading.set(false);
    return throwError(() => new Error(message));
  }
}
