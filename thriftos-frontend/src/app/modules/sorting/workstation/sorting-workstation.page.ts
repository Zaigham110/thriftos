/**
 * High-Speed Barcode & Touch Sorting Workstation Page
 * Phase 4: Industrial Productivity & Scanner Workstation
 * 
 * Optimized for warehouse touchscreens and Bluetooth/USB barcode scanners.
 */

import { CommonModule, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  QrCode,
  Zap,
  TrendingUp,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
} from 'lucide-angular';

import { SortingFacadeService } from '../sorting-facade.service';
import type { Stage1QueueItem } from '../sorting-facade.service';
import {
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

interface TouchCategoryBucket {
  id: string;
  key: string;
  name: string;
  weightKg: number;
  badgeColor: string;
}

@Component({
  selector: 'app-sorting-workstation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
  ],
  templateUrl: './sorting-workstation.page.html',
  styleUrl: './sorting-workstation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingWorkstationPage implements OnInit {
  private readonly facade = inject(SortingFacadeService);
  private readonly router = inject(Router);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sorting Operations', route: '/app/sorting/stage-1' },
    { label: 'High-Speed Scanner Workstation' },
  ];

  readonly icons = {
    QrCode,
    Zap,
    TrendingUp,
    Layers,
    ArrowLeft,
    CheckCircle2,
    AlertTriangle,
    Play,
    RotateCcw,
    Scale,
    Sparkles,
  };

  // State
  readonly barcodeInput = new FormControl<string>('', { nonNullable: true });
  readonly queue = signal<Stage1QueueItem[]>([]);
  readonly loadingQueue = signal<boolean>(false);
  readonly activeItem = signal<Stage1QueueItem | null>(null);

  readonly totalProcessedKg = signal<number>(0);
  readonly currentBucketWeight = signal<number>(0);

  readonly categories = signal<TouchCategoryBucket[]>([
    { id: 'cat-1', key: '1', name: 'Vintage T-Shirts', weightKg: 0, badgeColor: 'bg-purple-100 text-purple-800' },
    { id: 'cat-2', key: '2', name: 'Denim Jeans & Jackets', weightKg: 0, badgeColor: 'bg-blue-100 text-blue-800' },
    { id: 'cat-3', key: '3', name: 'Heavy Winter Outerwear', weightKg: 0, badgeColor: 'bg-amber-100 text-amber-800' },
    { id: 'cat-4', key: '4', name: 'Athletic Sweats & Hoodies', weightKg: 0, badgeColor: 'bg-emerald-100 text-emerald-800' },
    { id: 'cat-5', key: '5', name: 'Casual Button-down Shirts', weightKg: 0, badgeColor: 'bg-cyan-100 text-cyan-800' },
    { id: 'cat-6', key: '6', name: 'Dresses & Skirts', weightKg: 0, badgeColor: 'bg-pink-100 text-pink-800' },
    { id: 'cat-7', key: '7', name: 'Children Footwear & Clothes', weightKg: 0, badgeColor: 'bg-indigo-100 text-indigo-800' },
    { id: 'cat-8', key: '8', name: 'Sorting Waste & Material Loss', weightKg: 0, badgeColor: 'bg-red-100 text-red-800' },
  ]);

  readonly activeInputWeightKg = computed<number>(() => {
    return this.activeItem()?.weightKg || 0;
  });

  readonly currentSessionOutputKg = computed<number>(() => {
    return this.categories().reduce((sum, c) => sum + c.weightKg, 0);
  });

  readonly conversionYieldPct = computed<number>(() => {
    const input = this.activeInputWeightKg();
    if (input <= 0) return 0;
    return Number(((this.currentSessionOutputKg() / input) * 100).toFixed(1));
  });

  // Hotkey listener for industrial scale keyboard inputs (1..8)
  @HostListener('window:keydown', ['$event'])
  handleKeyboardHotkeys(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    const key = event.key;
    if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      const match = this.categories().find((c) => c.key === key);
      if (match) {
        this.addWeightToBucket(match);
      }
    }
  }

  ngOnInit(): void {
    this.loadQueue();
  }

  loadQueue(): void {
    this.loadingQueue.set(true);
    this.facade.stage1Queue(1, 100, { status: 'NOT_STARTED' }).subscribe({
      next: (res) => {
        const items = res?.data || (Array.isArray(res) ? res : []);
        this.queue.set(items);
        this.loadingQueue.set(false);

        // Auto-select first item if queue exists
        if (items.length > 0 && !this.activeItem()) {
          this.selectItem(items[0]);
        }
      },
      error: () => this.loadingQueue.set(false),
    });
  }

  selectItem(item: Stage1QueueItem): void {
    this.activeItem.set(item);
    // Reset bucket weights
    this.categories.update((list) => list.map((c) => ({ ...c, weightKg: 0 })));
  }

  onScanSubmit(): void {
    const code = this.barcodeInput.value.trim().toUpperCase();
    if (!code) return;

    // Search in queue for matching ragCode or baleCode
    const match = this.queue().find(
      (q) => (q.ragCode || '').toUpperCase() === code || (q.baleCode || '').toUpperCase() === code
    );

    if (match) {
      this.selectItem(match);
      this.barcodeInput.reset('');
    }
  }

  addWeightToBucket(bucket: TouchCategoryBucket): void {
    const add = this.currentBucketWeight() > 0 ? this.currentBucketWeight() : 5;
    this.categories.update((list) =>
      list.map((c) => (c.id === bucket.id ? { ...c, weightKg: Number((c.weightKg + add).toFixed(2)) } : c))
    );
    this.currentBucketWeight.set(0);
  }

  setQuickAddWeight(weight: number): void {
    this.currentBucketWeight.set(weight);
  }

  finishSession(): void {
    const item = this.activeItem();
    if (!item) return;

    this.totalProcessedKg.update((v) => v + item.weightKg);

    // Filter out item from queue
    this.queue.update((list) => list.filter((i) => i.id !== item.id));

    // Auto-select next item
    const remaining = this.queue();
    if (remaining.length > 0) {
      this.selectItem(remaining[0]);
    } else {
      this.activeItem.set(null);
    }
  }

  goBack(): void {
    this.router.navigate(['/app/sorting/stage-1']);
  }
}
