/**
 * Sales New Component
 * Phase 2: Sales Module UI
 * 
 * Form page to initialize a new wholesale/retail sales order draft.
 */

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ShoppingBag,
  ArrowLeft,
  UserCheck,
  CheckCircle2,
  Tag,
} from 'lucide-angular';

import { CustomersService } from '../customers.service';
import { SalesService } from '../sales.service';
import type { Customer, SaleType } from '../sales.models';
import {
  AppBreadcrumbComponent,
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
    { label: 'Sales', route: '/app/sales' },
    { label: 'Orders', route: '/app/sales' },
    { label: 'New Sales Order' },
  ];

  readonly icons = {
    ShoppingBag,
    ArrowLeft,
    UserCheck,
    CheckCircle2,
    Tag,
  };

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly customers = signal<Customer[]>([]);

  readonly customerId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly type = new FormControl<SaleType>('WHOLESALE', { nonNullable: true, validators: [Validators.required] });

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
          this.router.navigate(['/app/sales', sale.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to create sales order draft');
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/app/sales']);
  }
}
