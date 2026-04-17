/**
 * Tenant Detail Page - View tenant details
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TenantsService } from '../tenants';
import { Tenant, TenantStatus } from '../tenant.models';
import { AuthService } from '../../../../../core/auth';
import { TenantFormDrawerComponent } from '../tenant-form-drawer/tenant-form-drawer';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppCardComponent,
  AppDialogComponent,
  AppErrorStateComponent,
  AppLinkComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppStackComponent,
} from '../../../../../shared/ui';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppStackComponent,
    AppLinkComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppCardComponent,
    AppDialogComponent,
    AppErrorStateComponent,
    AppLoadingComponent,
    TenantFormDrawerComponent,
    DatePipe,
  ],
  templateUrl: './tenant-detail.html',
  styleUrl: './tenant-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantDetailComponent implements OnInit {
  protected readonly tenant = signal<Tenant | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly showEditDrawer = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly confirmAction = signal<'activate' | 'deactivate' | 'impersonate' | null>(null);
  protected readonly isActionLoading = signal(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTenant(id);
    }
  }

  loadTenant(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.tenantsService.getTenant(id).subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  openEditDrawer(): void {
    this.showEditDrawer.set(true);
  }

  closeEditDrawer(): void {
    this.showEditDrawer.set(false);
  }

  onDrawerSaved(): void {
    this.closeEditDrawer();
    const tenant = this.tenant();
    if (tenant) {
      this.loadTenant(tenant.id);
    }
  }

  confirmToggleStatus(): void {
    const tenant = this.tenant();
    if (!tenant) return;
    this.confirmAction.set(tenant.status === 'ACTIVE' ? 'deactivate' : 'activate');
    this.showConfirmModal.set(true);
  }

  confirmImpersonate(): void {
    this.confirmAction.set('impersonate');
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
  }

  executeConfirmedAction(): void {
    const tenant = this.tenant();
    const action = this.confirmAction();

    if (!tenant || !action) return;

    this.isActionLoading.set(true);

    if (action === 'activate') {
      this.tenantsService.activateTenant(tenant.id).subscribe({
        next: (updated) => {
          this.tenant.set(updated);
          this.isActionLoading.set(false);
          this.closeConfirmModal();
        },
        error: () => {
          this.isActionLoading.set(false);
        },
      });
    } else if (action === 'deactivate') {
      this.tenantsService.deactivateTenant(tenant.id).subscribe({
        next: (updated) => {
          this.tenant.set(updated);
          this.isActionLoading.set(false);
          this.closeConfirmModal();
        },
        error: () => {
          this.isActionLoading.set(false);
        },
      });
    } else if (action === 'impersonate') {
      this.authService.impersonateTenant(tenant.id).subscribe({
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
    if (action === 'impersonate') return 'Impersonate Tenant';
    return '';
  }

  getConfirmMessage(): string {
    const tenant = this.tenant();
    const action = this.confirmAction();

    if (!tenant) return '';

    if (action === 'activate') {
      return `Are you sure you want to activate "${tenant.name}"?`;
    }
    if (action === 'deactivate') {
      return `Are you sure you want to deactivate "${tenant.name}"?`;
    }
    if (action === 'impersonate') {
      return `You are about to impersonate "${tenant.name}". Are you sure?`;
    }
    return '';
  }

  getConfirmButtonText(): string {
    const action = this.confirmAction();
    if (action === 'activate') return 'Activate';
    if (action === 'deactivate') return 'Deactivate';
    if (action === 'impersonate') return 'Start Impersonation';
    return 'Confirm';
  }

  getConfirmButtonVariant(): 'primary' | 'danger' {
    const action = this.confirmAction();
    if (action === 'deactivate' || action === 'impersonate') return 'danger';
    return 'primary';
  }
}
