import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  CreditCard,
  CheckCircle2,
  XCircle,
  Edit2,
  DollarSign,
  ShieldAlert,
} from 'lucide-angular';

import { CustomersService } from '../customers.service';
import type { Customer } from '../sales.models';
import { MoneyPipe } from '../../../core/money/money.pipe';
import {
  AppBreadcrumbComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  type BreadcrumbItem,
} from '../../../shared/ui';

@Component({
  selector: 'app-customers-index',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppDialogComponent,
  ],
  templateUrl: './customers-index.page.html',
  styleUrl: './customers-index.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersIndexPage implements OnInit {
  private readonly customersService = inject(CustomersService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Sales', route: '/app/sales' },
    { label: 'Customers & Credit Terms' },
  ];

  readonly icons = {
    Users,
    Plus,
    Search,
    Building2,
    Mail,
    Phone,
    CreditCard,
    CheckCircle2,
    XCircle,
    Edit2,
    DollarSign,
    ShieldAlert,
  };

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly customers = signal<Customer[]>([]);
  readonly filterText = signal<string>('');

  // Modal State
  readonly isModalOpen = signal<boolean>(false);
  readonly editingCustomer = signal<Customer | null>(null);

  readonly customerForm = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    companyName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    contactPhone: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    billingAddress: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    shippingAddress: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    taxId: new FormControl<string>(''),
    creditLimit: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    paymentTerms: new FormControl<string>('PREPAID', { nonNullable: true }),
  });

  readonly totalCustomers = computed(() => this.customers().length);
  readonly activeCustomers = computed(() => this.customers().filter((c) => c.isActive).length);
  readonly totalCreditExtended = computed(() => {
    return this.customers().reduce((sum, c) => sum + Number(c.creditLimit || 0), 0);
  });

  readonly filteredCustomers = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    if (!text) return this.customers();

    return this.customers().filter(
      (c) =>
        c.name.toLowerCase().includes(text) ||
        c.companyName.toLowerCase().includes(text) ||
        c.contactEmail.toLowerCase().includes(text) ||
        (c.paymentTerms || '').toLowerCase().includes(text)
    );
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.customersService.list().subscribe({
      next: (data) => {
        this.customers.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load customers');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingCustomer.set(null);
    this.customerForm.reset({
      name: '',
      companyName: '',
      contactEmail: '',
      contactPhone: '',
      billingAddress: '',
      shippingAddress: '',
      taxId: '',
      creditLimit: 0,
      paymentTerms: 'PREPAID',
    });
    this.isModalOpen.set(true);
  }

  openEditModal(customer: Customer): void {
    this.editingCustomer.set(customer);
    this.customerForm.patchValue({
      name: customer.name,
      companyName: customer.companyName,
      contactEmail: customer.contactEmail,
      contactPhone: customer.contactPhone,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      taxId: customer.taxId || '',
      creditLimit: Number(customer.creditLimit || 0),
      paymentTerms: customer.paymentTerms || 'PREPAID',
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingCustomer.set(null);
  }

  saveCustomer(): void {
    if (this.customerForm.invalid) return;

    const val = this.customerForm.getRawValue();
    this.saving.set(true);

    const edit = this.editingCustomer();

    if (edit) {
      this.customersService
        .update(edit.id, {
          name: val.name,
          companyName: val.companyName,
          contactEmail: val.contactEmail,
          contactPhone: val.contactPhone,
          billingAddress: val.billingAddress,
          shippingAddress: val.shippingAddress,
          taxId: val.taxId || null,
          creditLimit: val.creditLimit,
          paymentTerms: val.paymentTerms,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.closeModal();
            this.loadCustomers();
          },
          error: (err) => {
            this.saving.set(false);
            this.error.set(err?.message || 'Failed to update customer');
          },
        });
    } else {
      this.customersService
        .create({
          name: val.name,
          companyName: val.companyName,
          contactEmail: val.contactEmail,
          contactPhone: val.contactPhone,
          billingAddress: val.billingAddress,
          shippingAddress: val.shippingAddress,
          taxId: val.taxId || null,
          creditLimit: val.creditLimit,
          paymentTerms: val.paymentTerms,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.closeModal();
            this.loadCustomers();
          },
          error: (err) => {
            this.saving.set(false);
            this.error.set(err?.message || 'Failed to create customer');
          },
        });
    }
  }
}
