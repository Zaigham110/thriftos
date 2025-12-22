/**
 * Tenants List Page - Super Admin tenant management list view
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, Plus, Eye, Pencil, UserCog, Power, PowerOff, RefreshCw } from 'lucide-angular';
import { TenantsService } from '../tenants';
import { Tenant, TenantStatus } from '../tenant.models';
import { AuthService } from '../../../../../core/auth';
import { ButtonComponent } from '../../../../../shared/ui/button/button';
import { BadgeComponent } from '../../../../../shared/ui/badge/badge';
import { CardComponent } from '../../../../../shared/ui/card/card';
import { AlertComponent } from '../../../../../shared/ui/alert/alert';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton/skeleton';
import { ModalComponent } from '../../../../../shared/ui/modal/modal';
import { TenantFormDrawerComponent } from '../tenant-form-drawer/tenant-form-drawer';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LucideAngularModule,
    ButtonComponent,
    BadgeComponent,
    CardComponent,
    AlertComponent,
    SkeletonComponent,
    ModalComponent,
    TenantFormDrawerComponent,
    DatePipe,
  ],
  templateUrl: './tenants-list.html',
  styleUrl: './tenants-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantsListComponent implements OnInit {
  protected readonly icons = {
    Plus,
    Eye,
    Pencil,
    UserCog,
    Power,
    PowerOff,
    RefreshCw,
  };

  // UI State
  protected readonly showDrawer = signal(false);
  protected readonly editingTenant = signal<Tenant | null>(null);
  protected readonly showConfirmModal = signal(false);
  protected readonly confirmAction = signal<'activate' | 'deactivate' | 'impersonate' | null>(null);
  protected readonly selectedTenant = signal<Tenant | null>(null);
  protected readonly isActionLoading = signal(false);

  constructor(
    protected readonly tenantsService: TenantsService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.tenantsService.loadTenants({ page: 1, limit: 20 }).subscribe();
  }

  openCreateDrawer(): void {
    this.editingTenant.set(null);
    this.showDrawer.set(true);
  }

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

  getStatusBadgeType(status: TenantStatus): 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'warning';
      case 'SUSPENDED':
        return 'danger';
      default:
        return 'info';
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
      return `You are about to impersonate "${tenant.name}". You will have full access to this tenant's data. Are you sure?`;
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
