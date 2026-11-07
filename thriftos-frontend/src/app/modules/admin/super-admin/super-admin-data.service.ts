import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface SuperAdminKpis {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalWeightKg: string;
  totalSalesAmount: string | null;
  salesByCurrency?: { currency: string; amount: string }[];
}

export interface SystemHealth {
  databaseStatus: string;
  /** How long the API server has been running. */
  uptimeHours: number;
  /** Release tag, e.g. v1.4.0 (null when not set). */
  version: string | null;
  lastAuditAt: string | null;
}

export interface RecentTenantRow {
  id: string;
  name: string;
  companyCode: string;
  status: string;
  currency: string;
  createdAt: string;
  userCount: number;
  warehouseCount: number;
  sortingStages?: number;
}

export interface RecentAuditRow {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userName: string;
  tenantName: string;
  createdAt: string;
  ipAddress?: string;
}

export interface SuperAdminSummary {
  kpis: SuperAdminKpis;
  systemHealth: SystemHealth;
  recentTenants: RecentTenantRow[];
  recentLogs: RecentAuditRow[];
}

export interface GlobalUserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  tenantId: string;
  tenantName: string;
  companyCode: string;
  roles: string[];
}

export interface GlobalAuditRow {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadataJson?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  userName: string;
  tenantName: string;
  companyCode: string;
}

/** Platform name and support contact (kept on the server, v2 review). */
export interface SystemSettings {
  platformName: string;
  supportPhone: string;
  supportEmail: string;
  companyLegalName: string;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminDataService {
  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<SuperAdminSummary> {
    return this.http.get<SuperAdminSummary>(`${API_BASE_URL}/superadmin/summary`);
  }

  getGlobalUsers(page = 1, limit = 20, search?: string): Observable<{ data: GlobalUserRow[]; total: number }> {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<{ data: GlobalUserRow[]; total: number }>(`${API_BASE_URL}/superadmin/users`, { params });
  }

  getGlobalAuditLogs(page = 1, limit = 20, action?: string): Observable<{ data: GlobalAuditRow[]; total: number }> {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (action) params = params.set('action', action);
    return this.http.get<{ data: GlobalAuditRow[]; total: number }>(`${API_BASE_URL}/superadmin/audit-logs`, { params });
  }

  getSettings(): Observable<SystemSettings> {
    return this.http.get<SystemSettings>(`${API_BASE_URL}/superadmin/settings`);
  }

  updateSettings(dto: Partial<SystemSettings>): Observable<SystemSettings> {
    return this.http.patch<SystemSettings>(`${API_BASE_URL}/superadmin/settings`, dto);
  }

  impersonateTenant(tenantId: string): Observable<{ accessToken: string; impersonationToken: string; tenantId: string }> {
    return this.http.post<{ accessToken: string; impersonationToken: string; tenantId: string }>(
      `${API_BASE_URL}/superadmin/tenants/${tenantId}/impersonate`,
      {},
    );
  }
}
