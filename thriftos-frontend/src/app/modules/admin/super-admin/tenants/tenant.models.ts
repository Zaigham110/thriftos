/**
 * Tenant Models - Type definitions for tenant management
 */


export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface CurrencyMeta {
  code: string;
  symbol: string;
  decimalPlaces: number;
}

export interface TenantUserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

export interface TenantAuditRow {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userName: string;
  createdAt: string;
  ipAddress?: string;
}

export interface Tenant {
  id: string;
  name: string;
  companyCode: string;
  currencyCode: string;
  currency: CurrencyMeta;
  currencyLocked?: boolean;
  locale: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  users?: TenantUserRow[];
  auditLogs?: TenantAuditRow[];
  /** v2 6.5: newest sign-in or work of the business (support visits do not count). */
  lastActivity?: { at: string; kind: 'sale' | 'payment' | 'container' | 'app' } | null;
  _count?: {
    users: number;
    roles: number;
    categories: number;
    grades: number;
    warehouses: number;
    containers?: number;
  };
}

export interface TenantListResponse {
  data: Tenant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateTenantRequest {
  name: string;
  companyCode: string;
  currencyCode: string;
  locale: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface UpdateTenantRequest {
  name?: string;
  currencyCode?: string;
  locale?: string;
  status?: TenantStatus;
}

export interface TenantBootstrapResult {
  adminUserId: string;
  defaultRoleId: string;
  categoryCount: number;
  gradeCount: number;
}

export interface CreateTenantResponse extends Tenant {
  bootstrap: TenantBootstrapResult;
}
