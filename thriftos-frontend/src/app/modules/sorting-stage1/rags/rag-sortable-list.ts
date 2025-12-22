/**
 * Sortable Rags List Component
 * Lists all rags/bales available for sorting
 * 
 * Route: /app/sorting/rags
 */

import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Package, Play, Search, Filter, Eye, RefreshCw } from 'lucide-angular';
import { RagService } from '../../procurement/rags/rag.service';
import { Rag } from '../../procurement/rags/rag.models';
import { ProcurementService } from '../../procurement/procurement.service';
import { IncomingBale } from '../../procurement/procurement.models';
import { SortingStage1Service } from '../sorting-stage1.service';
import {
  CardComponent,
  ButtonComponent,
  AlertComponent,
  BreadcrumbComponent,
  BreadcrumbItem,
  BadgeComponent,
  SkeletonComponent,
  EmptyStateComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-rag-sortable-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BreadcrumbComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './rag-sortable-list.html',
  styleUrl: './rag-sortable-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagSortableListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly ragService = inject(RagService);
  private readonly procurementService = inject(ProcurementService);
  private readonly sortingService = inject(SortingStage1Service);

  readonly icons = {
    package: Package,
    play: Play,
    search: Search,
    filter: Filter,
    eye: Eye,
    refresh: RefreshCw,
  };

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/app/dashboard' },
    { label: 'Sorting', link: '/app/sorting/stage1' },
    { label: 'Available Rags & Bales' },
  ];

  // State
  readonly rags = signal<Rag[]>([]);
  readonly bales = signal<IncomingBale[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly searchQuery = signal('');
  readonly typeFilter = signal<'ALL' | 'RAG' | 'BALE'>('ALL');

  readonly typeOptions = [
    { value: 'ALL', label: 'All Types' },
    { value: 'RAG', label: 'Rags' },
    { value: 'BALE', label: 'Bales' },
  ];

  // Computed
  readonly filteredRags = computed(() => {
    const allRags = this.rags();
    const allBales = this.bales();
    const query = this.searchQuery().toLowerCase();
    const type = this.typeFilter();
    
    // Merge rags and bales
    interface SortableItem {
      id: string;
      code: string;
      type: 'RAG' | 'BALE';
      source: 'CONTAINER' | 'LOOSE_BALE';
      containerNumber: string | null;
      containerId: string | null;
      poNumber: string | null;
      categoryName: string | null;
      weightKg: number;
    }
    
    const merged: SortableItem[] = [
      ...allRags.map(r => ({
        id: r.id,
        code: r.ragCode,
        type: (r.ragBaleType === 'BOTH' ? 'RAG' : r.ragBaleType) as 'RAG' | 'BALE',
        source: (r.sourceType || 'CONTAINER') as 'CONTAINER' | 'LOOSE_BALE',
        containerNumber: r.container?.containerNumber || null,
        containerId: r.containerId || null,
        poNumber: r.container?.purchaseOrder?.poNumber || null,
        categoryName: r.rawCategory?.name || null,
        weightKg: Number(r.weightKg),
      })),
      ...allBales.map(b => ({
        id: b.id,
        code: b.baleCode,
        type: 'BALE' as const,
        source: 'LOOSE_BALE' as const,
        containerNumber: b.container?.containerNumber || null,
        containerId: b.containerId || null,
        poNumber: b.purchaseOrder?.poNumber || null,
        categoryName: b.rawCategory?.name || null,
        weightKg: Number(b.weightKg),
      })),
    ];
    
    // Filter by search query
    let filtered = merged;
    if (query) {
      filtered = filtered.filter(
        (item) =>
          item.code.toLowerCase().includes(query) ||
          item.containerNumber?.toLowerCase().includes(query) ||
          item.categoryName?.toLowerCase().includes(query) ||
          item.poNumber?.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (type !== 'ALL') {
      filtered = filtered.filter((item) => item.type === type);
    }

    return filtered;
  });

  readonly ragCount = computed(() => 
    this.filteredRags().filter(r => r.type === 'RAG').length
  );

  readonly baleCount = computed(() => 
    this.filteredRags().filter(r => r.type === 'BALE').length
  );

  readonly totalWeight = computed(() =>
    this.filteredRags().reduce((sum, item) => sum + item.weightKg, 0)
  );

  ngOnInit(): void {
    this.loadRags();
  }

  loadRags(): void {
    this.loading.set(true);
    this.error.set(null);

    // Fetch both rags from containers and loose incoming bales (standalone=true means not in containers)
    Promise.all([
      this.ragService.getSortableRags(1, 1000).toPromise(),
      this.procurementService.fetchIncomingBales({ standalone: true, limit: 1000 }).toPromise() as Promise<any>,
    ])
      .then(([ragsResponse, balesResponse]) => {
        this.rags.set(ragsResponse?.data || []);
        this.bales.set(balesResponse?.data || []);
        this.loading.set(false);
      })
      .catch((err) => {
        this.error.set(err.message || 'Failed to load rags and bales');
        this.loading.set(false);
      });
  }

  viewDetails(item: ReturnType<typeof this.filteredRags>[number]): void {
    if (item.source === 'LOOSE_BALE') {
      // Navigate to incoming bale detail
      this.router.navigate(['/app/procurement/incoming-bales', item.id]);
    } else if (item.containerId) {
      // Navigate to container detail page
      this.router.navigate(['/app/procurement/containers', item.containerId]);
    }
  }

  startSorting(item: ReturnType<typeof this.filteredRags>[number]): void {
    this.actionLoading.set(true);
    this.error.set(null);

    // Create session with ragId (for Rags from containers) or incomingBaleId (for loose bales)
    const sessionData =
      item.source === 'LOOSE_BALE'
        ? { incomingBaleId: item.id }
        : { ragId: item.id };

    this.sortingService.createSession(sessionData).subscribe({
      next: (session) => {
        this.actionLoading.set(false);
        this.router.navigate(['/app/sorting/stage1', session.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to start sorting session');
        this.actionLoading.set(false);
      },
    });
  }

  getTypeVariant(type: string): 'default' | 'primary' | 'success' | 'warning' {
    return type === 'RAG' ? 'primary' : 'success';
  }

  formatWeight(kg: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(kg);
  }

  refresh(): void {
    this.loadRags();
  }
}
