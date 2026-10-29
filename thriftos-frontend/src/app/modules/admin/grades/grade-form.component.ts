/**
 * Grade Form Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/grades/new or /app/admin/grades/:id/edit
 * 
 * Form for creating and editing Stage-2 quality grades.
 */

import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Loader2,
  Award,
} from 'lucide-angular';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
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
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <div class="header-left-group">
          <div class="eyebrow-container">
            <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>
          </div>
          <h1 class="page-title">{{ isEditMode() ? 'Edit Quality Grade' : 'New Quality Grade' }}</h1>
          <p class="page-subtitle">Configure Stage-2 item quality grades, ranking hierarchy, and active status.</p>
        </div>

        <div class="header-right-actions">
          <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
            <lucide-icon [img]="icons.ArrowLeft" [size]="15"></lucide-icon>
            Back to Grades
          </button>
        </div>
      </app-page-header>

      <app-page-body>
        <div class="form-container-card">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="grade-form">
            
            <!-- Grade Name -->
            <div class="form-group">
              <label class="form-label required">Grade Name</label>
              <input
                type="text"
                formControlName="name"
                class="form-input"
                placeholder="e.g. Grade A, Cream Grade, Vintage Premium, Grade B"
                [class.has-error]="form.get('name')?.invalid && form.get('name')?.touched"
              />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <span class="field-error">Grade name is required</span>
              }
            </div>

            <!-- Rank -->
            <div class="form-group">
              <label class="form-label">Quality Rank Index</label>
              <input
                type="number"
                formControlName="rank"
                class="form-input"
                placeholder="0"
              />
              <span class="field-hint">Lower rank numbers prioritize higher quality grades in Stage-2 grading sessions (e.g. 1 = Grade A).</span>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label">Grade Description & Criteria</label>
              <textarea
                formControlName="description"
                class="form-textarea"
                rows="3"
                placeholder="Describe quality criteria, condition expectations, or inspection standards for this grade..."
              ></textarea>
            </div>

            <!-- Active Status (Edit Mode) -->
            @if (isEditMode()) {
              <div class="form-group">
                <label class="checkbox-container">
                  <input
                    type="checkbox"
                    formControlName="isActive"
                    class="custom-checkbox"
                  />
                  <div class="checkbox-text">
                    <span class="checkbox-title">Active Quality Grade</span>
                    <span class="checkbox-desc">Inactive grades are hidden from selection in new Stage-2 grading sessions.</span>
                  </div>
                </label>
              </div>
            }

            <!-- Form Actions -->
            <div class="form-footer-actions">
              <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
                Cancel
              </button>
              <button class="btn btn-primary" type="submit" [disabled]="form.invalid || submitting()">
                @if (submitting()) {
                  <lucide-icon [img]="icons.Loader2" [size]="15" class="animate-spin"></lucide-icon>
                  Saving...
                } @else {
                  <lucide-icon [img]="icons.Save" [size]="15"></lucide-icon>
                  {{ isEditMode() ? 'Update Grade' : 'Create Grade' }}
                }
              </button>
            </div>
          </form>
        </div>
      </app-page-body>
    </app-page>
  `,
  styles: [`
    @use '../../../../styles/variables' as *;

    .form-container-card {
      max-width: 680px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
    }

    .grade-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0f172a;

      &.required::after {
        content: ' *';
        color: #ef4444;
      }
    }

    .form-input, .form-textarea {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.375rem;
      background: white;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;

      &:focus {
        outline: none;
        border-color: #714b67;
        box-shadow: 0 0 0 3px rgba(113, 75, 103, 0.12);
      }

      &.has-error {
        border-color: #ef4444;
      }
    }

    .form-textarea {
      resize: vertical;
      font-family: inherit;
    }

    .field-hint {
      font-size: 0.75rem;
      color: #64748b;
    }

    .field-error {
      font-size: 0.75rem;
      font-weight: 500;
      color: #ef4444;
    }

    .checkbox-container {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      cursor: pointer;
    }

    .custom-checkbox {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: #714b67;
      margin-top: 0.125rem;
    }

    .checkbox-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .checkbox-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
    }

    .checkbox-desc {
      font-size: 0.75rem;
      color: #64748b;
    }

    .form-footer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.625rem;
      margin-top: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4375rem;
      padding: 0.4375rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: 0.375rem;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

      &-primary {
        background: #714b67;
        color: white;

        &:hover:not(:disabled) {
          background: #5b3c53;
          transform: translateY(-1px);
        }
      }

      &-secondary {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #334155;

        &:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradeFormComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly grade = signal<Grade | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Award,
  };

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Grades', route: '/settings/admin/grades' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    rank: [0],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/settings/admin' },
        { label: 'Grades', route: '/settings/admin/grades' },
        { label: 'Edit' },
      ]);
      this.loadGrade(id);
    }
  }

  private loadGrade(id: string): void {
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

  onSubmit(): void {
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
        next: () => this.router.navigate(['/settings/admin/grades']),
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
      next: () => this.router.navigate(['/settings/admin/grades']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/settings/admin/grades']);
  }
}
