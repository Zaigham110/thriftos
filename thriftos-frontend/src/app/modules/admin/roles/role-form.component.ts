import { Component, inject, signal } from '@angular/core';
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
  AppTextareaComponent,
  AppButtonComponent,
  AppStackComponent,
  AppBreadcrumbComponent,
  AppCheckboxComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { PermissionGroup, Role, CreateRoleRequest, UpdateRoleRequest } from '../admin.models';

@Component({
  selector: 'app-role-form',
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
    AppTextareaComponent,
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
          <h1 class="page-title">{{ isEditMode() ? 'Edit Role' : 'New Role' }}</h1>
          <p class="page-subtitle">Roles are permission bundles. UI visibility is permission-driven.</p>
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
                <app-input type="text" formControlName="name" placeholder="e.g., Warehouse Manager" />
              </app-form-field>

              <app-form-field label="Description">
                <app-textarea formControlName="description" [rows]="3" placeholder="Optional"></app-textarea>
              </app-form-field>

              <app-form-field label="Permissions" [required]="true">
                @if (permissionsLoading()) {
                  <div class="text-sm text-gray-600">Loading permissions…</div>
                } @else if (permissionGroups().length === 0) {
                  <div class="text-sm text-gray-600">No permissions found.</div>
                } @else {
                  <div class="space-y-3">
                    @for (group of permissionGroups(); track group.name) {
                      <div class="rounded border border-gray-200">
                        <div class="px-3 py-2 bg-gray-50 text-sm font-medium">{{ group.name }}</div>
                        <div class="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          @for (perm of group.permissions; track perm.id) {
                            <label class="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                              <app-checkbox
                                [ngModel]="isPermissionSelected(perm.id)"
                                [ngModelOptions]="{ standalone: true }"
                                (ngModelChange)="togglePermission(perm.id, $event)"
                              ></app-checkbox>
                              <div class="min-w-0">
                                <div class="text-sm font-medium truncate">{{ perm.name }}</div>
                                <div class="text-xs text-gray-500 truncate">{{ perm.code }}</div>
                              </div>
                            </label>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  @if (selectedPermissionIds().length === 0) {
                    <div class="text-xs text-red-600 mt-2">Select at least one permission.</div>
                  }
                }
              </app-form-field>

              <app-stack direction="horizontal" spacing="sm">
                <app-button variant="secondary" type="button" (clickEvent)="onCancel()">Cancel</app-button>
                <app-button
                  variant="primary"
                  type="submit"
                  [disabled]="form.invalid || selectedPermissionIds().length === 0 || submitting()"
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
export class RoleFormComponent {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly role = signal<Role | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);
  readonly permissionsLoading = signal(true);

  readonly permissionGroups = this.adminService.permissionGroups;

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Roles', route: '/settings/admin/roles' },
    { label: 'New' },
  ]);

  private readonly _selectedPermissionIds = signal<string[]>([]);
  readonly selectedPermissionIds = this._selectedPermissionIds.asReadonly();

  readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit() {
    this.adminService.loadPermissionsGrouped().subscribe({
      next: () => this.permissionsLoading.set(false),
      error: () => this.permissionsLoading.set(false),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/settings/admin' },
        { label: 'Roles', route: '/settings/admin/roles' },
        { label: 'Edit' },
      ]);
      this.loadRole(id);
    }
  }

  private loadRole(id: string) {
    this.adminService.getRole(id).subscribe({
      next: (data) => {
        this.role.set(data);
        this.form.patchValue({
          name: data.name,
          description: data.description || '',
        });

        const permissionIds = (data.rolePermissions || [])
          .map((rp) => rp.permissionId)
          .filter(Boolean);
        this._selectedPermissionIds.set(permissionIds);
      },
    });
  }

  isPermissionSelected(permissionId: string): boolean {
    return this._selectedPermissionIds().includes(permissionId);
  }

  togglePermission(permissionId: string, checked: boolean) {
    const current = new Set(this._selectedPermissionIds());
    if (checked) current.add(permissionId);
    else current.delete(permissionId);
    this._selectedPermissionIds.set(Array.from(current));
  }

  onSubmit() {
    if (this.form.invalid) return;
    if (this._selectedPermissionIds().length === 0) return;

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    if (this.isEditMode()) {
      const dto: UpdateRoleRequest = {
        name: raw.name || undefined,
        description: raw.description || undefined,
      };

      this.adminService.updateRole(this.role()!.id, dto).subscribe({
        next: (updated) => {
          this.adminService.assignRolePermissions(updated.id, this._selectedPermissionIds()).subscribe({
            next: () => this.router.navigate(['/settings/admin/roles']),
            error: () => this.submitting.set(false),
          });
        },
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateRoleRequest = {
      name: raw.name!,
      description: raw.description || undefined,
    };

    this.adminService.createRole(dto).subscribe({
      next: (created) => {
        this.adminService.assignRolePermissions(created.id, this._selectedPermissionIds()).subscribe({
          next: () => this.router.navigate(['/settings/admin/roles']),
          error: () => this.submitting.set(false),
        });
      },
      error: () => this.submitting.set(false),
    });
  }

  onCancel() {
    this.router.navigate(['/settings/admin/roles']);
  }
}
