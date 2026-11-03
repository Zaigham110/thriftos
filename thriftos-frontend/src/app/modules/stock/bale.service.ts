import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { API_ENDPOINTS } from '../../core/config/api.config';
import { AvailableStock, Bale, MakeBaleRequest, Warehouse } from './bale.models';

/** Finished bales: graded stock in, one sealed bale with QR out. */
@Injectable({ providedIn: 'root' })
export class BaleService {
  private readonly http = inject(HttpClient);

  availableStock(categoryId?: string, gradeId?: string): Observable<AvailableStock[]> {
    let params = new HttpParams();
    if (categoryId) params = params.set('categoryId', categoryId);
    if (gradeId) params = params.set('gradeId', gradeId);
    return this.http.get<AvailableStock[]>(`${API_ENDPOINTS.bales}/available-stock`, { params }).pipe(catchError(toError));
  }

  makeBale(request: MakeBaleRequest): Observable<Bale> {
    return this.http.post<Bale>(API_ENDPOINTS.bales, request).pipe(catchError(toError));
  }

  list(): Observable<Bale[]> {
    return this.http.get<Bale[]>(API_ENDPOINTS.bales).pipe(catchError(toError));
  }

  warehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${API_ENDPOINTS.tenant}/warehouses`).pipe(catchError(() => of([])));
  }
}

function toError(error: any): Observable<never> {
  return throwError(() => new Error(error?.error?.message || error?.message || 'Something went wrong'));
}
