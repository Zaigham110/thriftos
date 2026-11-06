/**
 * SALES MODELS (Tenant)
 * ====================
 * Types mirror backend responses from `GET /api/sales` and `GET /api/sales/:id`.
 */

export type SaleType = 'LOCAL' | 'WHOLESALE' | 'EXPORT';
export type PaymentMode = 'CASH' | 'CREDIT' | 'PARTIAL';
export type StockUnit = 'KG' | 'BALE' | 'PIECE';
export type SaleStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type MeasurementType = 'WEIGHT' | 'QUANTITY';

export interface Customer {
  id: string;
  name: string;
  /** WhatsApp number, E.164 (+923001234567). */
  phone?: string | null;
  city?: string | null;
  /** Udhaar carried from the old register (negative = advance). */
  openingBalance: string;
  companyName?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'CASH' | 'BANK' | 'RAAST' | 'JAZZCASH' | 'EASYPAISA' | 'OTHER';

export interface Payment {
  id: string;
  customerId: string;
  saleId?: string | null;
  amount: string;
  method: PaymentMethod;
  reference?: string | null;
  hasPhoto?: boolean;
  receivedAt: string;
  createdAt?: string;
}

export interface PaymentResult {
  payment: Payment;
  /** What the customer owes now (negative = advance). */
  balance: string;
  advance: string;
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
  billOfLadingNumber?: string | null;
  containerSealNumber?: string | null;
  vesselName?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  freightForwarder?: string | null;
  destinationCountry?: string | null;
  createdAt: string;
  updatedAt: string;
  fulfillmentStatus?: 'PENDING' | 'FULFILLED';
  fulfilledAt?: string | null;
  fulfillmentReference?: string | null;
  paymentMode: PaymentMode;
  billToken: string;
  /** Paid towards this sale and still due (payments are applied to the oldest debt first). */
  paid: string;
  due: string;

  customer?: Customer;
}

export interface SaleLine {
  id: string;
  saleId: string;
  inventoryItemId: string;
  unit: StockUnit;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  lineCost?: string;
  profit?: string;
  /** e.g. "Jeans A · TEN-JEA-A-20261030-0001" */
  description: string;
  createdAt: string;
}

export interface SaleDetail extends SaleListItem {
  createdBy: string;
  lines: SaleLine[];
  payments: Payment[];
  /** The customer's whole khata balance after this sale. */
  customerBalance: string;
  /** Payments that paid this bill, with the part of each applied to it (v2 review). */
  paidBy?: Array<Payment & { applied: string; withSale: boolean }>;
}

export interface SaleLineInput {
  inventoryItemId: string;
  unit?: StockUnit;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleRequest {
  customerId: string;
  lines: SaleLineInput[];
  paymentMode: PaymentMode;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
}

export interface LastPrice {
  unit: StockUnit;
  unitPrice: string | null;
  from: 'CUSTOMER' | 'ANY_CUSTOMER' | 'ITEM' | null;
}
