/**
 * Tenants List Page - Super Admin tenant management list view
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TenantsService } from '../tenants';
import { Tenant, TenantStatus } from '../tenant.models';
import { AuthService } from '../../../../../core/auth';
import { TenantFormDrawerComponent } from '../tenant-form-drawer/tenant-form-drawer';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppDataTableComponent,
  type DataTableColumn,
  type DataTableState,
  AppDialogComponent,
  AppDropdownComponent,
  type DropdownItem,
  AppErrorStateComponent,
  AppIconComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
} from '../../../../../shared/ui';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppDataTableComponent,
    AppDialogComponent,
    AppDropdownComponent,
    AppIconComponent,
    AppErrorStateComponent,
    TenantFormDrawerComponent,
    DatePipe,
  ],
  templateUrl: './tenants-list.html',
  styleUrl: './tenants-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantsListComponent implements OnInit {
  // UI State
  protected readonly showDrawer = signal(false);
  protected readonly editingTenant = signal<Tenant | null>(null);
  protected readonly showConfirmModal = signal(false);
  protected readonly confirmAction = signal<'activate' | 'deactivate' | 'impersonate' | null>(null);
  protected readonly selectedTenant = signal<Tenant | null>(null);
  protected readonly isActionLoading = signal(false);

  private readonly lastServerQuery = signal<{ page: number; limit: number; status?: TenantStatus } | null>(null);

  protected readonly columns: DataTableColumn[] = [
    {
      key: 'name',
      label: 'Company',
      sortable: true,
      getValue: (row) => (row as Tenant).name,
    },
    {
      key: 'companyCode',
      label: 'Code',
      sortable: true,
      getValue: (row) => (row as Tenant).companyCode,
    },
    {
      key: 'currencyCode',
      label: 'Currency',
      sortable: true,
      getValue: (row) => (row as Tenant).currencyCode,
      width: '110',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'ACTIVE', label: 'ACTIVE' },
        { value: 'INACTIVE', label: 'INACTIVE' },
        { value: 'SUSPENDED', label: 'SUSPENDED' },
      ],
      getValue: (row) => (row as Tenant).status,
      width: '140',
    },
    {
      key: 'lastActivity',
      label: 'Last activity',
      getValue: (row) => (row as Tenant).lastActivity?.at ?? '',
      width: '200',
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      getValue: (row) => (row as Tenant).createdAt,
      width: '140',
    },
  ];

  constructor(
    protected readonly tenantsService: TenantsService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    const query = { page: 1, limit: 20 };
    this.lastServerQuery.set(query);
    this.tenantsService.loadTenants(query).subscribe();
  }

  onTableStateChange(state: DataTableState): void {
    const status = (state.filters?.['status'] ?? '').trim() as TenantStatus | '';
    const statusFilter: TenantStatus | undefined =
      status === 'ACTIVE' || status === 'INACTIVE' || status === 'SUSPENDED' ? status : undefined;

    const nextQuery = {
      page: state.pageIndex,
      limit: state.pageSize,
      status: statusFilter,
    };

    const prevQuery = this.lastServerQuery();
    const unchanged =
      prevQuery &&
      prevQuery.page === nextQuery.page &&
      prevQuery.limit === nextQuery.limit &&
      (prevQuery.status ?? undefined) === (nextQuery.status ?? undefined);

    if (unchanged) return;

    this.lastServerQuery.set(nextQuery);

    this.tenantsService
      .loadTenants({
        page: nextQuery.page,
        limit: nextQuery.limit,
        status: nextQuery.status,
      })
      .subscribe();
  }

  rowActionItems(tenant: Tenant): DropdownItem[] {
    return [
      { label: 'View', value: 'view' },
      { label: 'Edit', value: 'edit' },
      { label: tenant.status === 'ACTIVE' ? 'Deactivate' : 'Activate', value: 'toggle' },
      { label: 'Open support view (read-only)', value: 'impersonate', disabled: tenant.status !== 'ACTIVE' },
    ];
  }

  onRowAction(tenant: Tenant, action: string): void {
    if (action === 'view') return void this.router.navigate(['/admin/tenants', tenant.id]);
    if (action === 'edit') return void this.router.navigate(['/admin/tenants', tenant.id, 'edit']);
    if (action === 'toggle') return this.confirmToggleStatus(tenant);
    if (action === 'impersonate') return this.confirmImpersonate(tenant);
  }

  onRowClick(tenant: Tenant): void {
    void this.router.navigate(['/admin/tenants', tenant.id]);
  }

  openCreateDrawer(): void {
    void this.router.navigate(['/admin/tenants', 'quick']);
  }

  /** Why support is opening the business; kept in the audit log. */
  protected supportReason = '';

  protected readonly activityLabel = activityLabel;

  openEditDrawer(tenant: Tenant): void {
    this.editingTenant.set(tenant);
    this.showDrawer.set(true);
  }

  closeDrawer(): void {
    this.showDrawer.set(false);
    this.editingTenant.set(null);
  }

  onDrawerSaved(): void {
    this.closeDrawer();
    this.loadTenants();
  }

  confirmToggleStatus(tenant: Tenant): void {
    this.selectedTenant.set(tenant);
    this.confirmAction.set(tenant.status === 'ACTIVE' ? 'deactivate' : 'activate');
    this.showConfirmModal.set(true);
  }

  confirmImpersonate(tenant: Tenant): void {
    this.selectedTenant.set(tenant);
    this.confirmAction.set('impersonate');
    this.supportReason = '';
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
    this.selectedTenant.set(null);
  }

  executeConfirmedAction(): void {
    const tenant = this.selectedTenant();
    const action = this.confirmAction();

    if (!tenant || !action) return;

    this.isActionLoading.set(true);

    if (action === 'activate') {
      this.tenantsService.activateTenant(tenant.id).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeConfirmModal();
        },
        error: () => {
          this.isActionLoading.set(false);
        },
      });
    } else if (action === 'deactivate') {
      this.tenantsService.deactivateTenant(tenant.id).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeConfirmModal();
        },
        error: () => {
          this.isActionLoading.set(false);
        },
      });
    } else if (action === 'impersonate') {
      this.authService.impersonateTenant(tenant.id, { reason: this.supportReason.trim() || undefined, name: tenant.name }).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeConfirmModal();
        },
        error: () => {
          this.isActionLoading.set(false);
        },
      });
    }
  }

  getStatusBadgeType(status: TenantStatus): 'success' | 'warning' | 'danger' | 'default' {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'warning';
      case 'SUSPENDED':
        return 'danger';
      default:
        return 'default';
    }
  }

  getConfirmTitle(): string {
    const action = this.confirmAction();
    if (action === 'activate') return 'Activate Tenant';
    if (action === 'deactivate') return 'Deactivate Tenant';
    if (action === 'impersonate') return 'Open support view';
    return '';
  }

  getConfirmMessage(): string {
    const tenant = this.selectedTenant();
    const action = this.confirmAction();

    if (!tenant) return '';

    if (action === 'activate') {
      return `Are you sure you want to activate "${tenant.name}"? This will allow users to access the tenant.`;
    }
    if (action === 'deactivate') {
      return `Are you sure you want to deactivate "${tenant.name}"? Users will not be able to access the tenant.`;
    }
    if (action === 'impersonate') {
      return `You will see "${tenant.name}" as its owner does, read-only: nothing can be changed. Opening it and every page you look at are recorded in the audit log.`;
    }
    return '';
  }

  getConfirmButtonText(): string {
    const action = this.confirmAction();
    if (action === 'activate') return 'Activate';
    if (action === 'deactivate') return 'Deactivate';
    if (action === 'impersonate') return 'Open read-only';
    return 'Confirm';
  }

  getConfirmButtonVariant(): 'primary' | 'danger' {
    const action = this.confirmAction();
    if (action === 'deactivate') return 'danger';
    return 'primary';
  }
}

/** "Today 5:12 pm · sale", "3 days ago · signed in", "No activity yet". */
export function activityLabel(last: Tenant['lastActivity'], now = new Date()): string {
  if (!last) return 'No activity yet';
  const at = new Date(last.at);
  const what = { sale: 'sale', payment: 'payment', container: 'container', app: 'used the app' }[last.kind];
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const when = days <= 0 ? `Today ${time}` : days === 1 ? `Yesterday ${time}` : days < 30 ? `${days} days ago` : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${when} · ${what}`;
}
