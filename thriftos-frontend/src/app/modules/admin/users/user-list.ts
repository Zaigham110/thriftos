/**
 * User List Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/users
 * 
 * Displays all tenant users with management actions.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../admin.service';
import { User, Role } from '../admin.models';
import { UserFormDrawerComponent } from './user-form-drawer';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppBadgeComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppStackComponent,
  AppDialogComponent,
  type DataTableColumn,
} from '../../../shared/ui';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppBadgeComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppStackComponent,
    AppDialogComponent,
    UserFormDrawerComponent,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly users = this.adminService.users;
  readonly roles = this.adminService.roles;
  readonly loading = this.adminService.loading;
  readonly error = this.adminService.error;

  readonly searchQuery = signal('');
  readonly showInactive = signal(true);
  readonly drawerOpen = signal(false);
  readonly selectedUser = signal<User | null>(null);
  readonly confirmDialogOpen = signal(false);
  readonly userToToggle = signal<User | null>(null);

  readonly breadcrumbs = [
    { label: 'Administration', link: '/admin' },
    { label: 'Users', link: undefined },
  ];

  readonly tableColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'roles', label: 'Roles', getValue: (row) => this.getUserRoles(row as User) },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'createdAt', label: 'Created', sortable: true },
  ];

  get filteredUsers(): User[] {
    let users = this.users();
    
    if (!this.showInactive()) {
      users = users.filter(u => u.isActive);
    }
    
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      users = users.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
      );
    }
    
    return users;
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

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  toggleShowInactive(): void {
    this.showInactive.update(v => !v);
  }

  openCreateDrawer(): void {
    this.selectedUser.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(user: User): void {
    this.selectedUser.set(user);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedUser.set(null);
  }

  onUserSaved(): void {
    this.closeDrawer();
    this.loadData();
  }

  confirmToggleStatus(user: User): void {
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
      ? this.adminService.blockUser(user.id)
      : this.adminService.unblockUser(user.id);

    action.subscribe({
      next: () => {
        this.confirmDialogOpen.set(false);
        this.userToToggle.set(null);
      },
    });
  }

  getUserRoles(user: User): string {
    if (!user.userRoles || user.userRoles.length === 0) {
      return 'No roles';
    }
    return user.userRoles.map(ur => ur.role?.name || 'Unknown').join(', ');
  }

  statusVariant(isActive: boolean): 'success' | 'default' {
    return isActive ? 'success' : 'default';
  }

  getStatusLabel(isActive: boolean): string {
    return isActive ? 'Active' : 'Blocked';
  }

  editUser(user: User): void {
    this.openEditDrawer(user);
  }

  toggleStatus(user: User): void {
    this.confirmToggleStatus(user);
  }
}
