/**
 * Inventory Dashboard Component
 * Phase 6: Inventory Management
 * 
 * Landing page showing inventory overview stats.
 * Route: /app/inventory
 */

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Package, Scale, Warehouse, Layers, Tag, CheckCircle, Clock, ShoppingCart } from 'lucide-angular';
import { InventoryService } from '../inventory.service';
import { InventoryStats } from '../inventory.models';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
  ],
  templateUrl: './inventory-dashboard.html',
  styleUrl: './inventory-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryDashboardComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);

  readonly icons = {
    Package,
    Scale,
    Warehouse,
    Layers,
    Tag,
    CheckCircle,
    Clock,
    ShoppingCart,
  };

  readonly stats = signal<InventoryStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Inventory' },
  ];

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading.set(true);
    this.error.set(null);

    this.inventoryService.loadStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load inventory stats');
        this.loading.set(false);
      },
    });
  }

  formatWeight(weight: number): string {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(2)} T`;
    }
    return `${weight.toFixed(2)} KG`;
  }

  getStatusIcon(status: string) {
    switch (status) {
      case 'AVAILABLE':
        return this.icons.CheckCircle;
      case 'RESERVED':
        return this.icons.Clock;
      case 'SOLD':
        return this.icons.ShoppingCart;
      default:
        return this.icons.Package;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE':
        return 'Available';
      case 'RESERVED':
        return 'Reserved';
      case 'SOLD':
        return 'Sold';
      default:
        return status;
    }
  }
}
