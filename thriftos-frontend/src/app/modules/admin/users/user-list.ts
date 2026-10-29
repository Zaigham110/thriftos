/**
 * User List Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/users
 * 
 * Displays all tenant users with rich KPI stats, search, filters, inline slide-over management, and security controls.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  KeyRound,
  Ban,
  CheckCircle2,
  X,
  Filter,
} from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth';
import { AdminService } from '../admin.service';
import { User, Role } from '../admin.models';
import { UserFormDrawerComponent } from './user-form-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
} from '../../../shared/ui';

export type StatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
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
    UserFormDrawerComponent,
    HasPermissionDirective,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly users = this.adminService.users;
  readonly roles = this.adminService.roles;
  readonly loading = this.adminService.loading;
  readonly error = this.adminService.error;
  readonly currentUserId = signal(this.authService.user()?.id);

  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('ALL');

  // Drawer state
  readonly isDrawerOpen = signal(false);
  readonly selectedUserForEdit = signal<User | null>(null);

  // Status toggle modal state
  readonly confirmDialogOpen = signal(false);
  readonly userToToggle = signal<User | null>(null);

  // Reset password state
  readonly resetDialogOpen = signal(false);
  readonly resetUser = signal<User | null>(null);
  readonly tempPassword = signal<string | null>(null);
  readonly resetMessage = signal<string | null>(null);

  readonly icons = {
    Users,
    UserCheck,
    UserX,
    Shield,
    Search,
    Plus,
    RefreshCw,
    Pencil,
    KeyRound,
    Ban,
    CheckCircle2,
    X,
    Filter,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/settings/admin' },
    { label: 'User Management' },
  ];

  // KPI Calculations
  readonly totalUsersCount = computed(() => this.users().length);
  readonly activeUsersCount = computed(() => this.users().filter((u) => u.isActive).length);
  readonly blockedUsersCount = computed(() => this.users().filter((u) => !u.isActive).length);
  readonly totalRolesCount = computed(() => this.roles().length);

  get filteredUsers(): User[] {
    let list = this.users();

    if (this.statusFilter() === 'ACTIVE') {
      list = list.filter((u) => u.isActive);
    } else if (this.statusFilter() === 'BLOCKED') {
      list = list.filter((u) => !u.isActive);
    }

    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter((u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.userRoles?.some((ur) => ur.role?.name.toLowerCase().includes(query))
      );
    }

    return list;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.adminService.loadUsers(true).subscribe();
    this.adminService.loadRoles().subscribe();
  }

  clearError(): void {
    this.adminService.clearError();
  }

  refresh(): void {
    this.loadData();
  }

  setFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  // Drawer handlers
  openCreateDrawer(): void {
    this.selectedUserForEdit.set(null);
    this.isDrawerOpen.set(true);
  }

  openEditDrawer(user: User): void {
    this.selectedUserForEdit.set(user);
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.selectedUserForEdit.set(null);
  }

  onUserSaved(): void {
    this.closeDrawer();
    this.loadData();
  }

  // Deactivation handlers
  confirmToggleStatus(user: User): void {
    if (user.id === this.currentUserId()) return;
    this.userToToggle.set(user);
    this.confirmDialogOpen.set(true);
  }

  cancelToggle(): void {
    this.confirmDialogOpen.set(false);
    this.userToToggle.set(null);
  }

  executeToggleStatus(): void {
    const user = this.userToToggle();
    if (!user) return;

    const action = user.isActive
      ? this.adminService.deleteUser(user.id)
      : this.adminService.unblockUser(user.id);

    action.subscribe({
      next: () => {
        this.confirmDialogOpen.set(false);
        this.userToToggle.set(null);
        this.loadData();
      },
    });
  }

  // Reset password handlers
  promptResetPassword(user: User): void {
    this.resetUser.set(user);
    this.tempPassword.set(null);
    this.resetMessage.set(null);
    this.resetDialogOpen.set(true);
  }

  executeResetPassword(): void {
    const user = this.resetUser();
    if (!user) return;

    this.adminService.resetUserPassword(user.id).subscribe({
      next: (res: { success: boolean; temporaryPassword?: string; message: string }) => {
        this.tempPassword.set(res.temporaryPassword || 'Reset completed');
        this.resetMessage.set(res.message);
      },
    });
  }

  closeResetDialog(): void {
    this.resetDialogOpen.set(false);
    this.resetUser.set(null);
    this.tempPassword.set(null);
    this.resetMessage.set(null);
  }

  // Avatar helper
  getUserInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Role style color helper
  getRoleBadgeClass(roleName: string): string {
    const r = roleName.toLowerCase();
    if (r.includes('admin')) return 'badge-role-admin';
    if (r.includes('manager') || r.includes('supervisor')) return 'badge-role-manager';
    if (r.includes('sorting') || r.includes('grading')) return 'badge-role-ops';
    return 'badge-role-default';
  }

  isSelf(user: User): boolean {
    return user.id === this.currentUserId();
  }
}
