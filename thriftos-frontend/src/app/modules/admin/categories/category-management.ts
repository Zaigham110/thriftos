/**
 * Category Management Component
 * Phase 8: Tenant Administration
 * 
 * Read-only display of product categories.
 * Categories are managed at Super Admin level.
 */

import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Layers, RefreshCw, Search, Info } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Category } from '../admin.models';
import {
  CardComponent,
  BreadcrumbComponent,
  EmptyStateComponent,
  SkeletonComponent,
  AlertComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-category-management',
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
  templateUrl: './category-management.html',
  styleUrl: './category-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly icons = {
    Layers,
    RefreshCw,
    Search,
    Info,
  };

  readonly breadcrumbs = [
    { label: 'Administration', route: '/app/admin' },
    { label: 'Categories' },
  ];

  readonly searchQuery = signal('');
  readonly loading = signal(true);

  readonly categories = this.adminService.categories;

  get filteredCategories(): Category[] {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.categories();

    return this.categories().filter(cat =>
      cat.name.toLowerCase().includes(query) ||
      cat.description?.toLowerCase().includes(query)
    );
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.loadCategories().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  refresh(): void {
    this.loadData();
  }
}
