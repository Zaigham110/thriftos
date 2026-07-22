/**
 * Sale Detail Component
 * Phase 2: Sales Module UI
 * 
 * Interactive sales order workspace for allocating inventory lines,
 * issuing invoices, and tracking wholesale payments.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ShoppingBag,
  ArrowLeft,
  Plus,
  Trash2,
  Tag,
  DollarSign,
  TrendingUp,
  CreditCard,
  UserCheck,
  CheckCircle2,
  QrCode,
  FileText,
  Printer,
  XCircle,
} from 'lucide-angular';

import { CustomersService } from '../customers.service';
import { SalesService } from '../sales.service';
import type { Customer, SaleDetail, SaleLine, SaleStatus, SaleType } from '../sales.models';
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
  type SelectOption,
} from '../../../shared/ui';

type LineAction = 'NONE' | 'REMOVE' | 'REPRICE';

@Component({
  selector: 'app-sale-detail',
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
    AppDialogComponent,
  ],
  templateUrl: './sale-detail.page.html',
  styleUrl: './sale-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly salesService = inject(SalesService);
  private readonly customersService = inject(CustomersService);

  readonly icons = {
    ShoppingBag,
    ArrowLeft,
    Plus,
    Trash2,
    Tag,
    DollarSign,
    TrendingUp,
    CreditCard,
    UserCheck,
    CheckCircle2,
    QrCode,
    FileText,
    Printer,
    XCircle,
  };

  readonly saleId = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly sale = signal<SaleDetail | null>(null);
  readonly customers = signal<Customer[]>([]);

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const s = this.sale();
    const code = s ? (s.saleNumber || `SO-${String(s.id).slice(0, 8).toUpperCase()}`) : 'Detail';
    return [
      { label: 'Sales', route: '/app/sales' },
      { label: 'Orders', route: '/app/sales' },
      { label: code },
    ];
  });

  readonly lines = computed(() => this.sale()?.lines || []);
  readonly payments = computed(() => this.sale()?.payments || []);

  // Available inventory for manual add
  readonly inventoryLoading = signal<boolean>(false);
  readonly availableInventory = signal<Array<{ id: string; unitCode: string; measurementType: 'WEIGHT' | 'QUANTITY'; weightKg?: number; pcsCount?: number }>>([]);

  // Draft edit controls
  readonly customerId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly type = new FormControl<SaleType>('WHOLESALE', { nonNullable: true, validators: [Validators.required] });

  readonly manualInventoryId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly manualUnitPrice = new FormControl<string>('0', { nonNullable: true });

  readonly qrCode = new FormControl<string>('', { nonNullable: true });
  readonly qrUnitPrice = new FormControl<string>('0', { nonNullable: true });

  // Issue confirmation
  readonly confirmIssueOpen = signal<boolean>(false);
  readonly issuing = signal<boolean>(false);

  // Line actions
  readonly confirmLineActionOpen = signal<boolean>(false);
  readonly lineAction = signal<LineAction>('NONE');
  readonly lineTarget = signal<SaleLine | null>(null);
  readonly lineNewUnitPrice = new FormControl<string>('0', { nonNullable: true });

  readonly isDraft = computed(() => {
    const s = this.sale();
    return s?.status === 'DRAFT';
  });

  readonly canEdit = computed(() => this.isDraft());

  readonly customerOptions = computed<SelectOption[]>(() => {
    const rows = this.customers();
    return [
      { value: '', label: 'Select a customer' },
      ...rows.filter((c) => c.isActive !== false).map((c) => ({ value: c.id, label: c.name })),
    ];
  });

  readonly typeOptions: SelectOption[] = [
    { value: 'WHOLESALE', label: 'Wholesale' },
    { value: 'EXPORT', label: 'Export' },
  ];

  readonly inventoryOptions = computed<SelectOption[]>(() => {
    const rows = this.availableInventory();
    return [
      { value: '', label: 'Select AVAILABLE inventory' },
      ...rows.map((i) => ({ value: i.id, label: i.unitCode })),
    ];
  });

  readonly paidAmount = computed(() => {
    const s = this.sale();
    const payments = s?.payments || [];
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  });

  readonly balanceAmount = computed(() => {
    const s = this.sale();
    return Number(s?.totalAmount || 0) - this.paidAmount();
  });

  readonly totalCost = computed(() => {
    const s = this.sale();
    return Number(s?.totalCost || 0);
  });

  readonly totalProfit = computed(() => {
    const s = this.sale();
    return Number(s?.totalProfit || 0);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/app/sales']);
      return;
    }

    this.saleId.set(id);

    this.loadCustomers();
    this.loadSale(id);
    this.loadAvailableInventory();
  }

  private loadCustomers(): void {
    this.customersService.list().subscribe({
      next: (rows) => this.customers.set(rows || []),
      error: () => {},
    });
  }

  private syncFormFromSale(sale: SaleDetail): void {
    this.customerId.setValue(sale.customerId || '', { emitEvent: false });
    this.type.setValue(sale.type || 'WHOLESALE', { emitEvent: false });
  }

  loadSale(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.salesService.getById(id).subscribe({
      next: (sale) => {
        this.sale.set(sale);
        this.syncFormFromSale(sale);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load sale details');
        this.loading.set(false);
      },
    });
  }

  loadAvailableInventory(): void {
    this.inventoryLoading.set(true);
    this.salesService.listAvailableInventory({ page: 1, limit: 100 }).subscribe({
      next: (resp) => {
        const items = Array.isArray(resp?.items) ? resp.items : [];
        this.availableInventory.set(
          items.map((i: any) => ({
            id: i.id,
            unitCode: i.unitCode,
            measurementType: i.measurementType,
            weightKg: i.weightKg,
            pcsCount: i.pcsCount,
          })),
        );
        this.inventoryLoading.set(false);
      },
      error: () => {
        this.availableInventory.set([]);
        this.inventoryLoading.set(false);
      },
    });
  }

  saveDefinition(): void {
    const s = this.sale();
    if (!s || !this.canEdit()) return;

    if (this.customerId.invalid || this.type.invalid) {
      this.error.set('Customer and order type are required');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.salesService.update(s.id, { customerId: this.customerId.value, type: this.type.value }).subscribe({
      next: (updated) => {
        this.sale.set(updated);
        this.syncFormFromSale(updated);
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message || 'Failed to update sale definition');
      },
    });
  }

  addManualLine(): void {
    const s = this.sale();
    if (!s || !this.canEdit()) return;

    if (this.manualInventoryId.invalid) {
      this.error.set('Select an AVAILABLE inventory item');
      return;
    }

    const inv = this.availableInventory().find((i) => i.id === this.manualInventoryId.value);
    if (!inv) {
      this.error.set('Selected inventory item is not available');
      return;
    }

    const quantity = inv.measurementType === 'WEIGHT' ? Number(inv.weightKg || 0) : Number(inv.pcsCount || 0);

    this.saving.set(true);
    this.error.set(null);

    this.salesService
      .addLine(s.id, {
        inventoryItemId: inv.id,
        measurementType: inv.measurementType,
        quantity,
        unitPrice: Number(this.manualUnitPrice.value || '0'),
      })
      .subscribe({
        next: (updated) => {
          this.sale.set(updated);
          this.manualInventoryId.setValue('', { emitEvent: false });
          this.manualUnitPrice.setValue('0', { emitEvent: false });
          this.loadAvailableInventory();
          this.saving.set(false);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to add inventory line');
        },
      });
  }

  openRemoveLine(line: SaleLine): void {
    if (!this.canEdit()) return;
    this.lineAction.set('REMOVE');
    this.lineTarget.set(line);
    this.confirmLineActionOpen.set(true);
  }

  closeLineAction(): void {
    if (this.saving()) return;
    this.confirmLineActionOpen.set(false);
    this.lineTarget.set(null);
    this.lineAction.set('NONE');
  }

  confirmLineAction(): void {
    const s = this.sale();
    const line = this.lineTarget();
    if (!s || !line) return;

    this.saving.set(true);
    this.error.set(null);

    this.salesService.deleteLine(s.id, line.id).subscribe({
      next: (updated) => {
        this.sale.set(updated);
        this.closeLineAction();
        this.loadAvailableInventory();
        this.saving.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.closeLineAction();
        this.error.set(err?.message || 'Failed to remove line');
      },
    });
  }

  openIssue(): void {
    if (!this.canEdit()) return;
    this.confirmIssueOpen.set(true);
  }

  closeIssue(): void {
    if (this.issuing()) return;
    this.confirmIssueOpen.set(false);
  }

  confirmIssue(): void {
    const s = this.sale();
    if (!s || !this.canEdit()) return;

    this.issuing.set(true);
    this.error.set(null);

    this.salesService.issue(s.id).subscribe({
      next: (updated) => {
        this.sale.set(updated);
        this.confirmIssueOpen.set(false);
        this.issuing.set(false);
      },
      error: (err) => {
        this.issuing.set(false);
        this.confirmIssueOpen.set(false);
        this.error.set(err?.message || 'Failed to issue sales order');
      },
    });
  }

  openInvoice(): void {
    const s = this.sale();
    if (!s) return;
    this.router.navigate(['/app/sales', s.id, 'invoice']);
  }

  goBack(): void {
    this.router.navigate(['/app/sales']);
  }

  saleCode(s: SaleDetail | null): string {
    if (!s) return '—';
    return s.saleNumber || `SO-${String(s.id).slice(0, 8).toUpperCase()}`;
  }
}
