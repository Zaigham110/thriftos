/**
 * INVENTORY DETAIL - READ-ONLY AUDIT VIEW
 * ========================================
 * Shows inventory item details and traceability.
 * Aligned with Procurement Golden Reference pattern.
 */

import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import { InventoryService } from '../inventory.service';
import { InventoryItem, TraceabilityChain } from '../inventory.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppBadgeComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppCardComponent,
  AppStackComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppBreadcrumbComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppCardComponent,
    AppStackComponent,
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
  readonly loading = signal(false);
  readonly loadingTrace = signal(false);
  readonly error = signal<string | null>(null);
  readonly showTraceability = signal(false);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Inventory', route: '/inventory' },
    { label: 'Detail', route: undefined },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadItem(id);
    } else {
      this.router.navigate(['/inventory']);
    }
  }

  loadItem(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.inventoryService.getById(id).subscribe({
      next: (item) => {
        this.item.set(item);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load inventory item');
        this.loading.set(false);
      },
    });
  }

  loadTraceability(): void {
    const item = this.item();
    if (!item) return;

    this.loadingTrace.set(true);

    this.inventoryService.getTraceability(item.id).subscribe({
      next: (trace) => {
        this.traceability.set(trace);
        this.showTraceability.set(true);
        this.loadingTrace.set(false);
      },
      error: (err) => {
        console.error('Failed to load traceability:', err);
        this.loadingTrace.set(false);
      },
    });
  }

  toggleTraceability(): void {
    if (this.showTraceability()) {
      this.showTraceability.set(false);
    } else {
      if (!this.traceability()) {
        this.loadTraceability();
      } else {
        this.showTraceability.set(true);
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/inventory']);
  }

  getStatusVariant(status: string): 'success' | 'warning' | 'default' {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'MOVED':
        return 'warning';
      default:
        return 'default';
    }
  }
}
