/**
 * Admin Service - API client for tenant administration
 * Phase 8: Tenant Administration
 * 
 * Backend APIs (AUTHORITATIVE):
 * Users:
 *   POST   /users                    - Create user
 *   GET    /users                    - List users
 *   GET    /users/:id                - Get user
 *   PATCH  /users/:id                - Update user
 *   PATCH  /users/:id/block          - Block user
 *   PATCH  /users/:id/unblock        - Unblock user
 *   POST   /users/:id/roles/bulk     - Assign roles
 * 
 * Roles:
 *   POST   /roles                    - Create role
 *   GET    /roles                    - List roles
 *   GET    /roles/:id                - Get role
 *   PATCH  /roles/:id                - Update role
 *   DELETE /roles/:id                - Delete role
 *   POST   /roles/:id/permissions/bulk - Assign permissions
 * 
 * Permissions:
 *   GET    /permissions              - List all permissions
 *   GET    /permissions/grouped      - List permissions by group
 * 
 * Grades:
 *   POST   /sorting/grades           - Create grade
 *   GET    /sorting/grades           - List active grades
 *   GET    /sorting/grades/all       - List all grades (admin)
 *   GET    /sorting/grades/:id       - Get grade
 *   PATCH  /sorting/grades/:id       - Update grade
 *   DELETE /sorting/grades/:id       - Delete grade
 * 
 * Tenant:
 *   GET    /tenant                   - Get current tenant
 *   GET    /tenant/categories        - List categories
 *   GET    /tenant/grades            - List grades (active only)
 *   GET    /tenant/warehouses        - List warehouses
 *   GET    /tenant/stats             - Get stats
 * 
 * Vendors:
 *   POST   /procurement/vendors      - Create vendor
 *   GET    /procurement/vendors      - List vendors
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, of } from 'rxjs';
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  Permission,
  PermissionGroup,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  Grade,
  CreateGradeRequest,
  UpdateGradeRequest,
  Warehouse,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  Vendor,
  CreateVendorRequest,
  UpdateVendorRequest,
  Tenant,
  TenantStats,
} from './admin.models';
import { API_ENDPOINTS, API_BASE_URL } from '../../core/config/api.config';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly adminBaseUrl = `${API_BASE_URL}/admin`;
  // Loading states
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // User state
  private readonly _users = signal<User[]>([]);
  
  // Role state
  private readonly _roles = signal<Role[]>([]);
  
  // Permission state
  private readonly _permissions = signal<Permission[]>([]);
  private readonly _permissionGroups = signal<PermissionGroup[]>([]);
  
  // Category state
  private readonly _categories = signal<Category[]>([]);
  
  // Grade state
  private readonly _grades = signal<Grade[]>([]);
  
  // Warehouse state
  private readonly _warehouses = signal<Warehouse[]>([]);
  
  // Vendor state
  private readonly _vendors = signal<Vendor[]>([]);
  
  // Tenant state
  private readonly _tenant = signal<Tenant | null>(null);
  private readonly _tenantStats = signal<TenantStats | null>(null);

  // Public readonly selectors
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly users = this._users.asReadonly();
  readonly roles = this._roles.asReadonly();
  readonly permissions = this._permissions.asReadonly();
  readonly permissionGroups = this._permissionGroups.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly grades = this._grades.asReadonly();
  readonly warehouses = this._warehouses.asReadonly();
  readonly vendors = this._vendors.asReadonly();
  readonly tenant = this._tenant.asReadonly();
  readonly tenantStats = this._tenantStats.asReadonly();

  // Computed values
  readonly activeUsers = computed(() => this._users().filter(u => u.isActive));
  readonly activeCategories = computed(() => this._categories().filter(c => c.isActive));
  readonly activeGrades = computed(() => this._grades().filter(g => g.isActive));
  readonly activeVendors = computed(() => this._vendors().filter(v => v.isActive));

  constructor(private readonly http: HttpClient) {}

  // =============================================================
  // ERROR HANDLING
  // =============================================================

  clearError(): void {
    this._error.set(null);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to perform this action';
    } else if (error.status === 404) {
      errorMessage = 'Resource not found';
    } else if (error.status === 409) {
      errorMessage = 'A conflict occurred. The resource may already exist.';
    }
    
    this._error.set(errorMessage);
    this._loading.set(false);
    return throwError(() => new Error(errorMessage));
  }

  // =============================================================
  // USERS
  // =============================================================

  loadUsers(includeInactive = true): Observable<User[]> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (includeInactive) {
      params = params.set('includeInactive', 'true');
    }

    return this.http.get<User[]>(`${this.adminBaseUrl}/users`, { params }).pipe(
      tap((users) => {
        this._users.set(users);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.adminBaseUrl}/users/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  createUser(data: CreateUserRequest): Observable<User> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<User>(`${this.adminBaseUrl}/users`, data).pipe(
      tap((user) => {
        this._users.update((users) => [...users, user]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<User> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<User>(`${this.adminBaseUrl}/users/${id}`, data).pipe(
      tap((user) => {
        this._users.update((users) => users.map((u) => (u.id === id ? user : u)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  blockUser(id: string): Observable<User> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<User>(`${this.adminBaseUrl}/users/${id}/block`, {}).pipe(
      tap((user) => {
        this._users.update((users) => users.map((u) => (u.id === id ? user : u)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  unblockUser(id: string): Observable<User> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<User>(`${this.adminBaseUrl}/users/${id}/unblock`, {}).pipe(
      tap((user) => {
        this._users.update((users) => users.map((u) => (u.id === id ? user : u)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteUser(id: string): Observable<User> {
    this._loading.set(true);
    this._error.set(null);

    // Backend performs soft-deactivation for users.
    return this.http.delete<User>(`${this.adminBaseUrl}/users/${id}`).pipe(
      tap((user) => {
        this._users.update((users) => users.map((u) => (u.id === id ? user : u)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  assignUserRoles(userId: string, roleIds: string[]): Observable<User> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<User>(`${this.adminBaseUrl}/users/${userId}/roles/bulk`, { roleIds }).pipe(
      tap((user) => {
        this._users.update((users) => users.map((u) => (u.id === userId ? user : u)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // ROLES
  // =============================================================

  loadRoles(): Observable<Role[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<Role[]>(`${this.adminBaseUrl}/roles`).pipe(
      tap((roles) => {
        this._roles.set(roles);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getRole(id: string): Observable<Role> {
    return this.http.get<Role>(`${this.adminBaseUrl}/roles/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  createRole(data: CreateRoleRequest): Observable<Role> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Role>(`${this.adminBaseUrl}/roles`, data).pipe(
      tap((role) => {
        this._roles.update((roles) => [...roles, role]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateRole(id: string, data: UpdateRoleRequest): Observable<Role> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Role>(`${this.adminBaseUrl}/roles/${id}`, data).pipe(
      tap((role) => {
        this._roles.update((roles) => roles.map((r) => (r.id === id ? role : r)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteRole(id: string): Observable<void> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete<void>(`${this.adminBaseUrl}/roles/${id}`).pipe(
      tap(() => {
        this._roles.update((roles) => roles.filter((r) => r.id !== id));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  assignRolePermissions(roleId: string, permissionIds: string[]): Observable<Role> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Role>(`${this.adminBaseUrl}/roles/${roleId}/permissions/bulk`, { permissionIds }).pipe(
      tap((role) => {
        this._roles.update((roles) => roles.map((r) => (r.id === roleId ? role : r)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // PERMISSIONS
  // =============================================================

  loadPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.adminBaseUrl}/permissions`).pipe(
      tap((perms) => this._permissions.set(perms)),
      catchError((error) => this.handleError(error))
    );
  }

  loadPermissionsGrouped(): Observable<PermissionGroup[]> {
    return this.http.get<PermissionGroup[]>(`${this.adminBaseUrl}/permissions/grouped`).pipe(
      tap((groups) => this._permissionGroups.set(groups)),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // CATEGORIES
  // =============================================================

  loadCategories(): Observable<Category[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<Category[]>(`${this.adminBaseUrl}/categories`).pipe(
      tap((categories) => {
        this._categories.set(categories);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getCategory(id: string): Observable<Category> {
    return this.http.get<Category>(`${this.adminBaseUrl}/categories/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  createCategory(data: CreateCategoryRequest): Observable<Category> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Category>(`${this.adminBaseUrl}/categories`, data).pipe(
      tap((category) => {
        this._categories.update((categories) => [...categories, category]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateCategory(id: string, data: UpdateCategoryRequest): Observable<Category> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Category>(`${this.adminBaseUrl}/categories/${id}`, data).pipe(
      tap((category) => {
        this._categories.update((categories) =>
          categories.map((c) => (c.id === id ? category : c))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteCategory(id: string): Observable<unknown> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete(`${this.adminBaseUrl}/categories/${id}`).pipe(
      tap(() => {
        this._categories.update((categories) => categories.filter((c) => c.id !== id));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // GRADES
  // =============================================================

  loadGrades(includeInactive = true): Observable<Grade[]> {
    this._loading.set(true);
    this._error.set(null);

    // Admin endpoint always returns all grades
    void includeInactive;

    return this.http.get<Grade[]>(`${this.adminBaseUrl}/grades`).pipe(
      tap((grades) => {
        this._grades.set(grades);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getGrade(id: string): Observable<Grade> {
    return this.http.get<Grade>(`${this.adminBaseUrl}/grades/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  createGrade(data: CreateGradeRequest): Observable<Grade> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Grade>(`${this.adminBaseUrl}/grades`, data).pipe(
      tap((grade) => {
        this._grades.update((grades) => [...grades, grade]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateGrade(id: string, data: UpdateGradeRequest): Observable<Grade> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Grade>(`${this.adminBaseUrl}/grades/${id}`, data).pipe(
      tap((grade) => {
        this._grades.update((grades) => grades.map((g) => (g.id === id ? grade : g)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteGrade(id: string): Observable<void> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete<void>(`${this.adminBaseUrl}/grades/${id}`).pipe(
      tap(() => {
        this._grades.update((grades) => grades.filter((g) => g.id !== id));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // WAREHOUSES
  // =============================================================

  loadWarehouses(): Observable<Warehouse[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<Warehouse[]>(`${this.adminBaseUrl}/warehouses`).pipe(
      tap((warehouses) => {
        this._warehouses.set(warehouses);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getWarehouse(id: string): Observable<Warehouse> {
    return this.http.get<Warehouse>(`${this.adminBaseUrl}/warehouses/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  createWarehouse(data: CreateWarehouseRequest): Observable<Warehouse> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Warehouse>(`${this.adminBaseUrl}/warehouses`, data).pipe(
      tap((warehouse) => {
        this._warehouses.update((warehouses) => [...warehouses, warehouse]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  updateWarehouse(id: string, data: UpdateWarehouseRequest): Observable<Warehouse> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Warehouse>(`${this.adminBaseUrl}/warehouses/${id}`, data).pipe(
      tap((warehouse) => {
        this._warehouses.update((warehouses) =>
          warehouses.map((w) => (w.id === id ? warehouse : w))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteWarehouse(id: string): Observable<unknown> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete(`${this.adminBaseUrl}/warehouses/${id}`).pipe(
      tap(() => {
        this._warehouses.update((warehouses) => warehouses.filter((w) => w.id !== id));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  setDefaultWarehouse(id: string): Observable<{ warehouseId: string }> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<{ warehouseId: string }>(`${this.adminBaseUrl}/warehouses/${id}/default`, {}).pipe(
      tap(({ warehouseId }) => {
        this._warehouses.update((warehouses) =>
          warehouses.map((w) => ({ ...w, isDefault: w.id === warehouseId }))
        );
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // VENDORS
  // =============================================================

  loadVendors(includeInactive = true): Observable<Vendor[]> {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (includeInactive) {
      params = params.set('includeInactive', 'true');
    }

    return this.http.get<Vendor[]>(`${this.adminBaseUrl}/vendors`, { params }).pipe(
      tap((vendors) => {
        this._vendors.set(vendors);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  createVendor(data: CreateVendorRequest): Observable<Vendor> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.post<Vendor>(`${this.adminBaseUrl}/vendors`, data).pipe(
      tap((vendor) => {
        this._vendors.update((vendors) => [...vendors, vendor]);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  getVendor(id: string): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.adminBaseUrl}/vendors/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  updateVendor(id: string, data: UpdateVendorRequest): Observable<Vendor> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Vendor>(`${this.adminBaseUrl}/vendors/${id}`, data).pipe(
      tap((vendor) => {
        this._vendors.update((vendors) => vendors.map((v) => (v.id === id ? vendor : v)));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  deleteVendor(id: string): Observable<unknown> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.delete(`${this.adminBaseUrl}/vendors/${id}`).pipe(
      tap(() => {
        this._vendors.update((vendors) => vendors.filter((v) => v.id !== id));
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // =============================================================
  // TENANT
  // =============================================================

  loadTenant(): Observable<Tenant> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<Tenant>(`${API_BASE_URL}/tenant`).pipe(
      tap((tenant) => {
        this._tenant.set(tenant);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  loadTenantStats(): Observable<TenantStats> {
    return this.http.get<TenantStats>(`${API_BASE_URL}/tenant/stats`).pipe(
      tap((stats) => this._tenantStats.set(stats)),
      catchError((error) => this.handleError(error))
    );
  }

  updateTenantSettings(data: { currencyCode?: string; locale?: string }): Observable<Tenant> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.patch<Tenant>(`${API_BASE_URL}/tenant/settings`, data).pipe(
      tap((tenant) => {
        this._tenant.set(tenant);
        this._loading.set(false);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  // Note: Tenant update endpoint would need to be added to backend
  // Tenant settings supports currency/locale updates
}
