import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../admin.service';
import type { Role } from '../admin.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppStackComponent,
  AppLoadingComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
  type DataTableColumn,
} from '../../../shared/ui';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppStackComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
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
    { label: 'Administration', route: '/app/admin' },
    { label: 'Roles' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly confirmDeleteOpen = signal(false);
  readonly roleToDelete = signal<Role | null>(null);

  readonly roles = this.adminService.roles;

  readonly tableColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'users', label: 'Users', sortable: true, getValue: (row) => String((row as Role)._count?.userRoles ?? 0) },
    { key: 'permissions', label: 'Permissions', getValue: (row) => String((row as Role).rolePermissions?.length ?? 0) },
    { key: 'createdAt', label: 'Created', sortable: true },
  ];

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

    this.adminService.loadRoles().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }

  createRole(): void {
    this.router.navigate(['/app/admin/roles/new']);
  }

  editRole(role: Role): void {
    this.router.navigate(['/app/admin/roles', role.id, 'edit']);
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

  getCreatedDate(role: Role): string {
    return role.createdAt;
  }
}
