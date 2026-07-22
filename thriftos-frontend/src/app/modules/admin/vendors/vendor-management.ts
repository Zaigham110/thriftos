/**
 * Vendor Management Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/vendors
 * 
 * Manages procurement suppliers, origin countries, and contact notes.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Store,
  Globe,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Power,
  X,
  MapPin,
  PhoneCall,
} from 'lucide-angular';

import { AdminService } from '../admin.service';
import type { Vendor } from '../admin.models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppEmptyStateComponent,
  AppDialogComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-vendor-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
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
    HasPermissionDirective,
  ],
  templateUrl: './vendor-management.html',
  styleUrl: './vendor-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Vendors' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly error = this.adminService.error;

  readonly confirmDeactivateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<Vendor | null>(null);
  readonly actionLoading = signal(false);

  readonly vendors = this.adminService.vendors;

  readonly icons = {
    Store,
    Globe,
    CheckCircle2,
    Plus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Power,
    X,
    MapPin,
    PhoneCall,
  };

  // KPI Calculations
  readonly totalVendorsCount = computed(() => this.vendors().length);
  readonly activeVendorsCount = computed(
    () => this.vendors().filter((v) => v.isActive).length
  );
  readonly totalCountriesCount = computed(() => {
    const countries = new Set(this.vendors().map((v) => v.country).filter(Boolean));
    return countries.size;
  });

  readonly filteredVendors = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.vendors();

    return this.vendors().filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        (v.country || '').toLowerCase().includes(query) ||
        (v.contactInfo || '').toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.loadVendors().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearError(): void {
    this.adminService.clearError();
  }

  navigateToCreate(): void {
    this.router.navigate(['/app/admin/vendors/new']);
  }

  navigateToEdit(vendor: Vendor): void {
    this.router.navigate(['/app/admin/vendors', vendor.id, 'edit']);
  }

  confirmDeactivate(vendor: Vendor): void {
    this.selected.set(vendor);
    this.confirmDeactivateOpen.set(true);
  }

  confirmDelete(vendor: Vendor): void {
    this.selected.set(vendor);
    this.confirmDeleteOpen.set(true);
  }

  cancelDialogs(): void {
    this.confirmDeactivateOpen.set(false);
    this.confirmDeleteOpen.set(false);
    this.selected.set(null);
    this.actionLoading.set(false);
  }

  executeDeactivate(): void {
    const vendor = this.selected();
    if (!vendor) return;

    this.actionLoading.set(true);
    this.adminService.updateVendor(vendor.id, { isActive: false }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
        this.refresh();
      },
      error: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
      },
    });
  }

  executeDelete(): void {
    const vendor = this.selected();
    if (!vendor) return;

    this.actionLoading.set(true);
    this.adminService.deleteVendor(vendor.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
        this.refresh();
      },
      error: () => {
        this.actionLoading.set(false);
        this.cancelDialogs();
      },
    });
  }

  getVendorInitials(name: string): string {
    if (!name) return 'V';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
