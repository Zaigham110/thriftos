/**
 * Tenant Settings Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/tenant
 * 
 * Displays tenant profile and basic configuration.
 * READ-ONLY for most fields - tenant updates require Super Admin.
 */

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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

@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
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
    this.adminService.loadTenant().subscribe();
    this.adminService.loadTenantStats().subscribe();
  }

  clearError(): void {
    this.adminService.clearError();
  }

  refresh(): void {
    this.loadData();
  }

  getStatusVariant(status: string): 'success' | 'danger' {
    return status === 'ACTIVE' ? 'success' : 'danger';
  }
}
