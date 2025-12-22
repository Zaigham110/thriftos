/**
 * Role List Component
 * Phase 8: Tenant Administration
 * 
 * Displays list of roles with create/edit functionality.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shield, Plus, Pencil, Trash2, Search, RefreshCw, Key } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Role } from '../admin.models';
import {
  CardComponent,
  BreadcrumbComponent,
  EmptyStateComponent,
  SkeletonComponent,
  ConfirmDialogComponent,
} from '../../../shared/ui';
import { RoleFormDrawerComponent } from './role-form-drawer';
import { RolePermissionsDrawerComponent } from './role-permissions-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    CardComponent,
    BreadcrumbComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ConfirmDialogComponent,
    RoleFormDrawerComponent,
    RolePermissionsDrawerComponent,
    HasPermissionDirective,
  ],
  templateUrl: './role-list.html',
  styleUrl: './role-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleListComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly icons = {
    Shield,
    Plus,
    Pencil,
    Trash2,
    Search,
    RefreshCw,
    Key,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Roles' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly formDrawerOpen = signal(false);
  readonly permissionsDrawerOpen = signal(false);
  readonly selectedRole = signal<Role | null>(null);
  readonly confirmDeleteOpen = signal(false);
  readonly roleToDelete = signal<Role | null>(null);

  readonly roles = this.adminService.roles;
  readonly permissions = this.adminService.permissions;
  readonly permissionGroups = this.adminService.permissionGroups;

  readonly filteredRoles = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.roles();

    return this.roles().filter(role =>
      role.name.toLowerCase().includes(query) ||
      role.description?.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    
    // Load roles and permissions in parallel
    Promise.all([
      this.adminService.loadRoles().toPromise(),
      this.adminService.loadPermissions().toPromise(),
      this.adminService.loadPermissionsGrouped().toPromise(),
    ]).finally(() => {
      this.loading.set(false);
    });
  }

  refresh(): void {
    this.loadData();
  }

  openAddDrawer(): void {
    this.selectedRole.set(null);
    this.formDrawerOpen.set(true);
  }

  openEditDrawer(role: Role): void {
    this.selectedRole.set(role);
    this.formDrawerOpen.set(true);
  }

  openPermissionsDrawer(role: Role): void {
    this.selectedRole.set(role);
    this.permissionsDrawerOpen.set(true);
  }

  closeFormDrawer(): void {
    this.formDrawerOpen.set(false);
    this.selectedRole.set(null);
  }

  closePermissionsDrawer(): void {
    this.permissionsDrawerOpen.set(false);
    this.selectedRole.set(null);
  }

  onFormSaved(): void {
    this.closeFormDrawer();
    this.refresh();
  }

  onPermissionsSaved(): void {
    this.closePermissionsDrawer();
    this.refresh();
  }

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
      error: (err) => {
        console.error('Failed to delete role:', err);
        this.cancelDelete();
      },
    });
  }

  getPermissionCount(role: Role): number {
    return role.rolePermissions?.length || 0;
  }
}
