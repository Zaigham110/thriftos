import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppDataTableComponent,
  AppDialogComponent,
  AppEmptyStateComponent,
  AppErrorStateComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSectionBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSelectComponent,
  type DataTableColumn,
  type SelectOption,
} from '../../../shared/ui';
import { MoneyPipe } from '../../../core/money/money.pipe';

import { CustomersService } from '../customers.service';
import { SalesService } from '../sales.service';
import type { Customer, SaleDetail, SaleLine, SaleStatus, SaleType } from '../sales.models';

type LineAction = 'NONE' | 'REMOVE' | 'REPRICE';

@Component({
  selector: 'app-sale-detail',
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
    AppLoadingComponent,
    AppErrorStateComponent,
    AppEmptyStateComponent,
    AppButtonComponent,
    AppBadgeComponent,
    AppFormFieldComponent,
    AppSelectComponent,
    AppInputComponent,
    AppDataTableComponent,
    AppDialogComponent,
    MoneyPipe,
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

  readonly saleId = signal<string>('');

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly sale = signal<SaleDetail | null>(null);
  readonly customers = signal<Customer[]>([]);

  readonly lines = computed(() => this.sale()?.lines ?? []);
  readonly payments = computed(() => this.sale()?.payments ?? []);

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
    const payments = s?.payments ?? [];
    return payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  });

  readonly balanceAmount = computed(() => {
    const s = this.sale();
    return Number(s?.totalAmount ?? 0) - this.paidAmount();
  });

  readonly linesColumns: DataTableColumn[] = [
    { key: 'unitCode', label: 'Inventory', sortable: false, width: '160px' },
    { key: 'category', label: 'Category', sortable: false, width: '130px' },
    { key: 'grade', label: 'Grade', sortable: false, width: '110px' },
    { key: 'qty', label: 'Qty', sortable: false, width: '120px' },
    { key: 'unitPrice', label: 'Unit Price', sortable: false, width: '140px', align: 'right' },
    { key: 'lineTotal', label: 'Line Total', sortable: false, width: '140px', align: 'right' },
  ];

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
      next: (rows) => this.customers.set(rows ?? []),
      error: () => {},
    });
  }

  private syncFormFromSale(sale: SaleDetail): void {
    this.customerId.setValue(sale.customerId ?? '', { emitEvent: false });
    this.type.setValue(sale.type ?? 'WHOLESALE', { emitEvent: false });
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
        this.error.set(err?.message ?? 'Failed to load sale');
        this.loading.set(false);
      },
    });
  }

  retryLoad(): void {
    const id = this.saleId();
    if (!id) return;
    this.loadSale(id);
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
    if (!s) return;
    if (!this.canEdit()) return;

    if (this.customerId.invalid || this.type.invalid) {
      this.error.set('Customer and type are required');
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
        this.error.set(err?.message ?? 'Failed to update sale');
      },
    });
  }

  addManualLine(): void {
    const s = this.sale();
    if (!s) return;
    if (!this.canEdit()) return;

    if (this.manualInventoryId.invalid) {
      this.error.set('Select an AVAILABLE inventory item');
      return;
    }

    const inv = this.availableInventory().find((i) => i.id === this.manualInventoryId.value);
    if (!inv) {
      this.error.set('Inventory item not found in AVAILABLE list');
      return;
    }

    const quantity = inv.measurementType === 'WEIGHT' ? Number(inv.weightKg ?? 0) : Number(inv.pcsCount ?? 0);

    this.saving.set(true);
    this.error.set(null);

    this.salesService
      .addLine(s.id, {
        inventoryItemId: inv.id,
        measurementType: inv.measurementType,
        quantity,
        unitPrice: Number(this.manualUnitPrice.value ?? '0'),
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
          this.error.set(err?.message ?? 'Failed to add line');
        },
      });
  }

  scanQrAndAdd(): void {
    const s = this.sale();
    if (!s) return;
    if (!this.canEdit()) return;

    const code = String(this.qrCode.value ?? '').trim();
    if (!code) {
      this.error.set('QR code is required');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.salesService.scanQr(code).subscribe({
      next: (res) => {
        this.salesService
          .addLine(s.id, {
            inventoryItemId: res.inventoryItemId,
            measurementType: res.measurementType,
            quantity: Number(res.quantity),
            unitPrice: Number(this.qrUnitPrice.value ?? '0'),
          })
          .subscribe({
            next: (updated) => {
              this.sale.set(updated);
              this.qrCode.setValue('', { emitEvent: false });
              this.qrUnitPrice.setValue('0', { emitEvent: false });
              this.loadAvailableInventory();
              this.saving.set(false);
            },
            error: (err) => {
              this.saving.set(false);
              this.error.set(err?.message ?? 'Failed to add scanned inventory');
            },
          });
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message ?? 'QR scan failed');
      },
    });
  }

  openRemoveLine(line: SaleLine): void {
    if (!this.canEdit()) return;
    this.lineAction.set('REMOVE');
    this.lineTarget.set(line);
    this.confirmLineActionOpen.set(true);
  }

  openRepriceLine(line: SaleLine): void {
    if (!this.canEdit()) return;
    this.lineAction.set('REPRICE');
    this.lineTarget.set(line);
    this.lineNewUnitPrice.setValue(String(line.unitPrice ?? '0'), { emitEvent: false });
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
    const action = this.lineAction();
    if (!s || !line) return;

    this.saving.set(true);
    this.error.set(null);

    if (action === 'REMOVE') {
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
          this.error.set(err?.message ?? 'Failed to remove line');
        },
      });
      return;
    }

    // REPRICE: backend currently has no update-line endpoint.
    // We re-price by deleting the line (release reservation) then re-adding the same inventory with new unit price.
    const newPrice = Number(this.lineNewUnitPrice.value ?? '0');

    this.salesService.deleteLine(s.id, line.id).subscribe({
      next: () => {
        this.salesService
          .addLine(s.id, {
            inventoryItemId: line.inventoryItemId,
            measurementType: line.measurementType,
            quantity: Number(line.quantity),
            unitPrice: newPrice,
          })
          .subscribe({
            next: (updated) => {
              this.sale.set(updated);
              this.closeLineAction();
              this.loadAvailableInventory();
              this.saving.set(false);
            },
            error: (err) => {
              this.saving.set(false);
              this.closeLineAction();
              this.error.set(err?.message ?? 'Failed to reprice line');
            },
          });
      },
      error: (err) => {
        this.saving.set(false);
        this.closeLineAction();
        this.error.set(err?.message ?? 'Failed to reprice line');
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
    if (!s) return;
    if (!this.canEdit()) return;

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
        this.error.set(err?.message ?? 'Failed to issue invoice');
      },
    });
  }

  getStatusVariant(status: SaleStatus): 'default' | 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'ISSUED':
        return 'warning';
      case 'PARTIALLY_PAID':
        return 'warning';
      case 'PAID':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'default';
    }
  }
}
