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
    path: 'users/new',
    loadComponent: () =>
      import('./users/user-form.component').then(
        (m) => m.UserFormComponent
      ),
    title: 'New User - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['user.create'] },
  },
  {
    path: 'users/:id/edit',
    loadComponent: () =>
      import('./users/user-form.component').then(
        (m) => m.UserFormComponent
      ),
    title: 'Edit User - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['user.update'] },
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
    path: 'roles/new',
    loadComponent: () =>
      import('./roles/role-form.component').then(
        (m) => m.RoleFormComponent
      ),
    title: 'New Role - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['role.create'] },
  },
  {
    path: 'roles/:id/edit',
    loadComponent: () =>
      import('./roles/role-form.component').then(
        (m) => m.RoleFormComponent
      ),
    title: 'Edit Role - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['role.update'] },
  },
  {
    path: 'roles/:id/permissions',
    loadComponent: () =>
      import('./roles/role-permissions.component').then(
        (m) => m.RolePermissionsComponent
      ),
    title: 'Role Permissions - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['role.update'] },
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
    path: 'categories/new',
    loadComponent: () =>
      import('./categories/category-form.component').then(
        (m) => m.CategoryFormComponent
      ),
    title: 'New Category - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.create'] },
  },
  {
    path: 'categories/:id/edit',
    loadComponent: () =>
      import('./categories/category-form.component').then(
        (m) => m.CategoryFormComponent
      ),
    title: 'Edit Category - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.update'] },
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
    path: 'grades/new',
    loadComponent: () =>
      import('./grades/grade-form.component').then(
        (m) => m.GradeFormComponent
      ),
    title: 'New Grade - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['grade.create'] },
  },
  {
    path: 'grades/:id/edit',
    loadComponent: () =>
      import('./grades/grade-form.component').then(
        (m) => m.GradeFormComponent
      ),
    title: 'Edit Grade - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['grade.update'] },
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
    path: 'warehouses/new',
    loadComponent: () =>
      import('./warehouses/warehouse-form.component').then(
        (m) => m.WarehouseFormComponent
      ),
    title: 'New Warehouse - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['warehouse.create'] },
  },
  {
    path: 'warehouses/:id/edit',
    loadComponent: () =>
      import('./warehouses/warehouse-form.component').then(
        (m) => m.WarehouseFormComponent
      ),
    title: 'Edit Warehouse - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['warehouse.update'] },
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
    path: 'vendors/new',
    loadComponent: () =>
      import('./vendors/vendor-form.component').then(
        (m) => m.VendorFormComponent
      ),
    title: 'New Vendor - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['vendor.create'] },
  },
  {
    path: 'vendors/:id/edit',
    loadComponent: () =>
      import('./vendors/vendor-form.component').then(
        (m) => m.VendorFormComponent
      ),
    title: 'Edit Vendor - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['vendor.update'] },
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
  {
    path: 'waste-categories/new',
    loadComponent: () =>
      import('./waste-categories/waste-category-form.component').then(
        (m) => m.WasteCategoryFormComponent
      ),
    title: 'New Waste Category - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.create'] },
  },
  {
    path: 'waste-categories/:id/edit',
    loadComponent: () =>
      import('./waste-categories/waste-category-form.component').then(
        (m) => m.WasteCategoryFormComponent
      ),
    title: 'Edit Waste Category - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['category.update'] },
  },
];
