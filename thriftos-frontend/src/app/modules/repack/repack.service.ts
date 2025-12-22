/**
 * Repack Service
 * Phase 5: Repack & QR Code Generation
 * 
 * Backend APIs (AUTHORITATIVE):
 * Repack Sessions:
 *   POST   /repack/sessions
 *   GET    /repack/sessions
 *   GET    /repack/sessions/:id
 *   PATCH  /repack/sessions/:id
 *   POST   /repack/sessions/:id/close
 * 
 * Repack Units:
 *   POST   /repack/sessions/:id/units
 *   GET    /repack/units
 *   GET    /repack/units/:id
 * 
 * QR Labels:
 *   GET    /repack/units/:id/qr
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, forkJoin, of, map } from 'rxjs';
import {
  RepackSession,
  CreateRepackSessionRequest,
  UpdateRepackSessionRequest,
  RepackSessionListResponse,
  RepackSessionFilters,
  RepackUnit,
  CreateRepackUnitRequest,
  RepackUnitListResponse,
  QRLabelResponse,
  RepackTotals,
  RepackSessionStatus,
  Grade,
  Category,
  GradeOutput,
  GradeOutputListResponse,
  RepackItem,
  AddRepackItemRequest,
  AddRepackItemResponse,
  AvailableForRepackSummary,
} from './repack.models';
import { API_ENDPOINTS, API_BASE_URL } from '../../core/config/api.config';

const API_BASE = API_ENDPOINTS.repack;

@Injectable({
  providedIn: 'root',
})
export class RepackService {
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Session list state
  private readonly _sessions = signal<RepackSession[]>([]);
  private readonly _totalCount = signal(0);
  private readonly _currentPage = signal(1);
  private readonly _totalPages = signal(1);

  // Current session state
  private readonly _currentSession = signal<RepackSession | null>(null);
  private readonly _units = signal<RepackUnit[]>([]);

  // Reference data state
  private readonly _grades = signal<Grade[]>([]);
  private readonly _categories = signal<Category[]>([]);

  // Grade outputs available for repack (from Stage 2)
  private readonly _gradeOutputs = signal<GradeOutput[]>([]);
  private readonly _gradeOutputsTotal = signal(0);
  
  // Consumption tracking per grade output
  private readonly _consumptionMap = signal<Map<string, { weightKg: number; pcs: number }>>(new Map());

  // Selected unit for QR preview
  private readonly _selectedUnit = signal<RepackUnit | null>(null);
  private readonly _qrData = signal<QRLabelResponse | null>(null);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly sessions = this._sessions.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly units = this._units.asReadonly();
  readonly grades = this._grades.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly gradeOutputs = this._gradeOutputs.asReadonly();
  readonly gradeOutputsTotal = this._gradeOutputsTotal.asReadonly();
  readonly selectedUnit = this._selectedUnit.asReadonly();
  readonly qrData = this._qrData.asReadonly();

  // Computed: Available grade outputs with consumption data
  readonly availableGradeOutputs = computed<AvailableForRepackSummary[]>(() => {
    const outputs = this._gradeOutputs();
    const consumptionMap = this._consumptionMap();
    
    return outputs.map(output => {
      const totalWeight = this.toNum(output.weightKg);
      const totalPcs = output.count;
      const consumed = consumptionMap.get(output.id) || { weightKg: 0, pcs: 0 };
      
      return {
        gradeOutputId: output.id,
        gradeName: output.grade?.name || 'Unknown',
        categoryName: output.gradeBucket?.gradeSession?.categoryOutput?.category?.name || 'Unknown',
        totalWeightKg: totalWeight,
        consumedWeightKg: consumed.weightKg,
        remainingWeightKg: Math.max(0, totalWeight - consumed.weightKg),
        totalPcs,
        consumedPcs: consumed.pcs,
        remainingPcs: Math.max(0, totalPcs - consumed.pcs),
      };
    });
  });

  // Computed: Repack totals for current session
  readonly repackTotals = computed<RepackTotals>(() => {
    const session = this._currentSession();
    const units = this._units();
    const available = this.availableGradeOutputs();

    if (!session) {
      return {
        totalInputWeight: 0,
        totalRepackedWeight: 0,
        totalPcsCount: 0,
        remainingWeight: 0,
        unitCount: 0,
        totalWeight: 0,
        totalPcs: 0,
        kgBales: 0,
        pcsPacks: 0,
        mixedBales: 0,
      };
    }
    
    // Calculate input weight from grade outputs
    const totalInputWeight = available.reduce((sum, a) => sum + a.totalWeightKg, 0);
    const totalInputPcs = available.reduce((sum, a) => sum + a.totalPcs, 0);
    
    // Calculate repacked amounts from units
    const totalRepackedWeight = units.reduce((sum, u) => sum + this.toNum(u.weightKg), 0);
    const totalPcsCount = units.reduce((sum, u) => sum + (u.pcsCount || 0), 0);
    const remainingWeight = Math.max(0, totalInputWeight - totalRepackedWeight);
    
    const kgBales = units.filter(u => u.unitType === 'KG_BALE').length;
    const pcsPacks = units.filter(u => u.unitType === 'PCS_PACK').length;
    const mixedBales = units.filter(u => u.unitType === 'MIXED_BALE').length;

    return {
      totalInputWeight,
      totalRepackedWeight,
      totalPcsCount,
      remainingWeight,
      unitCount: units.length,
      totalWeight: totalRepackedWeight,
      totalPcs: totalPcsCount,
      kgBales,
      pcsPacks,
      mixedBales,
    };
  });

  // Computed: Session is editable
  readonly isEditable = computed(() => {
    const session = this._currentSession();
    return session?.status === 'OPEN';
  });

  constructor(private http: HttpClient) {}

  private toNum(val: any): number {
    if (typeof val === 'string') return parseFloat(val) || 0;
    return val || 0;
  }

  // =============================================================
  // REPACK SESSION OPERATIONS
  // =============================================================

  /**
   * Get list of repack sessions with optional filters
   */
  getSessions(filters?: RepackSessionFilters): Observable<RepackSessionListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<RepackSessionListResponse>(`${API_BASE}/sessions`, { params }).pipe(
      tap((response) => {
        this._sessions.set(response.data);
        this._totalCount.set(response.total);
        this._currentPage.set(response.page);
        this._totalPages.set(Math.ceil(response.total / response.limit));
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Get single repack session with all relations
   */
  getSession(id: string): Observable<RepackSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<RepackSession>(`${API_BASE}/sessions/${id}`).pipe(
      tap((session) => {
        this._currentSession.set(session);
        this._units.set(session.repackUnits || []);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Create a new repack session
   */
  createSession(dto: CreateRepackSessionRequest): Observable<RepackSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<RepackSession>(`${API_BASE}/sessions`, dto).pipe(
      tap((session) => {
        // Add to list if we have one loaded
        this._sessions.update((list) => [session, ...list]);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Update repack session
   */
  updateSession(id: string, dto: UpdateRepackSessionRequest): Observable<RepackSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<RepackSession>(`${API_BASE}/sessions/${id}`, dto).pipe(
      tap((updated) => {
        if (this._currentSession()?.id === id) {
          this._currentSession.set({ ...this._currentSession()!, ...updated });
        }
        this._sessions.update((list) =>
          list.map((s) => (s.id === id ? { ...s, ...updated } : s))
        );
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Close repack session (marks as CLOSED, units become READY)
   */
  closeSession(id: string): Observable<RepackSession> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<RepackSession>(`${API_BASE}/sessions/${id}/close`, {}).pipe(
      tap((closed) => {
        this._currentSession.set(closed);
        this._sessions.update((list) =>
          list.map((s) => (s.id === id ? closed : s))
        );
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Clear current session state
   */
  clearCurrentSession(): void {
    this._currentSession.set(null);
    this._units.set([]);
    this._selectedUnit.set(null);
    this._qrData.set(null);
    this._gradeOutputs.set([]);
    this._consumptionMap.set(new Map());
  }

  // =============================================================
  // GRADE OUTPUT OPERATIONS (Available for Repack)
  // =============================================================

  /**
   * Get grade outputs from a closed grading session (available for repack)
   */
  getGradeOutputs(gradeSessionId: string, page = 1, limit = 100): Observable<GradeOutputListResponse> {
    let params = new HttpParams()
      .set('gradeSessionId', gradeSessionId)
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<GradeOutputListResponse>(`${API_ENDPOINTS.sortingStage2}/grade-outputs`, { params }).pipe(
      tap((response) => {
        this._gradeOutputs.set(response.data);
        this._gradeOutputsTotal.set(response.total);
        // Calculate consumption from existing repack items
        this.calculateConsumption();
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Get all grade outputs for a specific grade session (for loading available items)
   */
  loadAvailableForRepack(gradeSessionId: string): Observable<GradeOutputListResponse> {
    return this.getGradeOutputs(gradeSessionId);
  }

  /**
   * Calculate consumption from current units' repack items
   */
  private calculateConsumption(): void {
    const units = this._units();
    const consumptionMap = new Map<string, { weightKg: number; pcs: number }>();

    for (const unit of units) {
      if (unit.repackItems) {
        for (const item of unit.repackItems) {
          if (item.sourceType === 'GRADE_OUTPUT') {
            const existing = consumptionMap.get(item.sourceId) || { weightKg: 0, pcs: 0 };
            consumptionMap.set(item.sourceId, {
              weightKg: existing.weightKg + this.toNum(item.weightKg),
              pcs: existing.pcs + item.pcsCount,
            });
          }
        }
      }
    }

    this._consumptionMap.set(consumptionMap);
  }

  // =============================================================
  // REPACK ITEM OPERATIONS (Consuming Grade Output)
  // =============================================================

  /**
   * Add a repack item to a unit (consume from grade output)
   * This is the PROPER way to link grade outputs to repack units with weight tracking
   */
  addItemToUnit(unitId: string, dto: AddRepackItemRequest): Observable<AddRepackItemResponse> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<AddRepackItemResponse>(`${API_BASE}/units/${unitId}/items`, dto).pipe(
      tap((response) => {
        // Update the unit in our local state
        this._units.update((units) =>
          units.map((u) => (u.id === unitId ? response.unit : u))
        );
        // Update consumption tracking
        const consumptionMap = new Map(this._consumptionMap());
        const existing = consumptionMap.get(dto.gradeOutputId) || { weightKg: 0, pcs: 0 };
        consumptionMap.set(dto.gradeOutputId, {
          weightKg: existing.weightKg + dto.weightKg,
          pcs: existing.pcs + dto.pcsCount,
        });
        this._consumptionMap.set(consumptionMap);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Get remaining weight available from a grade output
   */
  getRemainingWeight(gradeOutputId: string): number {
    const output = this._gradeOutputs().find(o => o.id === gradeOutputId);
    if (!output) return 0;
    
    const totalWeight = this.toNum(output.weightKg);
    const consumed = this._consumptionMap().get(gradeOutputId)?.weightKg || 0;
    return Math.max(0, totalWeight - consumed);
  }

  /**
   * Get remaining pcs available from a grade output
   */
  getRemainingPcs(gradeOutputId: string): number {
    const output = this._gradeOutputs().find(o => o.id === gradeOutputId);
    if (!output) return 0;
    
    const totalPcs = output.count;
    const consumed = this._consumptionMap().get(gradeOutputId)?.pcs || 0;
    return Math.max(0, totalPcs - consumed);
  }

  // =============================================================
  // REPACK UNIT OPERATIONS
  // =============================================================

  /**
   * Create a new repack unit within a session
   */
  createUnit(sessionId: string, dto: CreateRepackUnitRequest): Observable<RepackUnit> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<RepackUnit>(`${API_BASE}/sessions/${sessionId}/units`, dto).pipe(
      tap((unit) => {
        // Reload session to get updated units list
        this.getSession(sessionId).subscribe();
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Get units list with optional filters
   */
  getUnits(sessionId?: string, page?: number, limit?: number): Observable<RepackUnitListResponse> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (sessionId) params = params.set('sessionId', sessionId);
    if (page) params = params.set('page', page.toString());
    if (limit) params = params.set('limit', limit.toString());

    return this.http.get<RepackUnitListResponse>(`${API_BASE}/units`, { params }).pipe(
      tap((response) => {
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Get single unit detail
   */
  getUnit(id: string): Observable<RepackUnit> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<RepackUnit>(`${API_BASE}/units/${id}`).pipe(
      tap((unit) => {
        this._selectedUnit.set(unit);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  // =============================================================
  // QR LABEL OPERATIONS
  // =============================================================

  /**
   * Get QR code data for a unit
   */
  getUnitQR(unitId: string): Observable<QRLabelResponse> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<QRLabelResponse>(`${API_BASE}/units/${unitId}/qr`).pipe(
      tap((qrData) => {
        this._qrData.set(qrData);
        this._loading.set(false);
      }),
      catchError((err) => this.handleError(err))
    );
  }

  /**
   * Select a unit for QR preview
   */
  selectUnit(unit: RepackUnit | null): void {
    this._selectedUnit.set(unit);
    if (unit && unit.qrLabel) {
      // If unit has QR label, fetch the full QR data
      this.getUnitQR(unit.id).subscribe();
    } else {
      this._qrData.set(null);
    }
  }

  // =============================================================
  // REFERENCE DATA
  // =============================================================

  /**
   * Get grades for dropdown
   * Grades are fetched from tenant endpoint
   */
  getGrades(): Observable<Grade[]> {
    return this.http.get<Grade[]>(`${API_BASE_URL}/tenant/grades`).pipe(
      tap((grades) => {
        this._grades.set(grades || []);
      }),
      catchError((err) => {
        console.error('Failed to load grades:', err);
        return of([]);
      })
    );
  }

  /**
   * Get categories for dropdown
   * Categories are fetched from tenant endpoint, not sorting/stage1
   */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_BASE_URL}/tenant/categories`).pipe(
      tap((categories) => {
        this._categories.set(categories || []);
      }),
      catchError((err) => {
        console.error('Failed to load categories:', err);
        return of([]);
      })
    );
  }

  /**
   * Load reference data for dropdowns
   */
  loadReferenceData(): Observable<[Grade[], Category[]]> {
    return forkJoin([
      this.getGrades(),
      this.getCategories(),
    ]);
  }

  // =============================================================
  // ERROR HANDLING
  // =============================================================

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';

    if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 401) {
      message = 'Session expired. Please log in again.';
    } else if (error.status === 403) {
      message = 'You do not have permission for this action.';
    } else if (error.status === 404) {
      message = 'Resource not found.';
    } else if (error.status === 409) {
      message = error.error?.message || 'Conflict: resource already exists or is locked.';
    } else if (error.status === 0) {
      message = 'Network error. Please check your connection.';
    }

    this._error.set(message);
    this._loading.set(false);

    return throwError(() => new Error(message));
  }
}
