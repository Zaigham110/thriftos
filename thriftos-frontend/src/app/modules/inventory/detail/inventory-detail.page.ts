/**
 * Inventory Detail Component
 * Phase 2: Inventory Module UI
 * 
 * Traceability & lineage detail audit view for a finished inventory item.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  Package,
  Warehouse as WarehouseIcon,
  Sparkles,
  Layers,
  Truck,
  FileText,
  DollarSign,
  Scale,
  GitBranch,
} from 'lucide-angular';

import { InventoryService } from '../inventory.service';
import { InventoryItem, TraceabilityChain } from '../inventory.models';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './inventory-detail.page.html',
  styleUrl: './inventory-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryDetailPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryService = inject(InventoryService);

  readonly item = signal<InventoryItem | null>(null);
  readonly traceability = signal<TraceabilityChain | null>(null);
  readonly loading = signal(true);
  readonly loadingTrace = signal(false);
  readonly error = signal<string | null>(null);

  readonly icons = {
    ArrowLeft,
    Package,
    Warehouse: WarehouseIcon,
    Sparkles,
    Layers,
    Truck,
    FileText,
    DollarSign,
    Scale,
    GitBranch,
  };

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const i = this.item();
    const code = i ? (i.unitCode || `INV-${String(i.id).slice(0, 8).toUpperCase()}`) : 'Detail';
    return [
      { label: 'Inventory', route: '/stock/items' },
      { label: 'Finished Goods', route: '/stock/items' },
      { label: code },
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing inventory item id');
      this.loading.set(false);
      return;
    }

    this.loadItem(id);
  }

  loadItem(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.inventoryService.getById(id).subscribe({
      next: (item) => {
        this.item.set(item);
        this.loading.set(false);
        this.loadTraceability(id);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load inventory item');
        this.loading.set(false);
      },
    });
  }

  loadTraceability(id: string): void {
    this.loadingTrace.set(true);
    this.inventoryService.getTraceability(id).subscribe({
      next: (trace) => {
        this.traceability.set(trace);
        this.loadingTrace.set(false);
      },
      error: (err) => {
        console.error('Failed to load traceability:', err);
        this.loadingTrace.set(false);
      },
    });
  }

  readonly firstAllocation = computed(() => {
    const t = this.traceability();
    return t?.sourceAllocations?.[0] || null;
  });

  readonly sourceContainer = computed(() => {
    return this.firstAllocation()?.gradingOutput?.categoryOutput?.sortSession?.rag?.container || null;
  });

  readonly sourceRag = computed(() => {
    return this.firstAllocation()?.gradingOutput?.categoryOutput?.sortSession?.rag || null;
  });

  readonly sourceSortSession = computed(() => {
    return this.firstAllocation()?.gradingOutput?.categoryOutput?.sortSession || null;
  });

  readonly sourceGradeSession = computed(() => {
    return this.firstAllocation()?.gradingOutput?.gradeSession || null;
  });

  goBack(): void {
    this.router.navigate(['/stock/items']);
  }

  itemCode(i: InventoryItem | null): string {
    if (!i) return '—';
    return i.unitCode || `INV-${String(i.id).slice(0, 8).toUpperCase()}`;
  }

  totalValue(i: InventoryItem | null): number {
    if (!i) return 0;
    const weight = Number(i.weightKg || 0);
    const cost = Number(i.avgCost || 0);
    return weight * cost;
  }
}
