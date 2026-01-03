/**
 * Admin Routes
 * Phase 8: Tenant Administration
 * 
 * Route Structure:
 * /app/admin                   - Redirect to tenant settings
 * /app/admin/tenant            - Tenant profile & settings
 * /app/admin/users             - User management
 * /app/admin/roles             - Role & permission management
 * /app/admin/categories        - Category management (sorting output)
 * /app/admin/raw-categories    - Raw category management (procurement input)
 * /app/admin/grades            - Grade management
 * /app/admin/warehouses        - Warehouse management
 * /app/admin/vendors           - Vendor management
 * /app/admin/config            - Configuration settings
 */

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'tenant',
    pathMatch: 'full',
  },
  {
    path: 'tenant',
    loadComponent: () =>
      import('./tenant/tenant-settings').then(
        (m) => m.TenantSettingsComponent
      ),
    title: 'Tenant Settings - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['user.read'] }, // Basic admin permission
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./users/user-list').then(
        (m) => m.UserListComponent
      ),
    title: 'User Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['user.read'] },
  },
  {
    path: 'roles',
    loadComponent: () =>
      import('./roles/role-list').then(
        (m) => m.RoleListComponent
      ),
    title: 'Role Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['role.read'] },
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/category-management').then(
        (m) => m.CategoryManagementComponent
      ),
    title: 'Category Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.read'] },
  },
  {
    path: 'raw-categories',
    loadComponent: () =>
      import('./raw-categories/raw-category-management').then(
        (m) => m.RawCategoryManagementComponent
      ),
    title: 'Raw Category Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.read'] },
  },
  {
    path: 'grades',
    loadComponent: () =>
      import('./grades/grade-management').then(
        (m) => m.GradeManagementComponent
      ),
    title: 'Grade Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['grade.read'] },
  },
  {
    path: 'warehouses',
    loadComponent: () =>
      import('./warehouses/warehouse-management').then(
        (m) => m.WarehouseManagementComponent
      ),
    title: 'Warehouse Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['warehouse.read'] },
  },
  {
    path: 'vendors',
    loadComponent: () =>
      import('./vendors/vendor-management').then(
        (m) => m.VendorManagementComponent
      ),
    title: 'Vendor Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['vendor.read'] },
  },
  {
    path: 'waste-categories',
    loadComponent: () =>
      import('./waste-categories/waste-category-list.component').then(
        (m) => m.WasteCategoryListComponent
      ),
    title: 'Waste Category Management - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.read'] },
  },
];
