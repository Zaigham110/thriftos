import { Component, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../../core/config/api.config';

interface CustomerItem {
  id: string;
  name: string;
  companyName?: string;
}

interface InventoryStockItem {
  id: string;
  weightKg: number;
  pcsCount: number;
  avgCost: number;
  status: string;
  repackUnit?: {
    unitCode: string;
    category?: { name: string };
    grade?: { name: string };
  };
  category?: { name: string };
  grade?: { name: string };
}

interface CartItem {
  inventoryItem: InventoryStockItem;
  quantityKg: number;
  unitPrice: number;
  lineTotal: number;
}

interface SaleOrderRow {
  id: string;
  saleNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  customer?: { name: string };
  fulfillmentStatus?: 'PENDING' | 'FULFILLED';
}

@Component({
  selector: 'app-mobile-quick-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lite-quick-sale-workstation">
      <!-- Mobile View Toggle Tabs (< 1024px) -->
      <div class="view-toggle-tabs mobile-only">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'pos'"
          (click)="activeTab.set('pos')"
        >
          <span>🛒 New POS Sale</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'history'"
          (click)="activeTab.set('history')"
        >
          <span>🧾 Sales Orders ({{ completedSales().length }})</span>
        </button>
      </div>

      <!-- RESPONSIVE DUAL-COLUMN WORKSTATION (DESKTOP SPLIT / MOBILE STACKED) -->
      <div class="workstation-grid">
        <!-- ========================================================= -->
        <!-- COLUMN 1: POS CATALOG & CUSTOMER SELECTOR -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'pos' || isDesktopView()" class="pos-catalog-card">
          <div class="card-header">
            <h3>🛒 POS Catalog & Customer Setup</h3>
            <span class="badge-tag">Point of Sale</span>
          </div>

          <!-- Status Alert -->
          <div *ngIf="statusMessage()" role="status" aria-live="polite" class="status-alert" [class.success]="statusType() === 'success'" [class.error]="statusType() === 'error'">
            <span>{{ statusMessage() }}</span>
            <button type="button" class="dismiss-btn" (click)="statusMessage.set('')">✕</button>
          </div>

          <!-- Step 1: Select Customer -->
          <div class="input-group">
            <label>1. Select Customer</label>
            <div class="customer-row">
              <select [(ngModel)]="selectedCustomerId" class="lite-select">
                <option value="">-- Choose Customer --</option>
                <option *ngFor="let c of customers(); trackBy: trackById" [value]="c.id">
                  {{ c.name }} {{ c.companyName ? '(' + c.companyName + ')' : '' }}
                </option>
              </select>
              <button type="button" class="quick-add-customer-btn" (click)="createWalkInCustomer()">+ Walk-in</button>
            </div>
          </div>

          <div class="input-group">
            <label>1b. Sale type</label>
            <div class="sale-type-tabs">
              <button type="button" [class.active]="selectedSaleType === 'WHOLESALE'" (click)="selectedSaleType = 'WHOLESALE'">Wholesale</button>
              <button type="button" [class.active]="selectedSaleType === 'EXPORT'" (click)="selectedSaleType = 'EXPORT'">Export</button>
            </div>
          </div>

          <!-- Step 2: Available Inventory Bales/Items Picker -->
          <div class="input-group">
            <label>2. Select Available Stock to Sell</label>

            <div class="pos-scan-row">
              <input
                type="text"
                [(ngModel)]="scanQuery"
                (keyup.enter)="scanAndAddStock()"
                placeholder="Scan sealed QR or enter unit code"
                aria-label="Scan sealed inventory QR or enter unit code"
              />
              <button type="button" (click)="scanAndAddStock()">Scan & add</button>
            </div>
            <small class="scan-help">Only AVAILABLE sealed stock can be added. The server confirms the current state before reservation.</small>

            <div *ngIf="availableInventory().length === 0" class="empty-stock-box">
              <p>No available inventory stock. Seal a repack unit first to create sellable stock.</p>
            </div>

            <div *ngIf="availableInventory().length > 0" class="stock-select-grid">
              <div
                *ngFor="let item of availableInventory(); trackBy: trackById"
                class="stock-item-chip"
                [class.in-cart]="cartItemIds().has(item.id)"
                (click)="addItemToCart(item)"
              >
                <div class="chip-top">
                  <span class="sku-code">{{ item.repackUnit?.unitCode || item.id.slice(-8) }}</span>
                  <span class="stock-tag">{{ item.category?.name || item.repackUnit?.category?.name }}</span>
                </div>
                <div class="chip-bottom">
                  <span class="grade-name">{{ item.grade?.name || item.repackUnit?.grade?.name || 'Grade A' }}</span>
                  <span class="weight-badge">{{ item.weightKg }} KG</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- COLUMN 2: LIVE CART & CHECKOUT PAYMENTS -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'pos' || isDesktopView()" class="cart-checkout-card">
          <div class="card-header">
            <h3>🛒 Order Cart & Checkout</h3>
            <button *ngIf="cart().length > 0" type="button" class="clear-cart-btn" (click)="cart.set([])">Clear Cart</button>
          </div>

          <div *ngIf="cart().length === 0" class="empty-cart-box">
            <p>Cart is empty. Tap available stock items on the left catalog to add them to this order.</p>
          </div>

          <div *ngIf="cart().length > 0" class="cart-items-list">
            <div *ngFor="let c of cart(); let idx = index; trackBy: trackByCartItem" class="cart-item-row">
              <div class="item-meta">
                <span class="sku">{{ c.inventoryItem.repackUnit?.unitCode || 'SKU' }}</span>
                <span class="sub">{{ c.inventoryItem.category?.name }} ({{ c.quantityKg }} KG)</span>
                <span class="cost-context">Cost {{ c.inventoryItem.avgCost | currency:'USD':'symbol':'1.2-2' }}/kg · Margin {{ lineProfit(c) | currency:'USD':'symbol':'1.2-2' }}</span>
              </div>
              <div class="item-price-edit">
                <span class="curr">$</span>
                <input
                  type="number"
                  step="0.01"
                  [ngModel]="c.unitPrice"
                  (ngModelChange)="updateCartLinePrice(idx, $event)"
                  class="price-field"
                />
              </div>
              <button type="button" class="del-cart-btn" (click)="removeCartItem(idx)">🗑️</button>
            </div>
          </div>

          <!-- Total Summary -->
          <div *ngIf="cart().length > 0" class="cart-totals-pill">
            <div class="tot-row">
              <span>Total Weight:</span>
              <strong>{{ cartTotalWeight() }} KG</strong>
            </div>
            <div class="tot-row main">
              <span>Total Payable:</span>
              <strong class="grand-total">{{ cartTotalAmount() | currency:'USD':'symbol':'1.2-2' }}</strong>
            </div>
            <div class="tot-row profit">
              <span>Expected gross profit:</span>
              <strong>{{ cartExpectedProfit() | currency:'USD':'symbol':'1.2-2' }}</strong>
            </div>
          </div>

          <!-- Payment Method Selector -->
          <div *ngIf="cart().length > 0" class="input-group">
            <label>Payment Method</label>
            <div class="payment-method-tabs">
              <button
                type="button"
                class="pm-btn"
                [class.active]="selectedPaymentMethod === 'CASH'"
                (click)="selectedPaymentMethod = 'CASH'"
              >
                💵 Cash
              </button>
              <button
                type="button"
                class="pm-btn"
                [class.active]="selectedPaymentMethod === 'CARD'"
                (click)="selectedPaymentMethod = 'CARD'"
              >
                💳 Card
              </button>
              <button
                type="button"
                class="pm-btn"
                [class.active]="selectedPaymentMethod === 'BANK_TRANSFER'"
                (click)="selectedPaymentMethod = 'BANK_TRANSFER'"
              >
                🏦 Transfer
              </button>
            </div>
          </div>

          <!-- Complete Checkout Button -->
          <button
            *ngIf="cart().length > 0"
            type="button"
            class="submit-checkout-btn"
            [disabled]="!selectedCustomerId || cart().length === 0 || isSubmitting()"
            (click)="checkoutSaleOrder()"
          >
            <span *ngIf="!isSubmitting()">⚡ Complete Checkout & Collect Payment</span>
            <span *ngIf="isSubmitting()">Processing Sale...</span>
          </button>

          <!-- PRINTABLE INVOICE / RECEIPT DISPLAY -->
          <div *ngIf="issuedInvoice()" class="invoice-receipt-card">
            <div class="receipt-header">
              <span class="brand-title">THRIFTOS SALES INVOICE</span>
              <span class="paid-badge">PAID</span>
            </div>

            <div class="receipt-meta">
              <div class="meta-row">
                <span class="lbl">Invoice #:</span>
                <span class="val code">{{ issuedInvoiceNumber() }}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Customer:</span>
                <span class="val">{{ issuedCustomerName() }}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Total Paid:</span>
                <span class="val highlight">{{ issuedTotalAmount() | currency:'USD':'symbol':'1.2-2' }}</span>
              </div>
              <div class="meta-row">
                <span class="lbl">Payment Method:</span>
                <span class="val">{{ selectedPaymentMethod }}</span>
              </div>
            </div>

            <div class="receipt-actions">
              <button type="button" class="print-btn" (click)="printReceipt()">🖨️ Print Receipt</button>
              <button type="button" class="next-btn" (click)="resetPosView()">⚡ New POS Order</button>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- COLUMN 3: SALES HISTORY ORDERS (DESKTOP / MOBILE TAB) -->
        <!-- ========================================================= -->
        <div *ngIf="activeTab() === 'history'" class="history-card">
          <div class="card-header">
            <h3>🧾 Completed Sales Orders</h3>
            <button type="button" class="refresh-btn" (click)="fetchSalesHistory()">🔄 Refresh</button>
          </div>

          <div *ngIf="completedSales().length === 0" class="empty-history-box">
            <p>No completed sales orders recorded yet.</p>
          </div>

          <!-- Table View -->
          <div *ngIf="completedSales().length > 0" class="history-table-container">
            <table class="lite-table">
              <thead>
                <tr>
                  <th>Sale #</th>
                  <th>Customer</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Status</th>
                  <th>Handover</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of completedSales(); trackBy: trackById">
                  <td class="font-mono font-bold">{{ s.saleNumber }}</td>
                  <td>{{ s.customer?.name || 'Walk-in' }}</td>
                  <td class="font-bold">{{ (s.totalAmount || 0) | currency:'USD':'symbol':'1.2-2' }}</td>
                  <td class="text-green-600 font-semibold">{{ (s.paidAmount || 0) | currency:'USD':'symbol':'1.2-2' }}</td>
                  <td>
                    <span
                      class="status-pill"
                      [class.paid]="s.status === 'PAID'"
                      [class.issued]="s.status === 'ISSUED'"
                      [class.draft]="s.status === 'DRAFT'"
                    >
                      {{ s.status }}
                    </span>
                  </td>
                  <td>
                    <span class="fulfillment-pill" [class.fulfilled]="s.fulfillmentStatus === 'FULFILLED'">
                      {{ s.fulfillmentStatus === 'FULFILLED' ? 'Fulfilled' : 'Pending' }}
                    </span>
                  </td>
                  <td>{{ s.createdAt | date:'shortDate' }}</td>
                  <td>
                    @if (s.status === 'ISSUED' || s.status === 'PARTIALLY_PAID') {
                      <button type="button" class="collect-btn" (click)="beginCollectPayment(s)">Collect due</button>
                    }
                    @if ((s.status === 'ISSUED' || s.status === 'PARTIALLY_PAID' || s.status === 'PAID') && s.fulfillmentStatus !== 'FULFILLED') {
                      <button type="button" class="fulfill-btn" (click)="fulfillSale(s)">Mark handover</button>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          @if (selectedOutstandingSale(); as sale) {
            <section class="payment-recovery-card">
              <div>
                <strong>Collect outstanding payment · {{ sale.saleNumber }}</strong>
                <span>{{ outstandingAmount(sale) | currency:'USD':'symbol':'1.2-2' }} due from {{ sale.customer?.name || 'Walk-in customer' }}</span>
              </div>
              <div class="payment-method-tabs">
                <button type="button" class="pm-btn" [class.active]="selectedPaymentMethod === 'CASH'" (click)="selectedPaymentMethod = 'CASH'">Cash</button>
                <button type="button" class="pm-btn" [class.active]="selectedPaymentMethod === 'CARD'" (click)="selectedPaymentMethod = 'CARD'">Card</button>
                <button type="button" class="pm-btn" [class.active]="selectedPaymentMethod === 'BANK_TRANSFER'" (click)="selectedPaymentMethod = 'BANK_TRANSFER'">Transfer</button>
              </div>
              <div class="recovery-actions">
                <button type="button" (click)="selectedOutstandingSale.set(null)">Cancel</button>
                <button type="button" class="confirm" [disabled]="isSubmitting()" (click)="collectOutstandingPayment()">Record {{ outstandingAmount(sale) | currency:'USD':'symbol':'1.2-2' }}</button>
              </div>
            </section>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .lite-quick-sale-workstation {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .view-toggle-tabs {
      display: grid; grid-template-columns: 1fr 1fr; background: #e5e7eb; padding: 4px; border-radius: 10px;
    }

    .tab-btn {
      padding: 0.65rem 0.5rem; border: none; background: transparent; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #4b5563; cursor: pointer;
      &.active { background: #ffffff; color: #714b67; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    }

    .workstation-grid {
      display: grid; grid-template-columns: 1fr; gap: 1.25rem;
    }

    @media (min-width: 1024px) {
      .workstation-grid { grid-template-columns: 1fr 420px; }
      .mobile-only { display: none !important; }
    }

    .pos-catalog-card, .cart-checkout-card, .history-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .card-header {
      display: flex; align-items: center; justify-content: space-between;
      h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
    }

    .badge-tag { background: rgba(16, 185, 129, 0.12); color: #10b981; font-size: 0.72rem; font-weight: 700; padding: 4px 9px; border-radius: 6px; letter-spacing: 0.03em; }
    .refresh-btn { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 5px 12px; font-size: 0.78rem; font-weight: 700; color: #374151; cursor: pointer; transition: background 0.15s; &:hover { background: #e5e7eb; } }

    .input-group { display: flex; flex-direction: column; gap: 0.5rem; label { font-size: 0.82rem; font-weight: 700; color: #374151; } }
    .customer-row { display: flex; gap: 0.5rem; }
    .lite-select { flex: 1; height: 44px; padding: 0 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.88rem; background: #ffffff; }
    .quick-add-customer-btn { background: #714b67; color: #ffffff; border: none; padding: 0 0.85rem; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }

    .empty-stock-box, .empty-cart-box, .empty-history-box { text-align: center; padding: 1.5rem; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; font-size: 0.82rem; color: #6b7280; }

    .stock-select-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; }
    .pos-scan-row { display: flex; gap: .5rem; }
    .pos-scan-row input { min-width: 0; flex: 1; min-height: 44px; padding: 0 .75rem; border: 1px solid #b8a6b3; border-radius: 8px; font: inherit; }
    .pos-scan-row button { min-height: 44px; border: 0; border-radius: 8px; padding: 0 .8rem; background: #714b67; color: #fff; font-weight: 700; white-space: nowrap; }
    .scan-help { color: #6b7280; font-size: .72rem; line-height: 1.35; }
    .stock-item-chip {
      background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.65rem; display: flex; flex-direction: column; gap: 0.35rem; cursor: pointer;
      &.in-cart { background: #ecfdf5; border-color: #10b981; }
    }

    .chip-top { display: flex; justify-content: space-between; align-items: center; .sku-code { font-family: monospace; font-weight: 700; font-size: 0.8rem; color: #111827; } .stock-tag { font-size: 0.7rem; color: #6b7280; } }
    .chip-bottom { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; .grade-name { font-weight: 700; color: #714b67; } .weight-badge { background: #e5e7eb; padding: 1px 5px; border-radius: 4px; font-weight: 700; } }

    .cart-items-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .cart-item-row { display: flex; align-items: center; justify-content: space-between; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.82rem; }
    .item-meta { display: flex; flex-direction: column; .sku { font-weight: 700; color: #111827; } .sub { font-size: 0.72rem; color: #6b7280; } .cost-context { margin-top: .15rem; color: #047857; font-size: .68rem; font-weight: 650; } }

    .item-price-edit {
      display: flex; align-items: center; border: 1px solid #d1d5db; border-radius: 6px; padding: 0 0.4rem; background: #ffffff;
      .curr { font-weight: 700; color: #059669; } .price-field { width: 60px; height: 32px; border: none; outline: none; font-weight: 700; text-align: right; font-size: 0.85rem; }
    }

    .del-cart-btn { background: transparent; border: none; cursor: pointer; }
    .clear-cart-btn { background: transparent; border: none; color: #ef4444; font-size: 0.78rem; font-weight: 700; cursor: pointer; }

    .cart-totals-pill { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.65rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; }
    .tot-row { display: flex; justify-content: space-between; &.main { font-size: 1rem; padding-top: 0.35rem; border-top: 1px dashed #a7f3d0; .grand-total { color: #059669; font-size: 1.15rem; } } }
    .tot-row.profit { color: #047857; font-weight: 700; }

    .payment-method-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
    .pm-btn { height: 40px; border: 1px solid #d1d5db; background: #ffffff; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; &.active { background: #059669; color: #ffffff; border-color: #059669; } }
    .sale-type-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; }
    .sale-type-tabs button { min-height: 42px; border: 1px solid #d1d5db; border-radius: 7px; background: #fff; color: #4b5563; font-weight: 700; }
    .sale-type-tabs button.active { border-color: #714b67; background: #714b67; color: #fff; }

    .submit-checkout-btn { height: 50px; background: #059669; color: #ffffff; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; cursor: pointer; &:disabled { opacity: 0.5; } }

    .invoice-receipt-card { background: #ffffff; border: 2px solid #059669; border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; }
    .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 0.5rem; .brand-title { font-weight: 900; font-size: 0.75rem; letter-spacing: 0.08em; color: #059669; } .paid-badge { background: #059669; color: #ffffff; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; } }
    .receipt-meta { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; }
    .meta-row { display: flex; justify-content: space-between; .lbl { color: #6b7280; } .val { font-weight: 700; color: #111827; &.code { font-family: monospace; } &.highlight { color: #059669; } } }
    .receipt-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; button { height: 44px; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; } .print-btn { background: #111827; color: #ffffff; } .next-btn { background: #059669; color: #ffffff; } }

    .lite-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; th { text-align: left; padding: 0.65rem 0.75rem; background: #f9fafb; color: #4b5563; font-weight: 700; border-bottom: 1px solid #e5e7eb; } td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #e5e7eb; } }
    .font-mono { font-family: monospace; } .font-bold { font-weight: 700; } .text-green-600 { color: #059669; }

    .status-pill { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; &.paid { background: #ecfdf5; color: #065f46; } &.issued { background: #fffbe6; color: #d97706; } &.draft { background: #f3f4f6; color: #4b5563; } }
    .collect-btn { min-height: 34px; border: 1px solid #d97706; border-radius: 6px; background: #fff; color: #92400e; font-size: .72rem; font-weight: 750; }
    .fulfill-btn { min-height: 34px; margin-left: .35rem; border: 1px solid #059669; border-radius: 6px; background: #fff; color: #065f46; font-size: .72rem; font-weight: 750; }
    .fulfillment-pill { display: inline-flex; padding: 2px 7px; border-radius: 999px; background: #fff7ed; color: #9a3412; font-size: .68rem; font-weight: 750; }
    .fulfillment-pill.fulfilled { background: #ecfdf5; color: #065f46; }
    .payment-recovery-card { display: grid; gap: .75rem; padding: .9rem; border: 1px solid #fcd34d; border-radius: 9px; background: #fffbeb; color: #78350f; }
    .payment-recovery-card strong, .payment-recovery-card span { display: block; }
    .payment-recovery-card span { margin-top: .18rem; font-size: .78rem; }
    .recovery-actions { display: flex; justify-content: flex-end; gap: .5rem; }
    .recovery-actions button { min-height: 40px; border: 1px solid #d1d5db; border-radius: 7px; padding: 0 .7rem; background: #fff; color: #374151; font-weight: 700; }
    .recovery-actions .confirm { border-color: #059669; background: #059669; color: #fff; }
    .status-alert { padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; &.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; } &.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; } }
    .dismiss-btn { background: transparent; border: none; font-weight: 700; cursor: pointer; }
  `],
})
export class MobileQuickSaleComponent implements OnInit {
  protected readonly activeTab = signal<'pos' | 'history'>('pos');
  protected readonly customers = signal<CustomerItem[]>([]);
  protected readonly availableInventory = signal<InventoryStockItem[]>([]);
  protected readonly completedSales = signal<SaleOrderRow[]>([]);
  protected readonly cart = signal<CartItem[]>([]);
  protected readonly selectedOutstandingSale = signal<SaleOrderRow | null>(null);

  selectedCustomerId = '';
  selectedSaleType: 'WHOLESALE' | 'EXPORT' = 'WHOLESALE';
  selectedPaymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' = 'CASH';
  scanQuery = '';

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly statusMessage = signal<string>('');
  protected readonly statusType = signal<'success' | 'error'>('success');

  // Issued Receipt Signals
  protected readonly issuedInvoice = signal<boolean>(false);
  protected readonly issuedInvoiceNumber = signal<string>('');
  protected readonly issuedCustomerName = signal<string>('');
  protected readonly issuedTotalAmount = signal<number>(0);

  readonly isDesktopView = signal<boolean>(window.innerWidth >= 1024);

  // Cart Computed Totals
  readonly cartTotalWeight = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.quantityKg || 0), 0);
  });

  readonly cartTotalAmount = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  });

  readonly cartExpectedProfit = computed(() => {
    return this.cart().reduce((sum, item) => sum + this.lineProfit(item), 0);
  });

  /** Materialized only when the cart changes; avoids O(stock × cart) template work. */
  readonly cartItemIds = computed(() => new Set(this.cart().map((item) => item.inventoryItem.id)));

  constructor(private readonly http: HttpClient) {}

  @HostListener('window:resize')
  onResize(): void {
    this.isDesktopView.set(window.innerWidth >= 1024);
  }

  ngOnInit(): void {
    this.fetchMasterData();
    this.fetchAvailableInventory();
    this.fetchSalesHistory();
  }

  isItemInCart(itemId: string): boolean {
    return this.cartItemIds().has(itemId);
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  protected trackByCartItem(_index: number, item: CartItem): string {
    return item.inventoryItem.id;
  }

  addItemToCart(item: InventoryStockItem): void {
    if (this.isItemInCart(item.id)) return;

    const quantityKg = item.weightKg || 1;
    const costPerKg = item.weightKg ? item.avgCost : 0;
    const defaultUnitPrice = Number((costPerKg * 1.35).toFixed(2)) || 5.0;

    const lineItem: CartItem = {
      inventoryItem: item,
      quantityKg,
      unitPrice: defaultUnitPrice,
      lineTotal: Number((quantityKg * defaultUnitPrice).toFixed(2)),
    };

    this.cart.update((prev) => [...prev, lineItem]);
  }

  scanAndAddStock(): void {
    const code = this.scanQuery.trim();
    if (!code) return;

    this.http.get<InventoryStockItem>(`${API_BASE_URL}/sales/scan/qr/${encodeURIComponent(code)}`).subscribe({
      next: (item) => {
        this.addItemToCart(item);
        this.scanQuery = '';
        this.statusType.set('success');
        this.statusMessage.set(`${item.repackUnit?.unitCode || 'Sealed unit'} added to the order.`);
      },
      error: (err) => {
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'This QR does not resolve to available sellable stock.');
      },
    });
  }

  removeCartItem(index: number): void {
    this.cart.update((prev) => prev.filter((_, i) => i !== index));
  }

  updateCartLinePrice(index: number, newPrice: number): void {
    this.cart.update((prev) => {
      const updated = [...prev];
      const line = updated[index];
      if (line) {
        line.unitPrice = newPrice;
        line.lineTotal = Number((line.quantityKg * newPrice).toFixed(2));
      }
      return updated;
    });
  }

  lineProfit(item: CartItem): number {
    return Number((item.quantityKg * (item.unitPrice - (item.inventoryItem.avgCost || 0))).toFixed(2));
  }

  createWalkInCustomer(): void {
    this.isSubmitting.set(true);
    this.http.post<any>(`${API_BASE_URL}/customers`, { name: 'Walk-in Wholesale Customer' }).subscribe({
      next: (c) => {
        this.isSubmitting.set(false);
        this.fetchMasterData();
        this.selectedCustomerId = c.id;
      },
      error: () => this.isSubmitting.set(false),
    });
  }

  private fetchMasterData(): void {
    this.http.get<any>(`${API_BASE_URL}/customers`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.customers.set(list);
        if (list.length > 0 && !this.selectedCustomerId) {
          this.selectedCustomerId = list[0].id;
        }
      },
      error: () => {},
    });
  }

  fetchAvailableInventory(): void {
    this.http.get<any>(`${API_BASE_URL}/inventory?status=AVAILABLE`).subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : (res?.data || res?.items || []);
        this.availableInventory.set(items);
      },
      error: () => {},
    });
  }

  fetchSalesHistory(): void {
    this.http.get<any>(`${API_BASE_URL}/sales`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        this.completedSales.set(list);
      },
      error: () => {},
    });
  }

  outstandingAmount(sale: SaleOrderRow): number {
    return Math.max(0, Number(sale.totalAmount || 0) - Number(sale.paidAmount || 0));
  }

  beginCollectPayment(sale: SaleOrderRow): void {
    this.selectedOutstandingSale.set(sale);
  }

  collectOutstandingPayment(): void {
    const sale = this.selectedOutstandingSale();
    if (!sale) return;
    const amount = this.outstandingAmount(sale);
    if (amount <= 0) return;

    this.isSubmitting.set(true);
    this.http.post(`${API_BASE_URL}/sales/${sale.id}/payments`, { amount, method: this.selectedPaymentMethod }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.selectedOutstandingSale.set(null);
        this.statusType.set('success');
        this.statusMessage.set(`Payment recorded for ${sale.saleNumber}.`);
        this.fetchSalesHistory();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Unable to record this payment.');
      },
    });
  }

  fulfillSale(sale: SaleOrderRow): void {
    this.isSubmitting.set(true);
    this.http.post(`${API_BASE_URL}/sales/${sale.id}/fulfill`, {}).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.statusType.set('success');
        this.statusMessage.set(`${sale.saleNumber} marked as physically handed over.`);
        this.fetchSalesHistory();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Unable to record fulfillment.');
      },
    });
  }

  checkoutSaleOrder(): void {
    if (!this.selectedCustomerId || this.cart().length === 0) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');
    this.issuedInvoice.set(false);

    this.http.post<any>(`${API_BASE_URL}/sales`, {
      customerId: this.selectedCustomerId,
      type: this.selectedSaleType,
    }).subscribe({
      next: (sale) => {
        const saleId = sale.id;

        const addLinePromises = this.cart().map((item) => {
          return this.http.post<any>(`${API_BASE_URL}/sales/${saleId}/lines`, {
            inventoryItemId: item.inventoryItem.id,
            measurementType: 'WEIGHT',
            quantity: item.quantityKg,
            unitPrice: item.unitPrice,
          }).toPromise();
        });

        Promise.all(addLinePromises)
          .then(() => {
            this.http.post<any>(`${API_BASE_URL}/sales/${saleId}/issue`, {}).subscribe({
              next: (issuedSale) => {
                const grandTotal = this.cartTotalAmount();

                this.http.post<any>(`${API_BASE_URL}/sales/${saleId}/payments`, {
                  amount: grandTotal,
                  method: this.selectedPaymentMethod,
                }).subscribe({
                  next: () => {
                    this.isSubmitting.set(false);
                    this.statusType.set('success');
                    this.statusMessage.set('Sale Completed & Receipt Generated!');

                    const cust = this.customers().find((c) => c.id === this.selectedCustomerId);
                    this.issuedInvoiceNumber.set(issuedSale.saleNumber || sale.saleNumber || 'SL-001');
                    this.issuedCustomerName.set(cust?.name || 'Walk-in Customer');
                    this.issuedTotalAmount.set(grandTotal);
                    this.issuedInvoice.set(true);

                    this.cart.set([]);
                    this.fetchAvailableInventory();
                    this.fetchSalesHistory();
                  },
                  error: (err) => {
                    this.isSubmitting.set(false);
                    this.statusType.set('error');
                    this.statusMessage.set(err?.error?.message || 'Sale was issued, but payment was not recorded. It remains payment pending in Sales history.');
                    this.fetchSalesHistory();
                  },
                });
              },
              error: (err) => {
                this.releaseDraftSale(saleId, err?.error?.message || 'Sale could not be issued. Reserved stock was released.');
              },
            });
          })
          .catch((err) => {
            this.releaseDraftSale(saleId, err?.error?.message || 'A sale line could not be added. Reserved stock was released.');
          });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to create sale order');
      },
    });
  }

  printReceipt(): void {
    window.print();
  }

  resetPosView(): void {
    this.issuedInvoice.set(false);
    this.statusMessage.set('');
  }

  /** A DRAFT sale owns reservations; cancellation returns them to AVAILABLE. */
  private releaseDraftSale(saleId: string, message: string): void {
    this.http.post(`${API_BASE_URL}/sales/${saleId}/cancel`, {}).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(message);
        this.fetchAvailableInventory();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(`${message} Please review the draft sale before retrying.`);
      },
    });
  }
}
