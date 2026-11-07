import type { TenantModule } from '../../core/tenant/tenant.service';
import type { Lang } from '../../core/i18n/i18n.service';

/**
 * Admin Module Models
 * Phase 8: Tenant Administration
 * 
 * TypeScript interfaces for all admin entities.
 * Maps to backend APIs for users, roles, permissions, categories, warehouses, vendors.
 */

// =============================================================

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userRoles?: UserRole[];
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role?: Role;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password?: string;
  roleIds?: string[];
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  isActive?: boolean;
}

// =============================================================
// ROLE & PERMISSION MANAGEMENT
// =============================================================

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  rolePermissions?: RolePermission[];
  _count?: {
    userRoles: number;
  };
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  permission?: Permission;
  createdAt: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  group: string;
}

export interface PermissionGroup {
  name: string;
  permissions: Permission[];
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

// =============================================================
// CATEGORY MANAGEMENT
// =============================================================

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  /** Usual kg of one bale (v2 6.6). */
  baleWeightKg?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  sortOrder?: number;
  baleWeightKg?: number | null;
}

export interface UpdateCategoryRequest {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  baleWeightKg?: number | null;
}

// =============================================================
// GRADE MANAGEMENT
// =============================================================

export interface Grade {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGradeRequest {
  name: string;
  description?: string;
  rank?: number;
}

export interface UpdateGradeRequest {
  name?: string;
  description?: string;
  rank?: number;
  isActive?: boolean;
}

// =============================================================
// WAREHOUSE MANAGEMENT
// =============================================================

export interface Warehouse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  location?: string;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarehouseRequest {
  name: string;
  code: string;
  location?: string;
}

export interface UpdateWarehouseRequest {
  name?: string;
  code?: string;
  location?: string;
  isActive?: boolean;
}

// =============================================================
// VENDOR MANAGEMENT
// =============================================================

export type VendorType =
  | 'SUPPLIER'
  | 'FREIGHT_CARRIER'
  | 'PACKAGING_SUPPLIER'
  | 'EQUIPMENT_VENDOR'
  | 'SERVICE_PROVIDER'
  | 'CUSTOMER'
  | 'SHIPPER'
  | 'CONSIGNEE'
  | 'OTHER';

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  companyName?: string | null;
  vendorType?: VendorType;
  country?: string | null;
  taxId?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactInfo?: string | null;
  paymentTerms?: string | null;
  defaultCurrency?: string | null;
  remittanceAccount?: string | null;
  physicalAddress?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorRequest {
  name: string;
  companyName?: string;
  vendorType?: VendorType;
  country?: string;
  taxId?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactInfo?: string;
  paymentTerms?: string;
  defaultCurrency?: string;
  remittanceAccount?: string;
  physicalAddress?: string;
  notes?: string;
}

export interface UpdateVendorRequest {
  name?: string;
  companyName?: string;
  vendorType?: VendorType;
  country?: string;
  taxId?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactInfo?: string;
  paymentTerms?: string;
  defaultCurrency?: string;
  remittanceAccount?: string;
  physicalAddress?: string;
  notes?: string;
  isActive?: boolean;
}

// =============================================================
// TENANT SETTINGS
// =============================================================

export interface Tenant {
  id: string;
  name: string;
  companyCode: string;
  currencyCode: string;
  currency: {
    code: string;
    symbol: string;
    decimalPlaces: number;
  };
  currencyLocked?: boolean;
  locale: string;
  status: 'ACTIVE' | 'INACTIVE';
  enabledModules?: TenantModule[];
  /** 0 = trading only, 1 = category only, 2 = category + grade. */
  sortingStages?: number;
  defaultLanguage?: Lang;
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

export interface TenantStats {
  users: number;
  roles: number;
  categories: number;
  grades: number;
  warehouses: number;
}

export interface UpdateTenantRequest {
  name?: string;
  currencyCode?: string;
  locale?: string;
  enabledModules?: TenantModule[];
  /** 0 = trading only, 1 = category only, 2 = category + grade. */
  sortingStages?: number;
  defaultLanguage?: Lang;
}

export type { TenantModule };
