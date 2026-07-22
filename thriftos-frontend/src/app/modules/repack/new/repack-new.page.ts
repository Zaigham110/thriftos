/**
 * Repack New Unit Component
 * Phase 2: Repack Module UI
 * 
 * Form page to initialize a new Repack Unit Draft.
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft,
  Box,
  Plus,
  Layers,
  Sparkles,
  Scale,
  Package,
} from 'lucide-angular';

import { RepackService } from '../repack.service';
import { SortingFacadeService } from '../../sorting/sorting-facade.service';
import { Category, Grade, MeasurementType } from '../repack.models';
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
  selector: 'app-repack-new',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './repack-new.page.html',
  styleUrl: './repack-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackNewComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly repackService = inject(RepackService);

  private readonly facade = inject(SortingFacadeService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Packaging', route: '/app/packaging/repack' },
    { label: 'Repack Registry', route: '/app/packaging/repack' },
    { label: 'Create Repack Unit' },
  ];

  readonly icons = {
    ArrowLeft,
    Box,
    Plus,
    Layers,
    Sparkles,
    Scale,
    Package,
  };

  // Form controls
  readonly categoryId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly gradeId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly measurementType = new FormControl<MeasurementType>('WEIGHT', { nonNullable: true });
  readonly targetAmount = new FormControl<number>(100, { nonNullable: true, validators: [Validators.min(0.01)] });

  // Reference data
  readonly categories = signal<Category[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  readonly categoryOptions = computed(() =>
    this.categories().map((c) => ({ label: c.name, value: c.id }))
  );

  readonly gradeOptions = computed(() =>
    this.grades().map((g) => ({ label: g.name, value: g.id }))
  );

  ngOnInit(): void {
    this.loadReferenceData();
  }

  loadReferenceData(): void {
    this.loading.set(true);

    forkJoin([
      this.repackService.getCategories(),
      this.repackService.getGrades(),
    ]).subscribe({
      next: ([cats, grades]) => {
        this.categories.set(cats || []);
        this.grades.set(grades || []);
        
        // Auto-select if passed in queryParams (e.g. from Output Registry "Start Repack")
        const fromGradingOutputId = this.route.snapshot.queryParamMap.get('fromGradingOutputId');
        if (fromGradingOutputId) {
          this.facade.output(fromGradingOutputId).subscribe({
            next: (out) => {
              const catId = (out as any)?.gradeBucket?.gradeSession?.categoryOutput?.categoryId || (out as any)?.categoryId;
              if (catId) {
                this.categoryId.setValue(catId);
              }
              if (out?.gradeId) {
                this.gradeId.setValue(out.gradeId);
              }
              const weight = Number((out as any)?.remainingAmount ?? (out as any)?.totalAmount ?? out?.weightKg ?? 0);
              if (weight > 0) {
                this.targetAmount.setValue(weight);
              }
            },
          });
        }

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load reference data');
        this.loading.set(false);
      },
    });
  }

  createDraft(): void {
    if (!this.categoryId.value || !this.gradeId.value || !(this.targetAmount.value > 0)) {
      this.error.set('Please fill out all required fields with a target amount > 0.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    this.repackService.createDraft({
      categoryId: this.categoryId.value,
      gradeId: this.gradeId.value,
      targetAmount: Number(this.targetAmount.value),
      measurementType: this.measurementType.value,
    }).subscribe({
      next: (draft) => {
        this.creating.set(false);
        this.router.navigate(['/app/packaging/repack', draft.id]);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err?.message || 'Failed to create repack draft');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/app/packaging/repack']);
  }
}
