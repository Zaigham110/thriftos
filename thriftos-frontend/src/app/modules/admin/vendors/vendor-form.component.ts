/**
 * Vendor Form Component
 * Phase 8: Tenant Administration
 * 
 * Route: /app/admin/vendors/new or /app/admin/vendors/:id/edit
 * 
 * Specialized multi-type procurement vendor & supplier creation form.
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
  Truck,
  Package,
  Wrench,
  Building2,
  CreditCard,
  Mail,
  FileText,
} from 'lucide-angular';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
} from '../../../shared/ui';

import { AdminService } from '../admin.service';
import type { Vendor, CreateVendorRequest, UpdateVendorRequest, VendorType } from '../admin.models';

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
          <h1 class="page-title">{{ isEditMode() ? 'Edit Vendor & Trade Partner' : 'New Procurement Vendor' }}</h1>
          <p class="page-subtitle">Configure supplier classification, remittance banking, tax IDs, and commercial payment terms.</p>
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
            
            <!-- Vendor Classification & Type -->
            <div class="form-group">
              <label class="form-label required">Vendor Operational Classification</label>
              <select formControlName="vendorType" class="form-select font-bold">
                <option value="SUPPLIER">🌍 Raw Intake & Ocean Bale Supplier</option>
                <option value="FREIGHT_CARRIER">🚢 Freight & Ocean Line Carrier / Trucking</option>
                <option value="PACKAGING_SUPPLIER">📦 Packaging & Consumables Supplier</option>
                <option value="EQUIPMENT_VENDOR">🛠️ Equipment & Machinery Baler Vendor</option>
                <option value="SERVICE_PROVIDER">💼 Service & Utilities Provider</option>
                <option value="CUSTOMER">🛍️ Trade Customer & Wholesale Partner</option>
                <option value="OTHER">🏢 Other Enterprise Partner</option>
              </select>
              <span class="field-hint">Dynamically configures procurement & logistics tracking workflows.</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Vendor Display Name -->
              <div class="form-group">
                <label class="form-label required">Vendor Display Name</label>
                <input
                  type="text"
                  formControlName="name"
                  class="form-input"
                  placeholder="e.g. Tex Export LLC"
                  [class.has-error]="form.get('name')?.invalid && form.get('name')?.touched"
                />
              </div>

              <!-- Registered Company Name -->
              <div class="form-group">
                <label class="form-label">Registered Legal Company Name</label>
                <input
                  type="text"
                  formControlName="companyName"
                  class="form-input"
                  placeholder="e.g. Tex Export International Corp"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <!-- Origin Country -->
              <div class="form-group">
                <label class="form-label">Origin Country</label>
                <input
                  type="text"
                  formControlName="country"
                  class="form-input"
                  placeholder="e.g. United States, Pakistan, UAE"
                />
              </div>

              <!-- Tax ID / VAT -->
              <div class="form-group">
                <label class="form-label">Tax ID / VAT Registration #</label>
                <input
                  type="text"
                  formControlName="taxId"
                  class="form-input font-mono"
                  placeholder="US-98203910"
                />
              </div>

              <!-- Default Operating Currency -->
              <div class="form-group">
                <label class="form-label">Operating Currency</label>
                <select formControlName="defaultCurrency" class="form-select font-mono">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
            </div>

            <!-- Contact Specs Section Header -->
            <div class="section-title border-t pt-3">
              <lucide-icon [img]="icons.PhoneCall" [size]="14" class="text-primary"></lucide-icon>
              <span>Key Contact Persons & Communication</span>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div class="form-group">
                <label class="form-label">Primary Contact Person</label>
                <input
                  type="text"
                  formControlName="contactPerson"
                  class="form-input"
                  placeholder="e.g. Alex Rivera"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Contact Email</label>
                <input
                  type="email"
                  formControlName="contactEmail"
                  class="form-input"
                  placeholder="orders@supplier.com"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Contact Phone</label>
                <input
                  type="text"
                  formControlName="contactPhone"
                  class="form-input"
                  placeholder="+1 (555) 234-5678"
                />
              </div>
            </div>

            <!-- Financial & Banking Remittance Specs Header -->
            <div class="section-title border-t pt-3">
              <lucide-icon [img]="icons.CreditCard" [size]="14" class="text-primary"></lucide-icon>
              <span>Commercial Terms & Bank Remittance</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label">Procurement Payment Terms</label>
                <select formControlName="paymentTerms" class="form-select">
                  <option value="NET_30">NET 30 Days</option>
                  <option value="NET_60">NET 60 Days</option>
                  <option value="NET_15">NET 15 Days</option>
                  <option value="PREPAID">100% Advance / Prepaid</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Bank Remittance Account / IBAN</label>
                <input
                  type="text"
                  formControlName="remittanceAccount"
                  class="form-input font-mono"
                  placeholder="US38 WACH 9081 2938 1029 38"
                />
              </div>
            </div>

            <!-- Physical Address -->
            <div class="form-group">
              <label class="form-label">Physical Warehouse / Facility Address</label>
              <textarea
                formControlName="physicalAddress"
                class="form-textarea"
                rows="2"
                placeholder="Facility Street, Dock Numbers, City, State, Country"
              ></textarea>
            </div>

            <!-- Notes -->
            <div class="form-group">
              <label class="form-label">Special Delivery & Quality Notes</label>
              <textarea
                formControlName="notes"
                class="form-textarea"
                rows="2"
                placeholder="Intake bale quality instructions, container loading preferences..."
              ></textarea>
            </div>

            <!-- Active Status (Edit Mode) -->
            @if (isEditMode()) {
              <div class="form-group border-t pt-3">
                <label class="checkbox-container">
                  <input
                    type="checkbox"
                    formControlName="isActive"
                    class="custom-checkbox"
                  />
                  <div class="checkbox-text">
                    <span class="checkbox-title">Active Vendor Account</span>
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
                  {{ isEditMode() ? 'Update Vendor Specs' : 'Save Vendor Specs' }}
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
      max-width: 780px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);
    }

    .vendor-form {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #714b67;
      text-transform: uppercase;
      letter-spacing: 0.04em;
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
    Truck,
    Package,
    Wrench,
    Building2,
    CreditCard,
    Mail,
    FileText,
  };

  readonly breadcrumbs = signal([
    { label: 'Administration', route: '/settings/admin' },
    { label: 'Vendors', route: '/settings/admin/vendors' },
    { label: 'New Vendor' },
  ]);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    companyName: [''],
    vendorType: ['SUPPLIER', Validators.required],
    country: [''],
    taxId: [''],
    contactPerson: [''],
    contactEmail: [''],
    contactPhone: [''],
    contactInfo: [''],
    paymentTerms: ['NET_30'],
    defaultCurrency: ['USD'],
    remittanceAccount: [''],
    physicalAddress: [''],
    notes: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.breadcrumbs.set([
        { label: 'Administration', route: '/settings/admin' },
        { label: 'Vendors', route: '/settings/admin/vendors' },
        { label: 'Edit Vendor' },
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
          companyName: data.companyName || '',
          vendorType: (data.vendorType as any) || 'SUPPLIER',
          country: data.country || '',
          taxId: data.taxId || '',
          contactPerson: data.contactPerson || '',
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          contactInfo: data.contactInfo || '',
          paymentTerms: data.paymentTerms || 'NET_30',
          defaultCurrency: data.defaultCurrency || 'USD',
          remittanceAccount: data.remittanceAccount || '',
          physicalAddress: data.physicalAddress || '',
          notes: data.notes || '',
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
        companyName: raw.companyName || undefined,
        vendorType: (raw.vendorType as any) || undefined,
        country: raw.country || undefined,
        taxId: raw.taxId || undefined,
        contactPerson: raw.contactPerson || undefined,
        contactEmail: raw.contactEmail || undefined,
        contactPhone: raw.contactPhone || undefined,
        contactInfo: raw.contactInfo || undefined,
        paymentTerms: raw.paymentTerms || undefined,
        defaultCurrency: raw.defaultCurrency || undefined,
        remittanceAccount: raw.remittanceAccount || undefined,
        physicalAddress: raw.physicalAddress || undefined,
        notes: raw.notes || undefined,
        isActive: raw.isActive === true,
      };

      this.adminService.updateVendor(this.vendor()!.id, dto).subscribe({
        next: () => this.router.navigate(['/settings/admin/vendors']),
        error: () => this.submitting.set(false),
      });
      return;
    }

    const dto: CreateVendorRequest = {
      name: raw.name!,
      companyName: raw.companyName || undefined,
      vendorType: (raw.vendorType as any) || 'SUPPLIER',
      country: raw.country || undefined,
      taxId: raw.taxId || undefined,
      contactPerson: raw.contactPerson || undefined,
      contactEmail: raw.contactEmail || undefined,
      contactPhone: raw.contactPhone || undefined,
      contactInfo: raw.contactInfo || undefined,
      paymentTerms: raw.paymentTerms || undefined,
      defaultCurrency: raw.defaultCurrency || undefined,
      remittanceAccount: raw.remittanceAccount || undefined,
      physicalAddress: raw.physicalAddress || undefined,
      notes: raw.notes || undefined,
    };

    this.adminService.createVendor(dto).subscribe({
      next: () => this.router.navigate(['/settings/admin/vendors']),
      error: () => this.submitting.set(false),
    });
  }

  onCancel(): void {
    this.router.navigate(['/settings/admin/vendors']);
  }
}
