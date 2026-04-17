import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  AppButtonComponent,
  AppErrorStateComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppFormFieldComponent,
  AppSelectComponent,
  type SelectOption,
} from '../../../shared/ui';

import { CustomersService } from '../customers.service';
import { SalesService } from '../sales.service';
import type { Customer, SaleType } from '../sales.models';

@Component({
  selector: 'app-sales-new',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppFormFieldComponent,
    AppSelectComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './sales-new.page.html',
  styleUrl: './sales-new.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesNewPage implements OnInit {
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly salesService = inject(SalesService);

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly customers = signal<Customer[]>([]);

  readonly customerId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly type = new FormControl<SaleType>('WHOLESALE', { nonNullable: true, validators: [Validators.required] });

  readonly customerOptions = computed<SelectOption[]>(() => {
    const rows = this.customers();
    return [
      { value: '', label: 'Select a customer' },
      ...rows.map((c) => ({ value: c.id, label: c.name })),
    ];
  });

  readonly typeOptions: SelectOption[] = [
    { value: 'WHOLESALE', label: 'Wholesale' },
    { value: 'EXPORT', label: 'Export' },
  ];

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.customersService.list().subscribe({
      next: (rows) => {
        this.customers.set((rows ?? []).filter((c) => c.isActive !== false));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load customers');
        this.loading.set(false);
      },
    });
  }

  createDraft(): void {
    if (this.saving()) return;
    if (this.customerId.invalid || this.type.invalid) {
      this.error.set('Customer and sale type are required');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.salesService
      .create({ customerId: this.customerId.value, type: this.type.value })
      .subscribe({
        next: (sale) => {
          this.saving.set(false);
          this.router.navigate(['/app/sales', sale.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message ?? 'Failed to create sale');
        },
      });
  }
}
