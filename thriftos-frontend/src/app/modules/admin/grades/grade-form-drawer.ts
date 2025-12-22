/**
 * Grade Form Drawer Component
 * Phase 8: Tenant Administration
 * 
 * Drawer for creating and editing grades.
 */

import { ChangeDetectionStrategy, Component, input, output, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, Save, Loader2 } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Grade } from '../admin.models';
import { DrawerComponent, AlertComponent } from '../../../shared/ui';

@Component({
  selector: 'app-grade-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    AlertComponent,
  ],
  templateUrl: './grade-form-drawer.html',
  styleUrl: './grade-form-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradeFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);

  readonly isOpen = input<boolean>(false);
  readonly grade = input<Grade | null>(null);

  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly icons = {
    X,
    Save,
    Loader2,
  };

  readonly form: FormGroup;
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(10)]],
      description: [''],
    });

    // Watch for grade changes to reset form
    effect(() => {
      const currentGrade = this.grade();
      if (currentGrade) {
        this.form.patchValue({
          name: currentGrade.name,
          description: currentGrade.description || '',
        });
      } else {
        this.form.reset();
      }
      this.formError.set(null);
    });
  }

  get isEditMode(): boolean {
    return !!this.grade();
  }

  get title(): string {
    return this.isEditMode ? 'Edit Grade' : 'Add Grade';
  }

  close(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const formValue = this.form.value;

    if (this.isEditMode) {
      this.adminService.updateGrade(this.grade()!.id, {
        name: formValue.name,
        description: formValue.description || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.message || 'Failed to update grade');
        },
      });
    } else {
      this.adminService.createGrade({
        name: formValue.name,
        description: formValue.description || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.message || 'Failed to create grade');
        },
      });
    }
  }

  getFieldError(fieldName: string): string | null {
    const control = this.form.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['minlength']) return `Name must be at least 1 character`;
      if (control.errors['maxlength']) return `Name must be at most 10 characters`;
    }
    return null;
  }
}
