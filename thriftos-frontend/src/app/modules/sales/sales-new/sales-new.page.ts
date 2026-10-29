/**
 * Sales New Component
 * Phase 2: Sales Module UI
 * 
 * Form page to initialize a new wholesale/retail sales order draft.
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ShoppingBag,
  ArrowLeft,
  UserCheck,
  CheckCircle2,
  Tag,
  Plus,
  Users,
} from 'lucide-angular';

import { CustomersService } from '../customers.service';
import { SalesService } from '../sales.service';
import type { Customer, SaleType } from '../sales.models';
import {
  AppBreadcrumbComponent,
  AppDialogComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
  type SelectOption,
} from '../../../shared/ui';

@Component({
  selector: 'app-sales-new',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './sales-new.page.html',
  styleUrl: './sales-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesNewPage implements OnInit {
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly salesService = inject(SalesService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sales', route: '/sell/records' },
    { label: 'Orders', route: '/sell/records' },
    { label: 'New Sales Order' },
  ];

  readonly icons = {
    ShoppingBag,
    ArrowLeft,
    UserCheck,
    CheckCircle2,
    Tag,
    Plus,
    Users,
  };

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly customers = signal<Customer[]>([]);
  readonly isQuickAddOpen = signal<boolean>(false);
  readonly creatingCustomer = signal<boolean>(false);

  readonly customerId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly type = new FormControl<SaleType>('WHOLESALE', { nonNullable: true, validators: [Validators.required] });

  readonly newCustomerForm = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    contactPhone: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    billingAddress: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    shippingAddress: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    paymentTerms: new FormControl<string>('NET_30', { nonNullable: true }),
    creditLimit: new FormControl<number>(10000, { nonNullable: true, validators: [Validators.min(0)] }),
  });

  readonly customerOptions = computed<SelectOption[]>(() => {
    const rows = this.customers();
    return [
      { value: '', label: 'Select a customer / wholesale buyer' },
      ...rows.map((c) => ({ value: c.id, label: c.companyName ? `${c.name} (${c.companyName})` : c.name })),
    ];
  });

  readonly typeOptions: SelectOption[] = [
    { value: 'WHOLESALE', label: 'Wholesale Batch Sale' },
    { value: 'EXPORT', label: 'Export Ocean Shipment Sale' },
  ];

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.customersService.list().subscribe({
      next: (rows) => {
        const active = (rows || []).filter((c) => c.isActive !== false);
        this.customers.set(active);
        if (active.length > 0 && !this.customerId.value) {
          this.customerId.setValue(active[0].id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load customers list');
        this.loading.set(false);
      },
    });
  }

  openQuickAddModal(): void {
    this.newCustomerForm.reset({
      name: '',
      companyName: '',
      contactEmail: '',
      contactPhone: '',
      billingAddress: '',
      shippingAddress: '',
      paymentTerms: 'NET_30',
      creditLimit: 10000,
    });
    this.isQuickAddOpen.set(true);
  }

  closeQuickAddModal(): void {
    this.isQuickAddOpen.set(false);
  }

  saveNewCustomer(): void {
    if (this.newCustomerForm.invalid) return;

    const val = this.newCustomerForm.getRawValue();
    this.creatingCustomer.set(true);

    this.customersService
      .create({
        name: val.name,
        companyName: val.companyName,
        contactEmail: val.contactEmail,
        contactPhone: val.contactPhone,
        billingAddress: val.billingAddress,
        shippingAddress: val.shippingAddress,
        paymentTerms: val.paymentTerms,
        creditLimit: val.creditLimit,
      })
      .subscribe({
        next: (created) => {
          this.creatingCustomer.set(false);
          this.closeQuickAddModal();
          this.customers.update((prev) => [created, ...prev]);
          this.customerId.setValue(created.id);
        },
        error: (err) => {
          this.creatingCustomer.set(false);
          this.error.set(err?.message || 'Failed to create customer');
        },
      });
  }

  createDraft(): void {
    if (this.saving()) return;
    if (this.customerId.invalid || this.type.invalid) {
      this.error.set('Customer selection and order type are required');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.salesService
      .create({ customerId: this.customerId.value, type: this.type.value })
      .subscribe({
        next: (sale) => {
          this.saving.set(false);
          this.router.navigate(['/sell/records', sale.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to create sales order draft');
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/sell/records']);
  }
}
