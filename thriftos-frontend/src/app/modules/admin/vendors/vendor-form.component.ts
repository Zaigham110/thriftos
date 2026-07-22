/**
 * Vendor Form Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/vendors/new or /app/admin/vendors/:id/edit
 * 
 * Form for creating and editing procurement vendors/suppliers.
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
  Store,
  Globe,
  PhoneCall,
} from 'lucide-angular';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { Vendor, CreateVendorRequest, UpdateVendorRequest } from '../admin.models';

@Component({
  selector: 'app-vendor-form',
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
          <h1 class="page-title">{{ isEditMode() ? 'Edit Vendor Supplier' : 'New Vendor Supplier' }}</h1>
          <p class="page-subtitle">Configure procurement vendor name, origin country, and contact notes.</p>
        </div>

        <div class="header-right-actions">
          <button class="btn btn-secondary" type="button" (click)="onCancel()" [disabled]="submitting()">
            <lucide-icon [img]="icons.ArrowLeft" [size]="15"></lucide-icon>
            Back to Vendors
          </button>
        </div>
      </app-page-header>

      <app-page-body>
        <div class="form-container-card">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="vendor-form">
            
            <!-- Vendor Name -->
            <div class="form-group">
              <label class="form-label required">Vendor / Supplier Name</label>
              <input
                type="text"
                formControlName="name"
                class="form-input"
                placeholder="e.g. ABC Global Traders, Tex Export LLC"
                [class.has-error]="form.get('name')?.invalid && form.get('name')?.touched"
              />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <span class="field-error">Vendor name is required</span>
              }
            </div>

            <!-- Vendor Type / Role -->
            <div class="form-group">
              <label class="form-label required">Vendor Role / Classification</label>
              <select formControlName="vendorType" class="form-select">
                <option value="SUPPLIER">Supplier (Procurement Vendor)</option>
                <option value="CUSTOMER">Customer (Buyer)</option>
                <option value="SHIPPER">Shipper / Freight Logistics Partner</option>
                <option value="CONSIGNEE">Consignee (Destination Receiver)</option>
                <option value="OTHER">Other Partner</option>
              </select>
              <span class="field-hint">Classifies the operational role of this partner across procurement and logistics.</span>
            </div>

            <!-- Country -->
            <div class="form-group">
              <label class="form-label">Origin Country</label>
              <input
                type="text"
                formControlName="country"
                class="form-input"
                placeholder="e.g. Pakistan, United States, United Arab Emirates"
              />
              <span class="field-hint">Country of operation or shipment origin for incoming procurement.</span>
            </div>

            <!-- Contact Info -->
            <div class="form-group">
              <label class="form-label">Contact Details & Notes</label>
              <textarea
                formControlName="contactInfo"
                class="form-textarea"
                rows="4"
                placeholder="Contact person, phone numbers, email addresses, payment terms, or warehouse location notes..."
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
                    <span class="checkbox-title">Active Supplier Status</span>
                    <span class="checkbox-desc">Inactive vendors are hidden from selection in new procurement purchase orders.</span>
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
                  {{ isEditMode() ? 'Update Vendor' : 'Create Vendor' }}
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

    .vendor-form {
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

    .form-input, .form-select, .form-textarea {
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
export class VendorFormComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly vendor = signal<Vendor | null>(null);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Store,
    Globe,
    PhoneCall,
  };

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/app/admin' },
    { label: 'Vendors', route: '/app/admin/vendors' },
    { label: 'New' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    vendorType: ['SUPPLIER', Validators.required],
    country: [''],
    contactInfo: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/app/admin' },
        { label: 'Vendors', route: '/app/admin/vendors' },
        { label: 'Edit' },
      ]);
      this.loadVendor(id);
    }
  }

  private loadVendor(id: string): void {
    this.adminService.getVendor(id).subscribe({
      next: (data) => {
        this.vendor.set(data);
        this.form.patchValue({
          name: data.name,
          vendorType: data.vendorType || 'SUPPLIER',
          country: data.country || '',
          contactInfo: data.contactInfo || '',
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
      const dto: UpdateVendorRequest = {
        name: raw.name || undefined,
        vendorType: (raw.vendorType as any) || undefined,
        country: raw.country || undefined,
        contactInfo: raw.contactInfo || undefined,
        isActive: raw.isActive === true,
      };

      this.adminService.updateVendor(this.vendor()!.id, dto).subscribe({
        next: () => this.router.navigate(['/app/admin/vendors']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateVendorRequest = {
      name: raw.name!,
      vendorType: (raw.vendorType as any) || 'SUPPLIER',
      country: raw.country || undefined,
      contactInfo: raw.contactInfo || undefined,
    };

    this.adminService.createVendor(dto).subscribe({
      next: () => this.router.navigate(['/app/admin/vendors']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/app/admin/vendors']);
  }
}
