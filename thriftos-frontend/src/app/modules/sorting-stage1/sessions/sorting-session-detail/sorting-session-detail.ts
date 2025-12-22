import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Package, Trash2, Save, Lock, Info, AlertCircle, Scale, Hash, Box, CheckCircle, Play } from 'lucide-angular';

import { CardComponent } from '../../../../shared/ui/card/card';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { AlertComponent } from '../../../../shared/ui/alert/alert';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../../shared/ui/breadcrumb/breadcrumb';
import { ConfirmDialogComponent } from '../../../../shared/ui/confirm-dialog/confirm-dialog';

import { SortingStage1Service } from '../../sorting-stage1.service';
import { SortingStage2Service } from '../../../sorting-stage2/sorting-stage2.service';
import { SortSession, SortCategoryBucket, Category, SortingTotals } from '../../sorting-stage1.models';
import { WasteBucketComponent, WasteData } from '../../workspace/waste-bucket/waste-bucket';

interface EditingBucket {
  bucketId: string;
  weightKg: number;
  count: number;
}

interface NewBucket {
  categoryId: string;
  weightKg: number;
  count: number;
}

@Component({
  selector: 'app-sorting-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    CardComponent,
    ButtonComponent,
    AlertComponent,
    BadgeComponent,
    SkeletonComponent,
    BreadcrumbComponent,
    ConfirmDialogComponent,
    WasteBucketComponent,
  ],
  templateUrl: './sorting-session-detail.html',
  styleUrls: ['./sorting-session-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortingSessionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sortingService = inject(SortingStage1Service);
  private stage2Service = inject(SortingStage2Service);

  // Math utility for templates
  protected readonly Math = Math;

  // Icons
  readonly icons = {
    arrowLeft: ArrowLeft,
    package: Package,
    trash: Trash2,
    save: Save,
    lock: Lock,
    info: Info,
    alertCircle: AlertCircle,
    scale: Scale,
    hash: Hash,
    box: Box,
    checkCircle: CheckCircle,
    play: Play,
  };

  // State
  session = signal<SortSession | null>(null);
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  startingGrading = signal<string | null>(null); // Bucket ID being started for grading
  
  // Editing state
  editingBucket = signal<EditingBucket | null>(null);
  newBucket = signal<NewBucket | null>(null);

  // Confirm dialog
  showCloseConfirm = signal(false);
  showDeleteConfirm = signal(false);
  deletingBucketId = signal<string | null>(null);

  // Breadcrumbs
  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sorting', link: '/app/sorting/stage1' },
    { label: 'Sessions', link: '/app/sorting/stage1' },
    { label: 'Session Details' },
  ];

  // Computed
  isEditable = computed(() => {
    const s = this.session();
    return s?.status === 'OPEN';
  });

  categoryBuckets = computed(() => {
    const s = this.session();
    if (!s?.buckets) return [];
    // All buckets are category buckets in the current schema
    return s.buckets;
  });

  sortingTotals = computed((): SortingTotals => {
    const s = this.session();
    if (!s) {
      return { totalInputWeight: 0, totalSortedWeight: 0, totalItemCount: 0, yieldPercentage: 0 };
    }
    
    const buckets = s.buckets || [];
    const totalSortedWeight = buckets.reduce((sum, b) => sum + this.toNum(b.outputWeightKg), 0);
    const totalItemCount = buckets.reduce((sum, b) => sum + (b.outputCount || 0), 0);
    const inputWeight = this.toNum(s.totalInputWeight);
    // Yield = sorted output / input (waste is what remains)
    const yieldPercentage = inputWeight > 0 ? (totalSortedWeight / inputWeight) * 100 : 0;
    
    return { totalInputWeight: inputWeight, totalSortedWeight, totalItemCount, yieldPercentage };
  });

  availableCategories = computed(() => {
    const cats = this.categories();
    const buckets = this.session()?.buckets || [];
    const usedCategoryIds = new Set(buckets.map(b => b.categoryId));
    // Filter out already used categories
    return cats.filter(c => !usedCategoryIds.has(c.id));
  });

  // Remaining weight available for allocation (waste = remaining)
  remainingWeight = computed(() => {
    const totals = this.sortingTotals();
    // Remaining = input - sorted (this IS the waste)
    return Math.max(0, totals.totalInputWeight - totals.totalSortedWeight);
  });

  // Waste count (if tracked)
  wasteCount = computed(() => {
    // Waste count is not in the current model, return 0
    return 0;
  });

  // Validation: Check if adding new weight would exceed input
  canAddWeight = computed(() => {
    const newB = this.newBucket();
    if (!newB) return true;
    const remaining = this.remainingWeight();
    return newB.weightKg <= remaining;
  });

  // Validation: Check if editing weight would exceed input (considering current bucket's weight)
  canSaveEditWeight = computed(() => {
    const editing = this.editingBucket();
    if (!editing) return true;
    
    const session = this.session();
    if (!session) return true;
    
    const currentBucket = session.buckets?.find(b => b.id === editing.bucketId);
    const currentWeight = currentBucket ? this.toNum(currentBucket.outputWeightKg) : 0;
    
    // Calculate remaining weight if we remove this bucket's current contribution
    const remaining = this.remainingWeight() + currentWeight;
    return editing.weightKg <= remaining;
  });

  // Weight validation error message
  weightValidationError = computed(() => {
    const newB = this.newBucket();
    const editing = this.editingBucket();
    
    if (newB && !this.canAddWeight()) {
      return `Weight exceeds remaining capacity (${this.formatWeight(this.remainingWeight())} kg available)`;
    }
    if (editing && !this.canSaveEditWeight()) {
      const currentBucket = this.session()?.buckets?.find(b => b.id === editing.bucketId);
      const currentWeight = currentBucket ? this.toNum(currentBucket.outputWeightKg) : 0;
      const available = this.remainingWeight() + currentWeight;
      return `Weight exceeds remaining capacity (${this.formatWeight(available)} kg available)`;
    }
    return null;
  });

  // Helper to convert Decimal strings to numbers (public for template)
  toNum(val: any): number {
    return typeof val === 'string' ? parseFloat(val) : (val || 0);
  }

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (sessionId) {
      this.loadData(sessionId);
    } else {
      this.router.navigate(['/sorting-stage1']);
    }
  }

  private loadData(sessionId: string): void {
    this.loading.set(true);
    this.error.set(null);
    
    // Load categories first, then session
    this.sortingService.loadCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        
        this.sortingService.getSession(sessionId).subscribe({
          next: (session) => {
            this.session.set(session);
            
            // Update breadcrumbs with session ID
            this.breadcrumbs = [
              { label: 'Sorting', link: '/app/sorting/stage1' },
              { label: 'Sessions', link: '/app/sorting/stage1' },
              { label: `Session ${session.id.substring(0, 8)}` },
            ];
            this.loading.set(false);
          },
          error: (err: any) => {
            console.error('Failed to load session:', err);
            this.error.set(err.error?.message || 'Failed to load session');
            this.loading.set(false);
          },
        });
      },
      error: (err: any) => {
        console.error('Failed to load categories:', err);
        this.error.set(err.error?.message || 'Failed to load categories');
        this.loading.set(false);
      },
    });
  }

  // Category bucket actions
  startAddCategory(): void {
    const firstAvailable = this.availableCategories()[0];
    if (firstAvailable) {
      this.newBucket.set({
        categoryId: firstAvailable.id,
        weightKg: 0,
        count: 0,
      });
    }
  }

  cancelAddCategory(): void {
    this.newBucket.set(null);
  }

  selectNewCategory(categoryId: string): void {
    const current = this.newBucket();
    if (current) {
      this.newBucket.set({ ...current, categoryId });
    }
  }

  updateNewBucketWeight(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    const current = this.newBucket();
    if (current) {
      this.newBucket.set({ ...current, weightKg: value });
    }
  }

  updateNewBucketCount(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value) || 0;
    const current = this.newBucket();
    if (current) {
      this.newBucket.set({ ...current, count: value });
    }
  }

  saveNewBucket(): void {
    const bucket = this.newBucket();
    const sessionId = this.session()?.id;
    if (!bucket || !sessionId) return;

    // Validate weight doesn't exceed remaining
    if (!this.canAddWeight()) {
      this.error.set(this.weightValidationError());
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.sortingService.addBucket(sessionId, {
      categoryId: bucket.categoryId,
      outputWeightKg: bucket.weightKg,
      outputCount: bucket.count,
    }).subscribe({
      next: (newBucket) => {
        // Update session buckets locally for immediate UI update
        const currentSession = this.session();
        if (currentSession) {
          // Enrich bucket with category data from local categories
          const category = this.categories().find(c => c.id === newBucket.categoryId);
          const enrichedBucket: SortCategoryBucket = {
            ...newBucket,
            category: category || undefined,
          };
          const updatedBuckets = [...(currentSession.buckets || []), enrichedBucket];
          this.session.set({ ...currentSession, buckets: updatedBuckets });
        }
        this.newBucket.set(null);
        this.saving.set(false);
      },
      error: (err: any) => {
        console.error('Failed to add bucket:', err);
        this.error.set(err.error?.message || 'Failed to add category bucket');
        this.saving.set(false);
      },
    });
  }

  // Edit bucket
  startEditBucket(bucket: SortCategoryBucket): void {
    this.editingBucket.set({
      bucketId: bucket.id,
      weightKg: bucket.outputWeightKg,
      count: bucket.outputCount,
    });
  }

  cancelEditBucket(): void {
    this.editingBucket.set(null);
  }

  updateEditingWeight(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    const current = this.editingBucket();
    if (current) {
      this.editingBucket.set({ ...current, weightKg: value });
    }
  }

  updateEditingCount(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value) || 0;
    const current = this.editingBucket();
    if (current) {
      this.editingBucket.set({ ...current, count: value });
    }
  }

  saveEditBucket(): void {
    const editing = this.editingBucket();
    const sessionId = this.session()?.id;
    if (!editing || !sessionId) return;

    // Validate weight doesn't exceed remaining
    if (!this.canSaveEditWeight()) {
      this.error.set(this.weightValidationError());
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.sortingService.updateBucket(editing.bucketId, {
      outputWeightKg: editing.weightKg,
      outputCount: editing.count,
    }).subscribe({
      next: (updatedBucket) => {
        // Update session buckets locally for immediate UI update
        const currentSession = this.session();
        if (currentSession) {
          const updatedBuckets = (currentSession.buckets || []).map(b => {
            if (b.id === editing.bucketId) {
              // Preserve the existing category data since backend doesn't return it
              return { ...updatedBucket, category: b.category };
            }
            return b;
          });
          this.session.set({ ...currentSession, buckets: updatedBuckets });
        }
        this.editingBucket.set(null);
        this.saving.set(false);
      },
      error: (err: any) => {
        console.error('Failed to update bucket:', err);
        this.error.set(err.error?.message || 'Failed to update category bucket');
        this.saving.set(false);
      },
    });
  }

  // Delete bucket
  confirmDeleteBucket(bucketId: string): void {
    this.deletingBucketId.set(bucketId);
    this.showDeleteConfirm.set(true);
  }

  deleteBucket(): void {
    const bucketId = this.deletingBucketId();
    const sessionId = this.session()?.id;
    if (!bucketId || !sessionId) return;

    this.saving.set(true);
    this.error.set(null);
    this.showDeleteConfirm.set(false);
    this.sortingService.deleteBucket(bucketId).subscribe({
      next: () => {
        // Update session buckets locally for immediate UI update
        const currentSession = this.session();
        if (currentSession) {
          const updatedBuckets = (currentSession.buckets || []).filter(b => b.id !== bucketId);
          this.session.set({ ...currentSession, buckets: updatedBuckets });
        }
        this.deletingBucketId.set(null);
        this.saving.set(false);
      },
      error: (err: any) => {
        console.error('Failed to delete bucket:', err);
        this.error.set(err.error?.message || 'Failed to delete category bucket');
        this.saving.set(false);
      },
    });
  }

  // Close session
  confirmCloseSession(): void {
    this.showCloseConfirm.set(true);
  }

  closeSession(): void {
    const sessionId = this.session()?.id;
    if (!sessionId) return;

    this.saving.set(true);
    this.showCloseConfirm.set(false);
    this.sortingService.closeSession(sessionId).subscribe({
      next: () => {
        this.loadData(sessionId);
      },
      error: (err: any) => {
        console.error('Failed to close session:', err);
        this.error.set(err.error?.message || 'Failed to close session');
        this.saving.set(false);
      },
    });
  }

  // Waste handling - waste is calculated as (input - sorted), not explicitly set
  // The backend calculates this when session is closed
  // This computed property shows the current calculated waste
  calculatedWaste = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const inputWeight = this.toNum(s.totalInputWeight);
    const sortedWeight = this.sortingTotals().totalSortedWeight;
    return Math.max(0, inputWeight - sortedWeight);
  });

  // Utility methods
  getCategoryName(bucket: SortCategoryBucket): string {
    return bucket.category?.name || 'Unknown Category';
  }

  formatWeight(kg: number | string): string {
    const num = typeof kg === 'string' ? parseFloat(kg) : kg;
    return (num || 0).toFixed(2);
  }

  getStatusVariant(status: string): 'success' | 'warning' | 'default' {
    switch (status) {
      case 'OPEN': return 'success';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  }

  // =============================================================
  // STAGE 2 GRADING ENTRY POINT
  // =============================================================

  /**
   * Get the CategoryOutput ID for a bucket (only available when session is CLOSED)
   */
  getCategoryOutputId(bucket: SortCategoryBucket): string | null {
    // CategoryOutputs are created when session closes - take the first (should be only one)
    const outputs = bucket.categoryOutputs;
    return outputs && outputs.length > 0 ? outputs[0].id : null;
  }

  /**
   * Check if a bucket has a category output (ready for grading)
   */
  canStartGrading(bucket: SortCategoryBucket): boolean {
    return this.getCategoryOutputId(bucket) !== null;
  }

  /**
   * Start grading for a category output - creates a new GradeSession and navigates to Stage 2
   */
  startGrading(bucket: SortCategoryBucket): void {
    const categoryOutputId = this.getCategoryOutputId(bucket);
    if (!categoryOutputId) {
      this.error.set('Cannot start grading: No category output found for this bucket');
      return;
    }

    this.startingGrading.set(bucket.id);
    this.error.set(null);

    this.stage2Service.createSession({ categoryOutputId }).subscribe({
      next: (gradeSession) => {
        this.startingGrading.set(null);
        // Navigate to the new grading session
        this.router.navigate(['/app/sorting/stage2', gradeSession.id]);
      },
      error: (err: any) => {
        console.error('Failed to create grading session:', err);
        this.error.set(err.error?.message || 'Failed to start grading session');
        this.startingGrading.set(null);
      },
    });
  }
}
