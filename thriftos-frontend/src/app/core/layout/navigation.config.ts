/**
 * Navigation Configuration - Defines menu structure and permission requirements
 * Phase 1: Authentication & Shell
 */

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  permissions?: string[];
  superAdminOnly?: boolean;
  children?: NavItem[];
  expanded?: boolean;
}

export const SUPER_ADMIN_NAV: NavItem[] = [
  {
    id: 'admin',
    label: 'Administration',
    icon: 'settings',
    expanded: true,
    children: [
      {
        id: 'super-admin',
        label: 'Super Admin',
        icon: 'shield',
        superAdminOnly: true,
        children: [
          {
            id: 'tenants',
            label: 'Tenants',
            icon: 'building-2',
            route: '/admin/super/tenants',
            superAdminOnly: true,
          },
        ],
      },
    ],
  },
];

export const TENANT_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'layout-dashboard',
    route: '/app/dashboard',
  },
  // Procurement (Phase 2)
  {
    id: 'procurement',
    label: 'Procurement',
    icon: 'shopping-cart',
    permissions: ['po.read'],
    children: [
      {
        id: 'procurement-dashboard',
        label: 'Overview',
        icon: 'layout-dashboard',
        route: '/app/procurement',
        permissions: ['po.read'],
      },
      {
        id: 'purchase-orders',
        label: 'Purchase Orders',
        icon: 'file-text',
        route: '/app/procurement/purchase-orders',
        permissions: ['po.read'],
      },
      {
        id: 'containers',
        label: 'Containers',
        icon: 'container',
        route: '/app/procurement/containers',
        permissions: ['container.read'],
      },
      {
        id: 'incoming-bales',
        label: 'Incoming Bales',
        icon: 'package',
        route: '/app/procurement/incoming-bales',
        permissions: ['po.read'],
      },
    ],
  },
  // Sorting (Phase 3 & 4)
  {
    id: 'sorting',
    label: 'Sorting',
    icon: 'layers',
    permissions: ['SORTING_STAGE1_VIEW'],
    children: [
      {
        id: 'sorting-rags',
        label: 'Rags & Bales',
        icon: 'package',
        route: '/app/sorting/stage1/rags',
        permissions: ['SORTING_STAGE1_VIEW'],
      },
      {
        id: 'sorting-stage1',
        label: 'Stage 1: Categories',
        icon: 'boxes',
        route: '/app/sorting/stage1',
        permissions: ['SORTING_STAGE1_VIEW'],
      },
      {
        id: 'sorting-stage2',
        label: 'Stage 2: Grading',
        icon: 'star',
        route: '/app/sorting/stage2',
        permissions: ['SORTING_STAGE2_VIEW'],
      },
    ],
  },
  // Repack (Phase 5)
  {
    id: 'repack',
    label: 'Repack',
    icon: 'package-plus',
    permissions: ['REPACK_VIEW'],
    children: [
      {
        id: 'repack-sessions',
        label: 'Sessions',
        icon: 'list',
        route: '/app/repack',
        permissions: ['REPACK_VIEW'],
      },
    ],
  },
  // Inventory (Phase 6)
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'warehouse',
    permissions: ['INVENTORY_VIEW'],
    children: [
      {
        id: 'inventory-dashboard',
        label: 'Dashboard',
        icon: 'layout-dashboard',
        route: '/app/inventory',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'inventory-items',
        label: 'Items',
        icon: 'package',
        route: '/app/inventory/items',
        permissions: ['INVENTORY_VIEW'],
      },
    ],
  },
  // Reports (Phase 7)
  {
    id: 'reports',
    label: 'Reports',
    icon: 'bar-chart-3',
    permissions: ['REPORTS_VIEW'],
    children: [
      {
        id: 'reports-dashboard',
        label: 'Overview',
        icon: 'layout-dashboard',
        route: '/app/reports',
        permissions: ['REPORTS_VIEW'],
      },
      {
        id: 'yield-report',
        label: 'Yield Report',
        icon: 'trending-up',
        route: '/app/reports/yield',
        permissions: ['REPORTS_VIEW'],
      },
      {
        id: 'waste-report',
        label: 'Waste Report',
        icon: 'trash-2',
        route: '/app/reports/waste',
        permissions: ['REPORTS_VIEW'],
      },
      {
        id: 'inventory-report',
        label: 'Inventory Report',
        icon: 'package',
        route: '/app/reports/inventory',
        permissions: ['REPORTS_VIEW'],
      },
      {
        id: 'procurement-report',
        label: 'Procurement Report',
        icon: 'dollar-sign',
        route: '/app/reports/procurement',
        permissions: ['REPORTS_VIEW'],
      },
    ],
  },
  // Administration (Phase 8)
  {
    id: 'admin',
    label: 'Administration',
    icon: 'settings',
    permissions: ['user.read'],
    children: [
      {
        id: 'admin-tenant',
        label: 'Tenant Settings',
        icon: 'building-2',
        route: '/app/admin/tenant',
        permissions: ['user.read'],
      },
      {
        id: 'admin-users',
        label: 'Users',
        icon: 'users',
        route: '/app/admin/users',
        permissions: ['user.read'],
      },
      {
        id: 'admin-roles',
        label: 'Roles',
        icon: 'shield',
        route: '/app/admin/roles',
        permissions: ['role.read'],
      },
      {
        id: 'admin-categories',
        label: 'Categories',
        icon: 'layers',
        route: '/app/admin/categories',
        permissions: ['category.read'],
      },
      {
        id: 'admin-raw-categories',
        label: 'Raw Categories',
        icon: 'package',
        route: '/app/admin/raw-categories',
        permissions: ['category.read'],
      },
      {
        id: 'admin-grades',
        label: 'Grades',
        icon: 'star',
        route: '/app/admin/grades',
        permissions: ['grade.read'],
      },
      {
        id: 'admin-warehouses',
        label: 'Warehouses',
        icon: 'warehouse',
        route: '/app/admin/warehouses',
        permissions: ['warehouse.read'],
      },
      {
        id: 'admin-vendors',
        label: 'Vendors',
        icon: 'store',
        route: '/app/admin/vendors',
        permissions: ['vendor.read'],
      },
    ],
  },
];

/**
 * Get navigation items based on user role
 */
export function getNavigation(isSuperAdmin: boolean, isImpersonating: boolean): NavItem[] {
  if (isSuperAdmin && !isImpersonating) {
    return SUPER_ADMIN_NAV;
  }
  return TENANT_NAV;
}
