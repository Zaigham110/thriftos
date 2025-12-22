/**
 * Role Permissions Drawer Component
 * Phase 8: Tenant Administration
 * 
 * Drawer for assigning permissions to a role using grouped permission matrix.
 */

import { ChangeDetectionStrategy, Component, input, output, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, Save, Loader2, Check, ChevronDown, ChevronRight } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Role, PermissionGroup } from '../admin.models';
import { DrawerComponent, AlertComponent } from '../../../shared/ui';

@Component({
  selector: 'app-role-permissions-drawer',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    DrawerComponent,
    AlertComponent,
  ],
  templateUrl: './role-permissions-drawer.html',
  styleUrl: './role-permissions-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsDrawerComponent {
  private readonly adminService = inject(AdminService);

  readonly isOpen = input<boolean>(false);
  readonly role = input<Role | null>(null);
  readonly permissionGroups = input<PermissionGroup[]>([]);

  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly icons = {
    X,
    Save,
    Loader2,
    Check,
    ChevronDown,
    ChevronRight,
  };

  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedPermissions = signal<Set<string>>(new Set());
  readonly expandedGroups = signal<Set<string>>(new Set());

  constructor() {
    // Watch for role changes to reset selected permissions
    effect(() => {
      const currentRole = this.role();
      if (currentRole) {
        const permissionIds = currentRole.rolePermissions?.map(rp => rp.permissionId) || [];
        this.selectedPermissions.set(new Set(permissionIds));
        
        // Expand all groups by default
        const groups = this.permissionGroups();
        this.expandedGroups.set(new Set(groups.map(g => g.name)));
      } else {
        this.selectedPermissions.set(new Set());
      }
      this.formError.set(null);
    });
  }

  get title(): string {
    return this.role() ? `Permissions: ${this.role()!.name}` : 'Permissions';
  }

  readonly selectedCount = computed(() => this.selectedPermissions().size);
  
  readonly totalCount = computed(() => {
    return this.permissionGroups().reduce((acc, g) => acc + g.permissions.length, 0);
  });

  isExpanded(groupName: string): boolean {
    return this.expandedGroups().has(groupName);
  }

  toggleGroup(groupName: string): void {
    this.expandedGroups.update(groups => {
      const newGroups = new Set(groups);
      if (newGroups.has(groupName)) {
        newGroups.delete(groupName);
      } else {
        newGroups.add(groupName);
      }
      return newGroups;
    });
  }

  isPermissionSelected(permissionId: string): boolean {
    return this.selectedPermissions().has(permissionId);
  }

  togglePermission(permissionId: string): void {
    this.selectedPermissions.update(perms => {
      const newPerms = new Set(perms);
      if (newPerms.has(permissionId)) {
        newPerms.delete(permissionId);
      } else {
        newPerms.add(permissionId);
      }
      return newPerms;
    });
  }

  isGroupFullySelected(group: PermissionGroup): boolean {
    return group.permissions.every(p => this.selectedPermissions().has(p.id));
  }

  isGroupPartiallySelected(group: PermissionGroup): boolean {
    const selected = group.permissions.filter(p => this.selectedPermissions().has(p.id));
    return selected.length > 0 && selected.length < group.permissions.length;
  }

  toggleGroupAll(group: PermissionGroup): void {
    this.selectedPermissions.update(perms => {
      const newPerms = new Set(perms);
      if (this.isGroupFullySelected(group)) {
        // Deselect all in group
        group.permissions.forEach(p => newPerms.delete(p.id));
      } else {
        // Select all in group
        group.permissions.forEach(p => newPerms.add(p.id));
      }
      return newPerms;
    });
  }

  selectAll(): void {
    this.selectedPermissions.update(() => {
      const allPerms = new Set<string>();
      this.permissionGroups().forEach(g => {
        g.permissions.forEach(p => allPerms.add(p.id));
      });
      return allPerms;
    });
  }

  deselectAll(): void {
    this.selectedPermissions.set(new Set());
  }

  close(): void {
    this.closed.emit();
  }

  onSave(): void {
    const role = this.role();
    if (!role) return;

    this.saving.set(true);
    this.formError.set(null);

    const permissionIds = Array.from(this.selectedPermissions());

    this.adminService.assignRolePermissions(role.id, permissionIds).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.message || 'Failed to assign permissions');
      },
    });
  }

  getGroupSelectedCount(group: PermissionGroup): number {
    return group.permissions.filter(p => this.selectedPermissions().has(p.id)).length;
  }
}
