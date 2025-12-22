/**
 * Warehouse Management Component
 * Phase 8: Tenant Administration
 * 
 * Read-only display of warehouses.
 * Warehouses are managed at Super Admin level.
 */

import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Warehouse, RefreshCw, Search, Info, MapPin } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Warehouse as WarehouseModel } from '../admin.models';
import {
  CardComponent,
  BreadcrumbComponent,
  EmptyStateComponent,
  SkeletonComponent,
  AlertComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-warehouse-management',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    CardComponent,
    BreadcrumbComponent,
    EmptyStateComponent,
    SkeletonComponent,
    AlertComponent,
  ],
  templateUrl: './warehouse-management.html',
  styleUrl: './warehouse-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarehouseManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly icons = {
    Warehouse,
    RefreshCw,
    Search,
    Info,
    MapPin,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Warehouses' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);

  readonly warehouses = this.adminService.warehouses;

  get filteredWarehouses(): WarehouseModel[] {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.warehouses();

    return this.warehouses().filter(wh =>
      wh.name.toLowerCase().includes(query) ||
      wh.location?.toLowerCase().includes(query)
    );
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.loadWarehouses().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }
}
