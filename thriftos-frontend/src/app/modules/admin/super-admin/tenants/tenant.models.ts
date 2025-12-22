/**
 * Tenant Models - Type definitions for tenant management
 * Phase 1: Authentication & Shell
 */

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Tenant {
  id: string;
  name: string;
  companyCode: string;
  currency: string;
  locale: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    roles: number;
    categories: number;
    grades: number;
    warehouses: number;
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
  currency: string;
  locale: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface UpdateTenantRequest {
  name?: string;
  currency?: string;
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
