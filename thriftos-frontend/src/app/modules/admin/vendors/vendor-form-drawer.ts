/**
 * Vendor Form Drawer Component
 * Phase 8: Tenant Administration
 * 
 * Drawer for creating and editing vendors.
 */

import { ChangeDetectionStrategy, Component, input, output, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, Save, Loader2 } from 'lucide-angular';
import { AdminService } from '../admin.service';
import { Vendor } from '../admin.models';
import { DrawerComponent, AlertComponent } from '../../../shared/ui';

@Component({
  selector: 'app-vendor-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    DrawerComponent,
    AlertComponent,
  ],
  templateUrl: './vendor-form-drawer.html',
  styleUrl: './vendor-form-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorFormDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);

  readonly isOpen = input<boolean>(false);
  readonly vendor = input<Vendor | null>(null);

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
      country: [''],
      contactInfo: [''],
    });

    // Watch for vendor changes to reset form
    effect(() => {
      const currentVendor = this.vendor();
      if (currentVendor) {
        this.form.patchValue({
          name: currentVendor.name,
          country: currentVendor.country || '',
          contactInfo: currentVendor.contactInfo || '',
        });
      } else {
        this.form.reset();
      }
      this.formError.set(null);
    });
  }

  get isEditMode(): boolean {
    return !!this.vendor();
  }

  get title(): string {
    return this.isEditMode ? 'Edit Vendor' : 'Add Vendor';
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

    const payload = {
      name: formValue.name,
      country: formValue.country || undefined,
      contactInfo: formValue.contactInfo || undefined,
    };

    const request$ = this.isEditMode
      ? this.adminService.updateVendor(this.vendor()!.id, payload)
      : this.adminService.createVendor(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.message || (this.isEditMode ? 'Failed to update vendor' : 'Failed to create vendor'));
      },
    });
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
