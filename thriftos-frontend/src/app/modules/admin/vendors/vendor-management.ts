/**
 * Vendor Management Component
 * Phase 8: Tenant Administration
 * 
 * Manage vendors/suppliers for procurement.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, Store, Plus, Pencil, Search, RefreshCw, ArrowLeft } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Vendor } from '../admin.models';
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppDataTableComponent,
  AppButtonComponent,
  AppLoadingComponent,
  AppEmptyStateComponent,
  AppBreadcrumbComponent,
  AppStackComponent,
  AppDialogComponent,
  type TableColumn,
  type BreadcrumbItem,
} from '../../../shared/ui';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-vendor-management',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppDataTableComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppEmptyStateComponent,
    AppBreadcrumbComponent,
    AppStackComponent,
    AppDialogComponent,
    HasPermissionDirective,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-breadcrumb [items]="breadcrumbs"></app-breadcrumb>

        <app-stack direction="vertical">
          <h1>Vendor Management</h1>
          @if (!loading()) {
            <p class="page-subtitle">{{ filteredVendors().length }} vendors</p>
          }
        </app-stack>

        <div class="actions">
          <app-button variant="secondary" (clickEvent)="refresh()">Refresh</app-button>
          <app-button variant="primary" (clickEvent)="navigateToCreate()" *hasPermission="'vendor.create'">New Vendor</app-button>
        </div>
      </app-page-header>

      <app-page-body>
        <app-section>
          <app-section-header>
            <h2 class="section-title">All Vendors</h2>
            <div class="section-actions">
              <div class="search">
                <input
                  type="text"
                  class="search-input"
                  placeholder="Search vendors…"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                />
              </div>
            </div>
          </app-section-header>

          <app-section-body>
            @if (loading()) {
              <app-loading message="Loading vendors…"></app-loading>
            } @else if (filteredVendors().length === 0) {
              <app-empty-state
                title="No vendors found"
                [message]="searchQuery() ? 'No vendors match your search criteria.' : 'Create your first vendor so it can be selected in Procurement.'"
              >
                @if (!searchQuery()) {
                  <app-button variant="primary" (clickEvent)="navigateToCreate()" *hasPermission="'vendor.create'">Create Vendor</app-button>
                }
              </app-empty-state>
            } @else {
              <app-data-table
                [data]="filteredVendors()"
                [columns]="columns"
                [loading]="loading()"
                [serverSide]="false"
              >
                <ng-template #cellTemplate let-row let-column="column">
                  @if (column.key === 'name') {
                    <span class="font-medium">{{ row.name }}</span>
                  } @else if (column.key === 'country') {
                    <span class="text-sm">{{ row.country || '—' }}</span>
                  } @else if (column.key === 'contactInfo') {
                    <span class="text-sm">{{ row.contactInfo || '—' }}</span>
                  } @else if (column.key === 'isActive') {
                    <span class="text-sm" [class.text-green-600]="row.isActive" [class.text-gray-500]="!row.isActive">
                      {{ row.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  }
                </ng-template>

                <ng-template #rowActions let-row>
                  <app-button variant="secondary" size="sm" (clickEvent)="navigateToEdit(row)" *hasPermission="'vendor.update'">Edit</app-button>
                  @if (row.isActive) {
                    <app-button variant="danger" size="sm" (clickEvent)="confirmDeactivate(row)" *hasPermission="'vendor.update'">Deactivate</app-button>
                  }
                  @if (!row.isActive) {
                    <app-button variant="danger" size="sm" (clickEvent)="confirmDelete(row)" *hasPermission="'vendor.delete'">Delete</app-button>
                  }
                </ng-template>
              </app-data-table>
            }
          </app-section-body>
        </app-section>
      </app-page-body>
    </app-page>

    <app-dialog
      [open]="confirmDeactivateOpen()"
      title="Deactivate Vendor"
      [message]="'Deactivating ' + (selected()?.name || '') + ' will remove it from selection in Procurement. Existing purchase orders and reports remain.'"
      confirmText="Deactivate"
      cancelText="Cancel"
      variant="danger"
      [loading]="actionLoading()"
      (confirmed)="executeDeactivate()"
      (cancelled)="cancelDialogs()"
    ></app-dialog>

    <app-dialog
      [open]="confirmDeleteOpen()"
      title="Delete Vendor"
      [message]="'Deleting ' + (selected()?.name || '') + ' will permanently remove it. If it is referenced by procurement history (purchase orders or incoming bales), deletion will be blocked and you should deactivate instead.'"
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
      [loading]="actionLoading()"
      (confirmed)="executeDelete()"
      (cancelled)="cancelDialogs()"
    ></app-dialog>
  `,
  styleUrl: './vendor-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  readonly icons = {
    Store,
    Plus,
    Pencil,
    Search,
    RefreshCw,
    ArrowLeft,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Vendors' },
  ];

  readonly columns: TableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'country', label: 'Country' },
    { key: 'contactInfo', label: 'Contact Info' },
    { key: 'isActive', label: 'Status' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);

  readonly confirmDeactivateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly selected = signal<Vendor | null>(null);
  readonly actionLoading = signal(false);

  readonly vendors = this.adminService.vendors;

  readonly filteredVendors = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.vendors();

    return this.vendors().filter(vendor =>
      vendor.name.toLowerCase().includes(query) ||
      vendor.country?.toLowerCase().includes(query) ||
      vendor.contactInfo?.toLowerCase().includes(query)
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
}
