/**
 * Vendor Management Component
 * Phase 8: Tenant Administration
 * 
 * Manage vendors/suppliers for procurement.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Store, Plus, Pencil, Search, RefreshCw, Mail, Phone } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Vendor } from '../admin.models';
import {
  CardComponent,
  BreadcrumbComponent,
  EmptyStateComponent,
  SkeletonComponent,
} from '../../../shared/ui';
import { VendorFormDrawerComponent } from './vendor-form-drawer';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-vendor-management',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    CardComponent,
    BreadcrumbComponent,
    EmptyStateComponent,
    SkeletonComponent,
    VendorFormDrawerComponent,
    HasPermissionDirective,
  ],
  templateUrl: './vendor-management.html',
  styleUrl: './vendor-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly icons = {
    Store,
    Plus,
    Pencil,
    Search,
    RefreshCw,
    Mail,
    Phone,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Vendors' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);
  readonly drawerOpen = signal(false);
  readonly selectedVendor = signal<Vendor | null>(null);

  readonly vendors = this.adminService.vendors;

  readonly filteredVendors = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.vendors();

    return this.vendors().filter(vendor =>
      vendor.name.toLowerCase().includes(query) ||
      vendor.email?.toLowerCase().includes(query) ||
      vendor.contactPerson?.toLowerCase().includes(query)
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

  openAddDrawer(): void {
    this.selectedVendor.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(vendor: Vendor): void {
    this.selectedVendor.set(vendor);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedVendor.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.refresh();
  }
}
