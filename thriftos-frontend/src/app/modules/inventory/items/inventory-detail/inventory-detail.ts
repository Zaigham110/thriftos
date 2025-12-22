/**
 * Inventory Detail Component
 * Phase 6: Inventory Management
 * 
 * Core screen showing inventory item details with:
 * - Header with full traceability info
 * - Lineage panel (MANDATORY)
 * - Stock movement ledger (APPEND-ONLY)
 * 
 * Route: /app/inventory/items/:id
 * 
 * CRITICAL: Must display lineage or show error.
 * No inventory item without repack unit lineage is valid.
 */

import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Package, Scale, Layers, Tag, Warehouse, Clock, RefreshCw, AlertTriangle } from 'lucide-angular';
import { InventoryService } from '../../inventory.service';
import { InventoryItem, InventoryLineage } from '../../inventory.models';
import { LineagePanelComponent } from '../../shared/lineage-panel.component';
import { WarehouseBadgeComponent } from '../../shared/warehouse-badge.component';
import { InventoryLedgerTableComponent } from '../../ledger/inventory-ledger-table.component';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  SkeletonComponent,
  BadgeComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    SkeletonComponent,
    BadgeComponent,
    LineagePanelComponent,
    WarehouseBadgeComponent,
    InventoryLedgerTableComponent,
  ],
  templateUrl: './inventory-detail.html',
  styleUrl: './inventory-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly inventoryService = inject(InventoryService);

  readonly icons = {
    ArrowLeft,
    Package,
    Scale,
    Layers,
    Tag,
    Warehouse,
    Clock,
    RefreshCw,
    AlertTriangle,
  };

  // State from service
  readonly loading = this.inventoryService.loading;
  readonly error = this.inventoryService.error;
  readonly item = this.inventoryService.currentItem;
  readonly movements = this.inventoryService.movements;
  readonly lineage = this.inventoryService.currentLineage;

  // Local state
  readonly itemId = signal<string | null>(null);
  readonly lineageError = signal<string | null>(null);

  readonly breadcrumbs = signal<BreadcrumbItem[]>([
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Inventory', link: '/app/inventory' },
    { label: 'Items', link: '/app/inventory/items' },
    { label: 'Loading...' },
  ]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/app/inventory/items']);
      return;
    }

    this.itemId.set(id);
    this.loadItem(id);
  }

  ngOnDestroy(): void {
    this.inventoryService.clearCurrentItem();
  }

  loadItem(id: string): void {
    this.lineageError.set(null);

    this.inventoryService.loadItem(id).subscribe({
      next: (item) => {
        // Validate lineage exists - CRITICAL REQUIREMENT
        if (!item.repackUnitId || !item.repackUnit) {
          this.lineageError.set('This inventory item is missing required lineage data. It may be corrupted.');
        }

        // Update breadcrumbs
        const unitCode = item.repackUnit?.unitCode || item.id.slice(0, 8);
        this.breadcrumbs.set([
          { label: 'Home', link: '/app/dashboard' },
          { label: 'Inventory', link: '/app/inventory' },
          { label: 'Items', link: '/app/inventory/items' },
          { label: unitCode },
        ]);
      },
      error: () => {
        // Error is handled by service
      },
    });
  }

  refresh(): void {
    const id = this.itemId();
    if (id) {
      this.loadItem(id);
    }
  }

  formatWeight(weight: number | string): string {
    return this.inventoryService.formatWeight(weight);
  }

  getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' {
    return this.inventoryService.getStatusVariant(status as any);
  }

  formatCost(cost: number | string): string {
    const c = typeof cost === 'string' ? parseFloat(cost) : cost;
    if (isNaN(c)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(c);
  }
}
