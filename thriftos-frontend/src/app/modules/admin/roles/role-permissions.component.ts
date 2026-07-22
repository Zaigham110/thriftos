/**
 * Role Permissions Component - Dedicated Full Page Permission Matrix
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/roles/:id/permissions
 * 
 * Dedicated full-page view for managing granular permissions matrix for a role.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideAngularModule,
  Shield,
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Key,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import type { Role, PermissionGroup, Permission } from '../admin.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './role-permissions.component.html',
  styleUrl: './role-permissions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly roleId = signal<string | null>(null);
  readonly role = signal<Role | null>(null);
  readonly permissionGroups = this.adminService.permissionGroups;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedPermissions = signal<Set<string>>(new Set());
  readonly expandedGroups = signal<Set<string>>(new Set());

  readonly icons = {
    Shield,
    ArrowLeft,
    Save,
    Loader2,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CheckSquare,
    Square,
    Key,
  };

  readonly breadcrumbs = computed(() => [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Roles', route: '/app/admin/roles' },
    { label: this.role() ? `Permissions: ${this.role()!.name}` : 'Permissions' },
  ]);

  readonly selectedCount = computed(() => this.selectedPermissions().size);

  readonly totalCount = computed(() => {
    const groups = this.permissionGroups();
    if (!Array.isArray(groups)) return 0;
    return groups.reduce((acc, g) => acc + (g?.permissions?.length || 0), 0);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.roleId.set(id);
      this.loadData(id);
    } else {
      this.router.navigate(['/app/admin/roles']);
    }
  }

  loadData(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    // Fetch role details & permission groups
    this.adminService.getRole(id).subscribe({
      next: (roleData) => {
        this.role.set(roleData);
        const assignedIds = roleData.rolePermissions?.map((rp) => rp.permissionId) || [];
        this.selectedPermissions.set(new Set(assignedIds));

        // Load grouped permissions
        this.adminService.loadPermissionsGrouped().subscribe({
          next: (groups) => {
            if (Array.isArray(groups)) {
              this.expandedGroups.set(new Set(groups.map((g) => g.name)));
            }
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err.message || 'Failed to load permission groups');
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load role details');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/app/admin/roles']);
  }

  isExpanded(groupName: string): boolean {
    return this.expandedGroups().has(groupName);
  }

  toggleGroupExpand(groupName: string): void {
    this.expandedGroups.update((groups) => {
      const updated = new Set(groups);
      if (updated.has(groupName)) {
        updated.delete(groupName);
      } else {
        updated.add(groupName);
      }
      return updated;
    });
  }

  isPermissionSelected(permissionId: string): boolean {
    return this.selectedPermissions().has(permissionId);
  }

  togglePermission(permissionId: string): void {
    this.selectedPermissions.update((perms) => {
      const updated = new Set(perms);
      if (updated.has(permissionId)) {
        updated.delete(permissionId);
      } else {
        updated.add(permissionId);
      }
      return updated;
    });
  }

  isGroupFullySelected(group: PermissionGroup): boolean {
    if (!group.permissions || group.permissions.length === 0) return false;
    return group.permissions.every((p) => this.selectedPermissions().has(p.id));
  }

  isGroupPartiallySelected(group: PermissionGroup): boolean {
    if (!group.permissions || group.permissions.length === 0) return false;
    const count = group.permissions.filter((p) => this.selectedPermissions().has(p.id)).length;
    return count > 0 && count < group.permissions.length;
  }

  toggleGroupAll(group: PermissionGroup, event: Event): void {
    event.stopPropagation();
    this.selectedPermissions.update((perms) => {
      const updated = new Set(perms);
      if (this.isGroupFullySelected(group)) {
        group.permissions.forEach((p) => updated.delete(p.id));
      } else {
        group.permissions.forEach((p) => updated.add(p.id));
      }
      return updated;
    });
  }

  selectAll(): void {
    this.selectedPermissions.update(() => {
      const all = new Set<string>();
      this.permissionGroups().forEach((g) => {
        g.permissions.forEach((p) => all.add(p.id));
      });
      return all;
    });
  }

  deselectAll(): void {
    this.selectedPermissions.set(new Set());
  }

  getGroupSelectedCount(group: PermissionGroup): number {
    return group.permissions.filter((p) => this.selectedPermissions().has(p.id)).length;
  }

  savePermissions(): void {
    const id = this.roleId();
    if (!id) return;

    this.saving.set(true);
    this.error.set(null);

    const permissionIds = Array.from(this.selectedPermissions());

    this.adminService.assignRolePermissions(id, permissionIds).subscribe({
      next: () => {
        this.saving.set(false);
        this.goBack();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.message || 'Failed to update role permissions');
      },
    });
  }
}
