/**
 * Settings → Advanced (v2 review: Settings). One simple, translated page per list instead of the old English
 * dashboards: people are on Team, the business on Business; the lists share one page (features/settings).
 */
import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission-guard';

const names = (kind: string, permission: string) => ({
  loadComponent: () => import('../../features/settings/names-list.component').then((m) => m.NamesListComponent),
  title: 'ThriftOS',
  canActivate: [permissionGuard],
  data: { kind, permissions: [permission] },
});
const roles = {
  loadComponent: () => import('../../features/settings/roles.component').then((m) => m.RolesComponent),
  title: 'ThriftOS',
  canActivate: [permissionGuard],
  data: { permissions: ['role.read'] },
};

export const ADMIN_ROUTES: Routes = [
  {
    // Index of the business's master data (enterprise UI pass): every screen below in one place.
    path: '',
    loadComponent: () => import('../../features/workspace-lists/admin-index.component').then((m) => m.AdminIndexComponent),
    title: 'ThriftOS',
  },
  {
    // Bring an old register in from Excel/CSV (v2 6.1), owner only.
    path: 'import',
    loadComponent: () => import('../../features/import/import.component').then((m) => m.ImportComponent),
    title: 'Import - ThriftOS',
    canActivate: [permissionGuard],
    data: { permissions: ['data.import'] },
  },
  { path: 'categories', ...names('categories', 'category.read') },
  { path: 'raw-categories', ...names('raw', 'category.read') },
  { path: 'grades', ...names('grades', 'grade.read') },
  { path: 'waste-categories', ...names('waste', 'category.read') },
  { path: 'warehouses', ...names('warehouses', 'warehouse.read') },
  { path: 'roles', ...roles },
  { path: 'roles/:id', ...roles },
  // Old addresses land on the new pages.
  { path: 'tenant', redirectTo: '/settings/business' },
  { path: 'users', redirectTo: '/settings/team' },
  { path: 'users/new', redirectTo: '/settings/team' },
  { path: 'users/:id/edit', redirectTo: '/settings/team' },
  { path: 'roles/new', redirectTo: 'roles' },
  { path: 'roles/:id/edit', redirectTo: 'roles/:id' },
  { path: 'roles/:id/permissions', redirectTo: 'roles/:id' },
  { path: 'categories/new', redirectTo: 'categories' },
  { path: 'categories/:id/edit', redirectTo: 'categories' },
  { path: 'grades/new', redirectTo: 'grades' },
  { path: 'grades/:id/edit', redirectTo: 'grades' },
  { path: 'warehouses/new', redirectTo: 'warehouses' },
  { path: 'warehouses/:id/edit', redirectTo: 'warehouses' },
  { path: 'waste-categories/new', redirectTo: 'waste-categories' },
  { path: 'waste-categories/:id/edit', redirectTo: 'waste-categories' },
  // Suppliers are added and changed in Suppliers (v2 review); old Settings links land there.
  { path: 'vendors', pathMatch: 'full', redirectTo: '/receive/records/suppliers' },
  { path: 'vendors/new', redirectTo: '/receive/records/suppliers/new' },
  { path: 'vendors/:id/edit', redirectTo: '/receive/records/suppliers/:id/edit' },
];
