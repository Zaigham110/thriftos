/**
 * Tenant Settings Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/tenant
 * 
 * Displays tenant profile and basic configuration.
 * READ-ONLY for most fields - tenant updates require Super Admin.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Building2, Users, Shield, Layers, Package, Warehouse, RefreshCw } from 'lucide-angular';
import { AdminService } from '../admin.service';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
  BadgeComponent,
} from '../../../shared/ui';
import { SelectComponent } from '../../../shared/ui/select/select';

@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    SelectComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
    BadgeComponent,
  ],
  templateUrl: './tenant-settings.html',
  styleUrl: './tenant-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantSettingsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly saving = signal(false);
  protected readonly currencyCodeControl = new FormControl<string>('USD', { nonNullable: true });

  protected readonly currencyOptions = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'PKR', label: 'PKR - Pakistani Rupee' },
  ];

  readonly icons = {
    Building2,
    Users,
    Shield,
    Layers,
    Package,
    Warehouse,
    RefreshCw,
  };

  readonly tenant = this.adminService.tenant;
  readonly tenantStats = this.adminService.tenantStats;
  readonly loading = this.adminService.loading;
  readonly error = this.adminService.error;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Administration', link: '/app/admin' },
    { label: 'Tenant Settings' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.adminService.loadTenant().subscribe({
      next: (tenant) => this.currencyCodeControl.setValue(tenant.currencyCode, { emitEvent: false }),
    });
    this.adminService.loadTenantStats().subscribe();
  }

  clearError(): void {
    this.adminService.clearError();
  }

  refresh(): void {
    this.loadData();
  }

  protected readonly currencyLocked = computed(() => !!this.tenant()?.currencyLocked);

  protected readonly currencyChanged = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return false;
    return this.currencyCodeControl.value !== tenant.currencyCode;
  });

  saveCurrency(): void {
    const tenant = this.tenant();
    if (!tenant) return;
    if (this.currencyLocked()) return;

    const currencyCode = this.currencyCodeControl.value;
    if (currencyCode === tenant.currencyCode) return;

    this.saving.set(true);
    this.adminService.updateTenantSettings({ currencyCode }).subscribe({
      next: (updated) => {
        this.currencyCodeControl.setValue(updated.currencyCode, { emitEvent: false });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  getStatusVariant(status: string): 'success' | 'danger' {
    return status === 'ACTIVE' ? 'success' : 'danger';
  }
}
