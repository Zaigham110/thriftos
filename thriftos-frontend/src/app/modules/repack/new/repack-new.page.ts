/**
 * REPACK NEW PAGE — CREATE DRAFT
 * ===============================
 * Simple form to create a new repack draft
 */

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { RepackService } from '../repack.service';
import { Category, Grade, MeasurementType } from '../repack.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
  AppSelectComponent,
  AppLoadingComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-repack-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppButtonComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppSelectComponent,
    AppLoadingComponent,
  ],
  templateUrl: './repack-new.page.html',
  styleUrl: './repack-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepackNewComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly repackService = inject(RepackService);

  // Breadcrumbs
  readonly breadcrumbs = [
    { label: 'Packaging', link: '/packaging' },
    { label: 'Repack', link: '/packaging/repack' },
    { label: 'New', link: undefined },
  ];

  // Form state
  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedGradeId = signal<string | null>(null);
  readonly targetAmount = signal<number>(0);
  readonly measurementType = signal<MeasurementType>('WEIGHT');

  // Reference data
  readonly categories = signal<Category[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly loadingRef = signal(false);

  // Form submission
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  // Options for selects
  readonly categoryOptions = computed(() =>
    this.categories().map(c => ({ label: c.name, value: c.id }))
  );
  readonly gradeOptions = computed(() =>
    this.grades().map(g => ({ label: g.name, value: g.id }))
  );
  readonly measurementOptions = [
    { label: 'Weight (kg)', value: 'WEIGHT' },
    { label: 'Quantity (pcs)', value: 'QUANTITY' },
  ];

  // Validation
  readonly canCreate = computed(() => {
    return this.selectedCategoryId() &&
           this.selectedGradeId() &&
           this.targetAmount() > 0 &&
           !this.creating();
  });

  ngOnInit(): void {
    this.loadReferenceData();
  }

  loadReferenceData(): void {
    this.loadingRef.set(true);
    
    forkJoin([
      this.repackService.getCategories(),
      this.repackService.getGrades(),
    ]).subscribe({
      next: ([cats, grades]) => {
        this.categories.set(cats || []);
        this.grades.set(grades || []);
        this.loadingRef.set(false);
      },
      error: () => {
        this.loadingRef.set(false);
      },
    });
  }

  onCategoryChange(value: string): void {
    this.selectedCategoryId.set(value);
  }

  onGradeChange(value: string): void {
    this.selectedGradeId.set(value);
  }

  onTargetChange(value: string | number): void {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    this.targetAmount.set(num);
  }

  onMeasurementChange(value: MeasurementType): void {
    this.measurementType.set(value);
  }

  createDraft(): void {
    if (!this.canCreate()) return;

    this.creating.set(true);
    this.error.set(null);

    this.repackService.createDraft({
      categoryId: this.selectedCategoryId()!,
      gradeId: this.selectedGradeId()!,
      targetAmount: this.targetAmount(),
      measurementType: this.measurementType(),
    }).subscribe({
      next: (draft) => {
        this.creating.set(false);
        // Navigate to workspace with new draft
        this.router.navigate(['/packaging/repack', draft.id]);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err.message);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/packaging/repack']);
  }
}
