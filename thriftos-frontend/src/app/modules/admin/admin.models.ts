/**
 * Admin Module Models
 * Phase 8: Tenant Administration
 * 
 * TypeScript interfaces for all admin entities.
 * Maps to backend APIs for users, roles, permissions, categories, warehouses, vendors.
 */

// =============================================================
// USER MANAGEMENT
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
  password: string;
  roleIds?: string[];
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
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
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
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
}

// =============================================================
// VENDOR MANAGEMENT
// =============================================================

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  country?: string;
  contactInfo?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorRequest {
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  country?: string;
  contactInfo?: string;
}

export interface UpdateVendorRequest {
  name?: string;
  country?: string;
  contactInfo?: string;
  isActive?: boolean;
}

// =============================================================
// TENANT SETTINGS
// =============================================================

export interface Tenant {
  id: string;
  name: string;
  companyCode: string;
  currency: string;
  locale: string;
  status: 'ACTIVE' | 'INACTIVE';
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

// Note: Tenant updates are limited - no status/billing changes allowed here
export interface UpdateTenantRequest {
  name?: string;
  currency?: string;
  locale?: string;
}
