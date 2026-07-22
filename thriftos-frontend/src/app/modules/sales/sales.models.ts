/**
 * SALES MODELS (Tenant)
 * ====================
 * Types mirror backend responses from `GET /api/sales` and `GET /api/sales/:id`.
 */

export type SaleType = 'WHOLESALE' | 'EXPORT';
export type SaleStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type MeasurementType = 'WEIGHT' | 'QUANTITY';

export interface Customer {
  id: string;
  name: string;
  companyName: string;
  billingAddress: string;
  shippingAddress: string;
  contactEmail: string;
  contactPhone: string;
  taxId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number | string;
  method: string;
  receivedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleListItem {
  id: string;
  saleNumber: string;
  customerId: string;
  type: SaleType;
  status: SaleStatus;
  currencyCode: string;
  totalAmount: number | string;
  totalCost?: number | string;
  totalProfit?: number | string;
  issuedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  customer?: Customer;
  payments?: Array<Pick<Payment, 'id' | 'amount' | 'method' | 'receivedAt'>>;
}

export interface SaleLineInventoryRef {
  id: string;
  unitCode: string;
  status: string;
  weightKg?: number | null;
  pcsCount?: number | null;
  category?: { id: string; name: string };
  grade?: { id: string; name: string };
  repackUnit?: {
    unitCode: string;
    measurementType: MeasurementType;
    qrLabel?: { qrCode: string } | null;
  };
}

export interface SaleLine {
  id: string;
  saleId: string;
  inventoryItemId: string;
  measurementType: MeasurementType;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  lineCost?: number | string;
  profit?: number | string;
  createdAt: string;
  updatedAt: string;

  inventoryItem?: SaleLineInventoryRef;
}

export interface SaleDetail {
  id: string;
  saleNumber: string;
  customerId: string;
  type: SaleType;
  status: SaleStatus;
  currencyCode: string;
  totalAmount: number | string;
  totalCost?: number | string;
  totalProfit?: number | string;
  issuedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  customer?: Customer;
  lines?: SaleLine[];
  payments?: Payment[];
}

export interface InventoryScanResult {
  inventoryItemId: string;
  unitCode: string;
  measurementType: MeasurementType;
  quantity: number;
  weightKg?: number | null;
  pcsCount?: number | null;
  categoryName?: string | null;
  gradeName?: string | null;
}
