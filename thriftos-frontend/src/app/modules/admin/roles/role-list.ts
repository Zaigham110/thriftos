/**
 * Role List Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/roles
 * 
 * Displays tenant roles, assigned users count, permission matrix, and role actions.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Shield,
  Users,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Sliders,
  CheckCircle2,
  X,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import type { Role, PermissionGroup } from '../admin.models';
import { RoleFormDrawerComponent } from './role-form-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
    RoleFormDrawerComponent,
    HasPermissionDirective,
  ],
  templateUrl: './role-list.html',
  styleUrl: './role-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleListComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly breadcrumbs = [
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Roles & Permissions' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly error = this.adminService.error;

  // Drawer state
  readonly isRoleDrawerOpen = signal(false);
  readonly selectedRoleForEdit = signal<Role | null>(null);

  // Delete modal state
  readonly confirmDeleteOpen = signal(false);
  readonly roleToDelete = signal<Role | null>(null);

  readonly roles = this.adminService.roles;
  readonly permissionGroups = this.adminService.permissionGroups;

  readonly icons = {
    Shield,
    Users,
    Key,
    Lock,
    Plus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Sliders,
    CheckCircle2,
    X,
  };

  // KPI Calculations
  readonly totalRolesCount = computed(() => this.roles().length);
  readonly totalAssignedUsersCount = computed(() =>
    this.roles().reduce((acc, r) => acc + (r._count?.userRoles ?? 0), 0)
  );
  readonly totalPermissionsCount = computed(() => {
    const groups = this.permissionGroups();
    if (!Array.isArray(groups)) return 0;
    return groups.reduce((acc, g) => acc + (g?.permissions?.length || 0), 0);
  });

  readonly filteredRoles = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.roles();

    return this.roles().filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    this.adminService.loadRoles().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });

    this.adminService.loadPermissionsGrouped().subscribe();
  }

  refresh(): void {
    this.loadData();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearError(): void {
    this.adminService.clearError();
  }

  // Role Form Drawer Handlers
  openCreateRoleDrawer(): void {
    this.selectedRoleForEdit.set(null);
    this.isRoleDrawerOpen.set(true);
  }

  openEditRoleDrawer(role: Role): void {
    this.selectedRoleForEdit.set(role);
    this.isRoleDrawerOpen.set(true);
  }

  closeRoleDrawer(): void {
    this.isRoleDrawerOpen.set(false);
    this.selectedRoleForEdit.set(null);
  }

  onRoleSaved(): void {
    this.closeRoleDrawer();
    this.refresh();
  }

  // Full page Role Permissions Navigation
  openPermissionsDrawer(role: Role): void {
    this.router.navigate(['/settings/admin/roles', role.id, 'permissions']);
  }

  // Delete Handlers
  confirmDelete(role: Role): void {
    this.roleToDelete.set(role);
    this.confirmDeleteOpen.set(true);
  }

  cancelDelete(): void {
    this.confirmDeleteOpen.set(false);
    this.roleToDelete.set(null);
  }

  deleteRole(): void {
    const role = this.roleToDelete();
    if (!role) return;

    this.adminService.deleteRole(role.id).subscribe({
      next: () => {
        this.cancelDelete();
        this.refresh();
      },
      error: () => {
        this.cancelDelete();
      },
    });
  }

  hasAssignedUsers(role: Role): boolean {
    return (role._count?.userRoles ?? 0) > 0;
  }
}
