/**
 * Vendor Select Component
 * Phase 2: Procurement UI
 * 
 * Dropdown for vendor selection with inline "Add Vendor" drawer
 */

import { ChangeDetectionStrategy, Component, OnInit, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { ProcurementService } from '../../procurement.service';
import { Vendor, CreateVendorRequest } from '../../procurement.models';
import {
  SelectComponent,
  SelectOption,
  DrawerComponent,
  InputComponent,
  TextareaComponent,
  ButtonComponent,
  AlertComponent,
} from '../../../../shared/ui';

@Component({
  selector: 'app-vendor-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    SelectComponent,
    DrawerComponent,
    InputComponent,
    TextareaComponent,
    ButtonComponent,
    AlertComponent,
  ],
  templateUrl: './vendor-select.html',
  styleUrl: './vendor-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorSelectComponent implements OnInit {
  private fb = inject(FormBuilder);
  private procurementService = inject(ProcurementService);

  readonly icons = { Plus };

  readonly selectedVendorId = input<string | null>(null);
  readonly disabled = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly label = input<string>('Vendor');
  readonly hint = input<string>('');
  readonly showAddButton = input<boolean>(true);

  readonly vendorSelected = output<Vendor | null>();
  readonly vendorCreated = output<Vendor>();

  readonly isDrawerOpen = signal(false);
  readonly isCreating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly vendorOptions = computed<SelectOption[]>(() => {
    const vendors = this.procurementService.activeVendors();
    return [
      { value: '', label: 'Select a vendor...' },
      ...vendors.map((v) => ({ value: v.id, label: `${v.name}${v.country ? ` (${v.country})` : ''}` })),
    ];
  });

  vendorForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadVendors();
  }

  private initForm(): void {
    this.vendorForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      country: ['', Validators.maxLength(100)],
      contactInfo: ['', Validators.maxLength(500)],
    });
  }

  private loadVendors(): void {
    this.procurementService.loadVendors().subscribe();
  }

  onVendorChange(vendorId: string | number): void {
    const id = String(vendorId);
    if (!id) {
      this.vendorSelected.emit(null);
      return;
    }

    const vendor = this.procurementService.vendors().find((v) => v.id === id);
    this.vendorSelected.emit(vendor || null);
  }

  openAddVendorDrawer(): void {
    this.vendorForm.reset();
    this.createError.set(null);
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  onSubmitVendor(): void {
    if (this.vendorForm.invalid) {
      this.vendorForm.markAllAsTouched();
      return;
    }

    this.isCreating.set(true);
    this.createError.set(null);

    const data: CreateVendorRequest = {
      name: this.vendorForm.value.name.trim(),
      country: this.vendorForm.value.country?.trim() || undefined,
      contactInfo: this.vendorForm.value.contactInfo?.trim() || undefined,
    };

    this.procurementService.createVendor(data).subscribe({
      next: (vendor) => {
        this.isCreating.set(false);
        this.isDrawerOpen.set(false);
        this.vendorCreated.emit(vendor);
        this.vendorSelected.emit(vendor);
      },
      error: (err) => {
        this.isCreating.set(false);
        this.createError.set(err.message || 'Failed to create vendor');
      },
    });
  }
}
