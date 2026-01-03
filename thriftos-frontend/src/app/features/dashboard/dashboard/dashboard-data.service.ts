import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface DashboardCategoryYieldRow {
  categoryId: string;
  inputWeightKg: string;
  outputWeightKg: string;
  wasteWeightKg: string;
  yieldPct: string;
}

export interface DashboardTrendPoint {
  bucket: string;
  value: string;
}

export interface DashboardSummary {
  range: { startDate: string; endDate: string };
  previousRange: { startDate: string; endDate: string };
  kpis: {
    procurementCost: { value: string; change?: string; sparkline: number[] };
    sortedWeightKg: { value: string; change?: string; sparkline: number[] };
    yieldPct: { value: string; change?: string; sparkline: number[] };
    wastePct: { value: string; change?: string; sparkline: number[] };
  };
  analytics: {
    sortedVolumeTrend: DashboardTrendPoint[];
    categoryYield: DashboardCategoryYieldRow[];
  };
  generatedAt: string;
}

export interface ReportEnvelope<T> {
  data: T;
}

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  workerId?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  constructor(private readonly http: HttpClient) {}

  getSummary(filters: DashboardFilters): Observable<ReportEnvelope<DashboardSummary>> {
    return this.http.get<ReportEnvelope<DashboardSummary>>(`${API_BASE_URL}/reports/dashboard/summary`, {
      params: this.toParams(filters),
    });
  }

  private toParams(filters: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.workerId) params = params.set('workerId', filters.workerId);
    return params;
  }
}
