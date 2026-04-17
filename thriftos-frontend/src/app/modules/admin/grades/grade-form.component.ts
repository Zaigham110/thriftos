import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppTextareaComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { Grade, CreateGradeRequest, UpdateGradeRequest } from '../admin.models';

@Component({
  selector: 'app-grade-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppTextareaComponent,
    AppButtonComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>

        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">{{ isEditMode() ? 'Edit Grade' : 'New Grade' }}</h1>
          <p class="page-subtitle">Grades are used in Sorting Stage-2 and downstream reporting.</p>
        </app-stack>
      </app-page-header>

      <app-page-body>
        <app-section>
          <app-card>
            <app-form [formGroup]="form" (submitted)="onSubmit()">
              <app-form-field
                label="Name"
                [required]="true"
                [error]="form.get('name')?.hasError('required') && form.get('name')?.touched ? 'Name is required' : ''"
              >
                <app-input type="text" formControlName="name" placeholder="e.g., Grade A" />
              </app-form-field>

              <app-form-field label="Description">
                <app-textarea formControlName="description" [rows]="3" placeholder="Optional"></app-textarea>
              </app-form-field>

              <app-form-field label="Rank">
                <app-input type="number" formControlName="rank" placeholder="0" />
                <div class="text-xs text-gray-500 mt-1">Lower rank sorts earlier (e.g., A=1, B=2).</div>
              </app-form-field>

              @if (isEditMode()) {
                <app-form-field label="Status">
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      formControlName="isActive"
                      class="form-checkbox h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <span class="text-sm">Active</span>
                  </label>
                  <div class="text-xs text-gray-500 mt-1">Inactive grades are hidden from selection in new operations.</div>
                </app-form-field>
              }

              <app-stack direction="horizontal" spacing="sm">
                <app-button variant="secondary" type="button" (clickEvent)="onCancel()">Cancel</app-button>
                <app-button variant="primary" type="submit" [disabled]="form.invalid || submitting()">
                  {{ isEditMode() ? 'Update' : 'Create' }}
                </app-button>
              </app-stack>
            </app-form>
          </app-card>
        </app-section>
      </app-page-body>
    </app-page>
  `,
})
export class GradeFormComponent {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly grade = signal<Grade | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/app/admin' },
    { label: 'Grades', route: '/app/admin/grades' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    rank: [0],
    isActive: [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/app/admin' },
        { label: 'Grades', route: '/app/admin/grades' },
        { label: 'Edit' },
      ]);
      this.loadGrade(id);
    }
  }

  private loadGrade(id: string) {
    this.adminService.getGrade(id).subscribe({
      next: (data) => {
        this.grade.set(data);
        this.form.patchValue({
          name: data.name,
          description: data.description || '',
          rank: data.rank,
          isActive: data.isActive,
        });
      },
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateGradeRequest = {
        name: raw.name || undefined,
        description: raw.description || undefined,
        rank: raw.rank ?? 0,
        isActive: raw.isActive === true,
      };

      this.adminService.updateGrade(this.grade()!.id, dto).subscribe({
        next: () => this.router.navigate(['/app/admin/grades']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateGradeRequest = {
      name: raw.name!,
      description: raw.description || undefined,
      rank: raw.rank ?? 0,
    };

    this.adminService.createGrade(dto).subscribe({
      next: () => this.router.navigate(['/app/admin/grades']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/app/admin/grades']);
  }
}
