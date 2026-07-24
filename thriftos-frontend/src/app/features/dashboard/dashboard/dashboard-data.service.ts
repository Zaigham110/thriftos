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

export interface ExecutiveOverview {
  inTransitContainersCount: number;
  weighbridgeVarianceAlertsCount: number;
  blockedCustomersCount: number;
  availableInventoryKg: string;
  availableInventoryUnitsCount: number;
}

export interface MaterialBalanceFlow {
  intakeKg: string;
  sortedKg: string;
  gradedKg: string;
  repackedKg: string;
  shippedKg: string;
}

export interface OperatorLeaderboardRow {
  workerId: string;
  workerName: string;
  sessionCount: number;
  totalInputKg: string;
  totalOutputKg: string;
  avgKgPerHour: string;
}

export interface ContainerAuditRow {
  id: string;
  containerNumber: string;
  shippingLine: string | null;
  status: string;
  netWeightKg: string;
  scaleNetKg: string | null;
  varianceKg: string;
  variancePct: string;
  varianceAlertStatus: string;
  forwarder?: string | null;
  billOfLadingNumber?: string | null;
}

export interface CustomerRiskRow {
  id: string;
  name: string;
  companyName: string | null;
  creditLimit: string;
  creditStatus: string;
  paymentTerms: string;
  unpaidBalance?: string;
}

export interface InventoryGradeRow {
  gradeName: string;
  categoryName: string;
  totalWeightKg: string;
  unitCount: number;
}

export interface DashboardSummary {
  range: { startDate: string; endDate: string };
  previousRange: { startDate: string; endDate: string };
  kpis: {
    salesRevenue: { value: string; change?: string; sparkline: number[] };
    procurementCost: { value: string; change?: string; sparkline: number[] };
    netOperationalMargin: { value: string; change?: string; sparkline: number[] };
    sortedWeightKg: { value: string; change?: string; sparkline: number[] };
    yieldPct: { value: string; change?: string; sparkline: number[] };
    wastePct: { value: string; change?: string; sparkline: number[] };
  };
  materialBalanceFlow?: MaterialBalanceFlow;
  executiveOverview: ExecutiveOverview;
  operatorLeaderboard: OperatorLeaderboardRow[];
  containerAudits: ContainerAuditRow[];
  customerRisks: CustomerRiskRow[];
  inventoryGrades: InventoryGradeRow[];
  analytics: {
    salesRevenueTrend: DashboardTrendPoint[];
    procurementCostTrend: DashboardTrendPoint[];
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
