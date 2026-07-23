/**
 * Sale Detail Component
 * Phase 2: Sales Module UI
 * 
 * Interactive sales order workspace for allocating inventory lines,
 * issuing invoices, tracking wholesale payments, export logistics, and BOL generation.
 */

import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  Truck,
  Ship,
  Globe,
  Anchor,
  ShieldAlert,
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
    Truck,
    Ship,
    Globe,
    Anchor,
    ShieldAlert,
  };

  readonly saleId = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly issuing = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly sale = signal<SaleDetail | null>(null);
  readonly availableInventory = signal<any[]>([]);

  // Modals
  readonly confirmIssueOpen = signal<boolean>(false);
  readonly confirmLineActionOpen = signal<boolean>(false);
  readonly lineToRemove = signal<SaleLine | null>(null);
  readonly isBolModalOpen = signal<boolean>(false);
  readonly isLogisticsModalOpen = signal<boolean>(false);

  // Manual Inventory Add Form
  readonly manualInventoryId = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  readonly manualUnitPrice = new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] });

  // Logistics Form
  readonly logisticsForm = new FormGroup({
    billOfLadingNumber: new FormControl<string>(''),
    containerSealNumber: new FormControl<string>(''),
    vesselName: new FormControl<string>(''),
    portOfLoading: new FormControl<string>(''),
    portOfDischarge: new FormControl<string>(''),
    freightForwarder: new FormControl<string>(''),
    destinationCountry: new FormControl<string>(''),
  });

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { label: 'Sales', route: '/app/sales' },
    { label: 'Order Workspace' },
  ]);

  readonly lines = computed<SaleLine[]>(() => this.sale()?.lines || []);
  readonly isDraft = computed<boolean>(() => this.sale()?.status === 'DRAFT');

  readonly totalCost = computed<number>(() => {
    return this.lines().reduce((sum, line) => sum + Number(line.lineCost || 0), 0);
  });

  readonly totalProfit = computed<number>(() => {
    return this.lines().reduce((sum, line) => sum + Number(line.profit || 0), 0);
  });

  readonly paidAmount = computed<number>(() => {
    const payments = this.sale()?.payments || [];
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  });

  readonly balanceAmount = computed<number>(() => {
    const total = Number(this.sale()?.totalAmount || 0);
    return Math.max(0, total - this.paidAmount());
  });

  readonly totalWeightKg = computed<number>(() => {
    return this.lines().reduce((sum, line) => {
      if (line.measurementType === 'WEIGHT') return sum + Number(line.quantity || 0);
      return sum + Number(line.inventoryItem?.weightKg || 0);
    }, 0);
  });

  readonly totalPcsCount = computed<number>(() => {
    return this.lines().reduce((sum, line) => {
      if (line.measurementType === 'QUANTITY') return sum + Number(line.quantity || 0);
      return sum + Number(line.inventoryItem?.pcsCount || 0);
    }, 0);
  });

  readonly inventoryOptions = computed<SelectOption[]>(() => {
    const list = this.availableInventory();
    return [
      { label: '-- Select Available Inventory Item --', value: '' },
      ...list.map((inv) => {
        const code = inv.repackUnit?.unitCode || `INV-${inv.id.slice(0, 8).toUpperCase()}`;
        const cat = inv.category?.name || 'Item';
        const grade = inv.grade?.name || '';
        const qtyStr = inv.repackUnit?.measurementType === 'WEIGHT' ? `${inv.weightKg} KG` : `${inv.pcsCount} PCS`;
        const costStr = `$${Number(inv.avgCost || 0).toFixed(2)}`;
        return {
          label: `${code} - ${cat} ${grade} (${qtyStr} @ ${costStr}/unit)`,
          value: inv.id,
        };
      }),
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.saleId.set(id);
      this.loadSale();
      this.loadInventory();
    }
  }

  loadSale(): void {
    const id = this.saleId();
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    this.salesService.getById(id).subscribe({
      next: (detail) => {
        this.sale.set(detail);
        this.loading.set(false);

        // Populate logistics form
        this.logisticsForm.patchValue({
          billOfLadingNumber: detail.billOfLadingNumber || '',
          containerSealNumber: detail.containerSealNumber || '',
          vesselName: detail.vesselName || '',
          portOfLoading: detail.portOfLoading || '',
          portOfDischarge: detail.portOfDischarge || '',
          freightForwarder: detail.freightForwarder || '',
          destinationCountry: detail.destinationCountry || '',
        });
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load sales order details');
        this.loading.set(false);
      },
    });
  }

  loadInventory(): void {
    this.salesService.listAvailableInventory({ limit: 100 }).subscribe({
      next: (res) => {
        const items = res?.data || res || [];
        this.availableInventory.set(Array.isArray(items) ? items : []);
      },
      error: () => {
        this.availableInventory.set([]);
      },
    });
  }

  saleCode(s: SaleDetail): string {
    if (s.saleNumber) return s.saleNumber;
    return `SO-${String(s.id).slice(0, 8).toUpperCase()}`;
  }

  goBack(): void {
    this.router.navigate(['/app/sales']);
  }

  openInvoice(): void {
    const s = this.sale();
    if (s) this.router.navigate(['/app/sales', s.id, 'invoice']);
  }

  openBolModal(): void {
    this.isBolModalOpen.set(true);
  }

  closeBolModal(): void {
    this.isBolModalOpen.set(false);
  }

  printBol(): void {
    window.print();
  }

  openLogisticsModal(): void {
    this.isLogisticsModalOpen.set(true);
  }

  closeLogisticsModal(): void {
    this.isLogisticsModalOpen.set(false);
  }

  saveLogistics(): void {
    const s = this.sale();
    if (!s) return;

    const val = this.logisticsForm.value;
    this.saving.set(true);

    this.salesService
      .update(s.id, {
        billOfLadingNumber: val.billOfLadingNumber || undefined,
        containerSealNumber: val.containerSealNumber || undefined,
        vesselName: val.vesselName || undefined,
        portOfLoading: val.portOfLoading || undefined,
        portOfDischarge: val.portOfDischarge || undefined,
        freightForwarder: val.freightForwarder || undefined,
        destinationCountry: val.destinationCountry || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeLogisticsModal();
          this.loadSale();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to update logistics details');
        },
      });
  }

  addManualLine(): void {
    const s = this.sale();
    const invId = this.manualInventoryId.value;
    const price = this.manualUnitPrice.value;

    if (!s || !invId) return;

    const invItem = this.availableInventory().find((i) => i.id === invId);
    if (!invItem) return;

    const mType = invItem.repackUnit?.measurementType || 'WEIGHT';
    const qty = mType === 'WEIGHT' ? Number(invItem.weightKg || 0) : Number(invItem.pcsCount || 0);

    this.saving.set(true);
    this.salesService
      .addLine(s.id, {
        inventoryItemId: invId,
        measurementType: mType,
        quantity: qty,
        unitPrice: price,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.manualInventoryId.reset('');
          this.manualUnitPrice.reset(0);
          this.loadSale();
          this.loadInventory();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to allocate line item');
        },
      });
  }

  openRemoveLine(line: SaleLine): void {
    this.lineToRemove.set(line);
    this.confirmLineActionOpen.set(true);
  }

  closeLineAction(): void {
    if (this.saving()) return;
    this.confirmLineActionOpen.set(false);
    this.lineToRemove.set(null);
  }

  confirmLineAction(): void {
    const s = this.sale();
    const line = this.lineToRemove();
    if (!s || !line) return;

    this.saving.set(true);
    this.salesService.deleteLine(s.id, line.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmLineActionOpen.set(false);
        this.lineToRemove.set(null);
        this.loadSale();
        this.loadInventory();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message || 'Failed to remove line item');
        this.confirmLineActionOpen.set(false);
        this.lineToRemove.set(null);
      },
    });
  }

  openIssue(): void {
    this.confirmIssueOpen.set(true);
  }

  closeIssue(): void {
    if (this.issuing()) return;
    this.confirmIssueOpen.set(false);
  }

  confirmIssue(): void {
    const s = this.sale();
    if (!s) return;

    this.issuing.set(true);
    this.salesService.issue(s.id).subscribe({
      next: () => {
        this.issuing.set(false);
        this.confirmIssueOpen.set(false);
        this.loadSale();
      },
      error: (err) => {
        this.issuing.set(false);
        this.error.set(err?.error?.message || err?.message || 'Failed to issue sales order');
        this.confirmIssueOpen.set(false);
      },
    });
  }
}
