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
    { label: 'Sales', route: '/sell/records' },
    { label: 'Customers' },
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

  /** Only the name is required; phone is the WhatsApp number. */
  readonly customerForm = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl<string>('', { nonNullable: true }),
    city: new FormControl<string>('', { nonNullable: true }),
    openingBalance: new FormControl<number | null>(null),
  });

  readonly totalCustomers = computed(() => this.customers().length);
  readonly activeCustomers = computed(() => this.customers().filter((c) => c.isActive).length);
  readonly totalOpening = computed(() => this.customers().reduce((sum, c) => sum + Number(c.openingBalance || 0), 0));

  readonly filteredCustomers = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    if (!text) return this.customers();
    return this.customers().filter(
      (c) => c.name.toLowerCase().includes(text) || (c.phone || '').includes(text) || (c.city || '').toLowerCase().includes(text),
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
    this.customerForm.reset({ name: '', phone: '', city: '', openingBalance: null });
    this.isModalOpen.set(true);
  }

  openEditModal(customer: Customer): void {
    this.editingCustomer.set(customer);
    this.customerForm.reset({
      name: customer.name,
      phone: customer.phone || '',
      city: customer.city || '',
      openingBalance: Number(customer.openingBalance || 0),
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
    const body = {
      name: val.name.trim(),
      phone: val.phone.trim(),
      city: val.city.trim(),
      openingBalance: val.openingBalance ?? 0,
    };
    const edit = this.editingCustomer();
    this.saving.set(true);
    (edit ? this.customersService.update(edit.id, body) : this.customersService.create(body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadCustomers();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Could not save the customer');
      },
    });
  }
}
