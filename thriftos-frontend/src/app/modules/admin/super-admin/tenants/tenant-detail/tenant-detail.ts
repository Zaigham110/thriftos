/**
 * Tenant Detail Page - View & manage tenant details, users, and audit trail
 */

import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { activityLabel } from '../tenants-list/tenants-list';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TenantsService } from '../tenants';
import { Tenant, TenantStatus } from '../tenant.models';
import { AuthService } from '../../../../../core/auth';
import { AdminService } from '../../../admin.service';
import { TenantFormDrawerComponent } from '../tenant-form-drawer/tenant-form-drawer';
import {
  LucideAngularModule,
  Building2,
  Users,
  Warehouse,
  Container,
  Layers,
  Tag,
  Shield,
  KeyRound,
  Eye,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-angular';

import {
  AppBadgeComponent,
  AppButtonComponent,
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
  AppGridComponent,
  AppKpiCardComponent,
} from '../../../../../shared/ui';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LucideAngularModule,
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
    AppDialogComponent,
    AppErrorStateComponent,
    AppLoadingComponent,
    AppGridComponent,
    AppKpiCardComponent,
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

  // User Reset Password State
  protected readonly resetUser = signal<{ id: string; name: string; email: string } | null>(null);
  protected readonly tempPassword = signal<string | null>(null);
  protected readonly resettingPassword = signal(false);

  readonly icons = {
    Building2,
    Users,
    Warehouse,
    Container,
    Layers,
    Tag,
    Shield,
    KeyRound,
    Eye,
    RefreshCw,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Lock,
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tenantsService: TenantsService,
    private readonly authService: AuthService,
    private readonly adminService: AdminService
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
    const t = this.tenant();
    if (t) {
      void this.router.navigate(['/admin/tenants', t.id, 'edit']);
    }
  }

  closeEditDrawer(): void {
    this.showEditDrawer.set(false);
  }

  onDrawerSaved(): void {
    this.closeEditDrawer();
    const current = this.tenant();
    if (current) {
      this.loadTenant(current.id);
    }
  }

  confirmToggleStatus(): void {
    const t = this.tenant();
    if (!t) return;
    this.confirmAction.set(t.status === 'ACTIVE' ? 'deactivate' : 'activate');
    this.showConfirmModal.set(true);
  }

  /** Why support is opening the business; kept in the audit log. */
  protected supportReason = '';
  protected readonly activityLabel = activityLabel;

  confirmImpersonate(): void {
    this.supportReason = '';
    this.confirmAction.set('impersonate');
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
  }

  executeConfirmedAction(): void {
    const t = this.tenant();
    const action = this.confirmAction();
    if (!t || !action) return;

    this.isActionLoading.set(true);

    if (action === 'activate') {
      this.tenantsService.activateTenant(t.id).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeConfirmModal();
          this.loadTenant(t.id);
        },
        error: () => this.isActionLoading.set(false),
      });
    } else if (action === 'deactivate') {
      this.tenantsService.deactivateTenant(t.id).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeConfirmModal();
          this.loadTenant(t.id);
        },
        error: () => this.isActionLoading.set(false),
      });
    } else if (action === 'impersonate') {
      this.authService.impersonateTenant(t.id, { reason: this.supportReason.trim() || undefined, name: t.name }).subscribe({
        next: () => {
          this.isActionLoading.set(false);
          this.closeConfirmModal();
        },
        error: () => this.isActionLoading.set(false),
      });
    }
  }

  resetUserPassword(user: { id: string; name: string; email: string }): void {
    this.resetUser.set(user);
    this.tempPassword.set(null);
    this.resettingPassword.set(true);

    this.adminService.resetUserPassword(user.id).subscribe({
      next: (res: any) => {
        this.resettingPassword.set(false);
        this.tempPassword.set(res.temporaryPassword || 'Password reset successfully');
      },
      error: () => this.resettingPassword.set(false),
    });
  }

  closeResetModal(): void {
    this.resetUser.set(null);
    this.tempPassword.set(null);
  }

  getStatusBadgeType(status: TenantStatus): 'success' | 'warning' | 'danger' | 'default' {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'warning';
      case 'SUSPENDED': return 'danger';
      default: return 'default';
    }
  }

  getConfirmTitle(): string {
    const action = this.confirmAction();
    if (action === 'activate') return 'Activate Tenant';
    if (action === 'deactivate') return 'Deactivate Tenant';
    if (action === 'impersonate') return 'Open support view';
    return 'Confirm Action';
  }

  getConfirmMessage(): string {
    const t = this.tenant();
    const action = this.confirmAction();
    if (!t || !action) return '';

    if (action === 'activate') return `Are you sure you want to activate "${t.name}"? Users will be allowed to log in.`;
    if (action === 'deactivate') return `Are you sure you want to deactivate "${t.name}"? Active user sessions will be restricted.`;
    if (action === 'impersonate') return `You will see "${t.name}" (${t.companyCode}) as its owner does, read-only: nothing can be changed. Opening it and every page you look at are recorded in the audit log.`;
    return '';
  }

  getConfirmButtonText(): string {
    const action = this.confirmAction();
    if (action === 'activate') return 'Activate';
    if (action === 'deactivate') return 'Deactivate';
    if (action === 'impersonate') return 'Open read-only';
    return 'Confirm';
  }

  getConfirmButtonVariant(): 'primary' | 'danger' | 'secondary' {
    const action = this.confirmAction();
    if (action === 'deactivate') return 'danger';
    return 'primary';
  }
}
