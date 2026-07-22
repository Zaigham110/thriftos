import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppPasswordInputComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
  AppCheckboxComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { CreateUserRequest, Role, UpdateUserRequest, User } from '../admin.models';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppPasswordInputComponent,
    AppButtonComponent,
    AppStackComponent,
    AppBreadcrumbComponent,
    AppCheckboxComponent,
  ],
  template: `
    <app-page>
      <app-page-header>
        <app-breadcrumb [items]="breadcrumbs()"></app-breadcrumb>

        <app-stack direction="vertical" spacing="xs">
          <h1 class="page-title">{{ isEditMode() ? 'Edit User' : 'New User' }}</h1>
          <p class="page-subtitle">Users belong to a tenant and must be assigned one or more roles.</p>
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
                <app-input type="text" formControlName="name" placeholder="e.g., Ayesha Khan" />
              </app-form-field>

              <app-form-field
                label="Email"
                [required]="true"
                [error]="form.get('email')?.hasError('required') && form.get('email')?.touched ? 'Email is required' : ''"
              >
                <app-input type="email" formControlName="email" placeholder="e.g., ayesha@company.com" />
              </app-form-field>

              @if (!isEditMode()) {
                <app-form-field
                  label="Password"
                  [required]="true"
                  [error]="form.get('password')?.hasError('required') && form.get('password')?.touched ? 'Password is required' : ''"
                >
                  <app-password-input formControlName="password" placeholder="Minimum 8 characters" />
                </app-form-field>
              } @else {
                <app-form-field label="Status">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <app-checkbox formControlName="isActive"></app-checkbox>
                    <span class="text-sm font-medium">User is Active</span>
                  </label>
                </app-form-field>
              }

              <app-form-field label="Roles" [required]="true">
                @if (rolesLoading()) {
                  <div class="text-sm text-gray-600">Loading roles…</div>
                } @else if (roles().length === 0) {
                  <div class="text-sm text-gray-600">No roles available. Create a role first.</div>
                } @else {
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    @for (role of roles(); track role.id) {
                      <label class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                        <app-checkbox
                          [ngModel]="isRoleSelected(role.id)"
                          [ngModelOptions]="{ standalone: true }"
                          (ngModelChange)="toggleRole(role.id, $event)"
                        ></app-checkbox>
                        <div class="min-w-0">
                          <div class="text-sm font-medium truncate">{{ role.name }}</div>
                          <div class="text-xs text-gray-500 truncate">{{ role.description || '—' }}</div>
                        </div>
                      </label>
                    }
                  </div>
                  @if (selectedRoleIds().length === 0) {
                    <div class="text-xs text-red-600 mt-2">Select at least one role.</div>
                  }
                }
              </app-form-field>

              <app-stack direction="horizontal" spacing="sm">
                <app-button variant="secondary" type="button" (clickEvent)="onCancel()">Cancel</app-button>
                <app-button
                  variant="primary"
                  type="submit"
                  [disabled]="form.invalid || selectedRoleIds().length === 0 || submitting()"
                >
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
export class UserFormComponent {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly user = signal<User | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);
  readonly rolesLoading = signal(true);

  readonly roles = this.adminService.roles;

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/app/admin' },
    { label: 'Users', route: '/app/admin/users' },
    { label: 'New' },
  ]);

  private readonly _selectedRoleIds = signal<string[]>([]);
  readonly selectedRoleIds = this._selectedRoleIds.asReadonly();

  readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', Validators.required],
    password: ['', Validators.required],
    isActive: [true],
  });

  ngOnInit() {
    this.adminService.loadRoles().subscribe({
      next: () => this.rolesLoading.set(false),
      error: () => this.rolesLoading.set(false),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/app/admin' },
        { label: 'Users', route: '/app/admin/users' },
        { label: 'Edit' },
      ]);
      const passwordCtrl = this.form.get('password');
      passwordCtrl?.clearValidators();
      passwordCtrl?.setValue('');
      passwordCtrl?.disable();
      passwordCtrl?.updateValueAndValidity();
      this.loadUser(id);
    }
  }

  private loadUser(id: string) {
    this.adminService.getUser(id).subscribe({
      next: (data) => {
        this.user.set(data);
        this.form.patchValue({
          name: data.name,
          email: data.email,
          isActive: data.isActive,
        });
        const roleIds = (data.userRoles || []).map((ur) => ur.roleId).filter(Boolean);
        this._selectedRoleIds.set(roleIds);
      },
    });
  }

  isRoleSelected(roleId: string): boolean {
    return this._selectedRoleIds().includes(roleId);
  }

  toggleRole(roleId: string, checked: boolean) {
    const current = new Set(this._selectedRoleIds());
    if (checked) current.add(roleId);
    else current.delete(roleId);
    this._selectedRoleIds.set(Array.from(current));
  }

  onSubmit() {
    if (this.form.invalid) return;
    if (this._selectedRoleIds().length === 0) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateUserRequest = {
        name: raw.name || undefined,
        email: raw.email || undefined,
        isActive: raw.isActive ?? undefined,
      };

      this.adminService.updateUser(this.user()!.id, dto).subscribe({
        next: (updated) => {
          this.adminService.assignUserRoles(updated.id, this._selectedRoleIds()).subscribe({
            next: () => this.router.navigate(['/app/admin/users']),
            error: () => this.submitting.set(false),
          });
        },
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateUserRequest = {
      name: raw.name!,
      email: raw.email!,
      password: raw.password!,
      roleIds: this._selectedRoleIds(),
    };

    this.adminService.createUser(dto).subscribe({
      next: () => this.router.navigate(['/app/admin/users']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/app/admin/users']);
  }
}
