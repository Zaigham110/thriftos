/**
 * User Form Drawer Component
 * Phase 8: Tenant Administration
 * 
 * Drawer for creating and editing users.
 */

import { ChangeDetectionStrategy, Component, input, output, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, Save, Loader2 } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { User, Role } from '../admin.models';
import {
  DrawerComponent,
  AlertComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-user-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    AlertComponent,
  ],
  templateUrl: './user-form-drawer.html',
  styleUrl: './user-form-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);

  readonly isOpen = input<boolean>(false);
  readonly user = input<User | null>(null);
  readonly roles = input<Role[]>([]);

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
  readonly selectedRoleIds = signal<string[]>([]);

  readonly modeOptions = [
    { value: '', label: 'Use Tenant Default Setting' },
    { value: 'FULL_ERP', label: 'Full Desktop ERP Mode' },
    { value: 'SIMPLIFIED_MOBILE', label: 'Simplified Mobile Mode' },
    { value: 'USER_CHOICE', label: 'User Choice (Allow Switcher)' },
  ];

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      preferredOperationMode: [''],
    });

    // Watch for user changes to reset form
    effect(() => {
      const currentUser = this.user();
      if (currentUser) {
        this.form.patchValue({
          name: currentUser.name,
          email: currentUser.email,
          password: '',
          preferredOperationMode: currentUser.preferredOperationMode || '',
        });
        // Password not required for edits
        this.form.get('password')?.clearValidators();
        this.form.get('password')?.updateValueAndValidity();
        
        // Set selected roles
        const roleIds = currentUser.userRoles?.map(ur => ur.roleId) || [];
        this.selectedRoleIds.set(roleIds);
      } else {
        this.form.reset({
          name: '',
          email: '',
          password: '',
          preferredOperationMode: '',
        });
        this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
        this.form.get('password')?.updateValueAndValidity();
        this.selectedRoleIds.set([]);
      }
      this.formError.set(null);
    });
  }

  get isEditMode(): boolean {
    return !!this.user();
  }

  get title(): string {
    return this.isEditMode ? 'Edit User' : 'Add User';
  }

  isRoleSelected(roleId: string): boolean {
    return this.selectedRoleIds().includes(roleId);
  }

  toggleRole(roleId: string): void {
    this.selectedRoleIds.update(ids => {
      if (ids.includes(roleId)) {
        return ids.filter(id => id !== roleId);
      } else {
        return [...ids, roleId];
      }
    });
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
    const roleIds = this.selectedRoleIds();
    const preferredOperationMode = formValue.preferredOperationMode || null;

    if (this.isEditMode) {
      // Update existing user
      const updateData: { name?: string; email?: string; preferredOperationMode?: any } = {
        preferredOperationMode,
      };
      if (formValue.name !== this.user()!.name) updateData.name = formValue.name;
      if (formValue.email !== this.user()!.email) updateData.email = formValue.email;

      // First update user info, then roles
      this.adminService.updateUser(this.user()!.id, updateData).subscribe({
        next: () => {
          // Then assign roles
          this.adminService.assignUserRoles(this.user()!.id, roleIds).subscribe({
            next: () => {
              this.saving.set(false);
              this.saved.emit();
            },
            error: (err) => {
              this.saving.set(false);
              this.formError.set(err.message || 'Failed to assign roles');
            },
          });
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.message || 'Failed to update user');
        },
      });
    } else {
      // Create new user
      this.adminService.createUser({
        name: formValue.name,
        email: formValue.email,
        password: formValue.password,
        roleIds,
        preferredOperationMode,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.message || 'Failed to create user');
        },
      });
    }
  }

  getFieldError(fieldName: string): string | null {
    const control = this.form.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['email']) return 'Invalid email address';
      if (control.errors['minlength']) {
        const min = control.errors['minlength'].requiredLength;
        return `Minimum ${min} characters required`;
      }
    }
    return null;
  }
}
