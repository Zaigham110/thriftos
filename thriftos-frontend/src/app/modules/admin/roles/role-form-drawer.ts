/**
 * Role Form Drawer Component
 * Phase 8: Tenant Administration
 * 
 * Drawer for creating and editing roles.
 */

import { ChangeDetectionStrategy, Component, input, output, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, Save, Loader2 } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Role } from '../admin.models';
import { DrawerComponent, AlertComponent } from '../../../shared/ui';

@Component({
  selector: 'app-role-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    AlertComponent,
  ],
  templateUrl: './role-form-drawer.html',
  styleUrl: './role-form-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);

  readonly isOpen = input<boolean>(false);
  readonly role = input<Role | null>(null);

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
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
    });

    // Watch for role changes to reset form
    effect(() => {
      const currentRole = this.role();
      if (currentRole) {
        this.form.patchValue({
          name: currentRole.name,
          description: currentRole.description || '',
        });
      } else {
        this.form.reset();
      }
      this.formError.set(null);
    });
  }

  get isEditMode(): boolean {
    return !!this.role();
  }

  get title(): string {
    return this.isEditMode ? 'Edit Role' : 'Add Role';
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
      this.adminService.updateRole(this.role()!.id, {
        name: formValue.name,
        description: formValue.description || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.message || 'Failed to update role');
        },
      });
    } else {
      this.adminService.createRole({
        name: formValue.name,
        description: formValue.description || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.message || 'Failed to create role');
        },
      });
    }
  }

  getFieldError(fieldName: string): string | null {
    const control = this.form.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['minlength']) {
        const min = control.errors['minlength'].requiredLength;
        return `Minimum ${min} characters required`;
      }
    }
    return null;
  }
}
