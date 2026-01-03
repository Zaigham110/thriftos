/**
 * Procurement Module Models
 * Phase 2: Procurement UI
 * 
 * TypeScript interfaces matching backend DTOs and Prisma models
 */

// =============================================================
// ENUMS
// =============================================================

export type PurchaseOrderType = 'CONTAINER' | 'LOOSE_BALE' | 'HYBRID';
export type PurchaseOrderStatus = 'OPEN' | 'RECEIVED' | 'CLOSED';
export type ContainerStatus = 'IN_TRANSIT' | 'ARRIVED' | 'CLEARED' | 'CLOSED';
export type ChargeType = 'CIF' | 'FREIGHT' | 'DUTY' | 'TAX' | 'PORT_HANDLING' | 'MISC';

// =============================================================
// VENDOR
// =============================================================

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  country: string | null;
  contactInfo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorRequest {
  name: string;
  country?: string;
  contactInfo?: string;
}

// =============================================================
// PURCHASE ORDER
// =============================================================

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  vendorId: string | null;
  poNumber: string;
  poType: PurchaseOrderType;
  currency: string;
  totalCost: number;
  status: PurchaseOrderStatus;
  createdAt: string;
  updatedAt: string;
  vendor?: Vendor;
  containers?: Container[];
  incomingBales?: IncomingBale[];
  _count?: {
    containers: number;
    incomingBales: number;
  };
}

export interface CreatePurchaseOrderRequest {
  poType: PurchaseOrderType;
  vendorId?: string;
}

export interface UpdatePurchaseOrderRequest {
  vendorId?: string;
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================
// CONTAINER
// =============================================================

export interface Container {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  containerNumber: string;
  referenceNumber: string | null;
  containerType: string | null;
  eta: string | null;
  etd: string | null;
  arrivedAt: string | null;
  clearedAt: string | null;
  releasedAt: string | null;
  grossWeight: number;
  netWeight: number;
  billOfLadingNumber: string | null;
  shipmentReference: string | null;
  shippingLine: string | null;
  vesselName: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  forwarder: string | null;
  notes: string | null;
  status: ContainerStatus;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: PurchaseOrder;
  containerCharges?: ContainerCharge[];
  incomingBales?: IncomingBale[];
  _count?: {
    containerCharges: number;
    incomingBales: number;
    rags: number;
  };
}

export interface CreateContainerRequest {
  purchaseOrderId: string;
  referenceNumber?: string;
  containerType?: string;
  eta?: string;
  etd?: string;
  arrivedAt?: string;
  clearedAt?: string;
  releasedAt?: string;
  grossWeight: number;
  netWeight: number;
  billOfLadingNumber?: string;
  shipmentReference?: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  forwarder?: string;
  notes?: string;
}

export interface UpdateContainerRequest {
  referenceNumber?: string;
  containerType?: string;
  eta?: string;
  etd?: string;
  arrivedAt?: string;
  clearedAt?: string;
  releasedAt?: string;
  grossWeight?: number;
  netWeight?: number;
  billOfLadingNumber?: string;
  shipmentReference?: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  forwarder?: string;
  notes?: string;
}

export interface UpdateContainerStatusRequest {
  status: ContainerStatus;
}

export interface ContainerListResponse {
  data: Container[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================
// CONTAINER CHARGES
// =============================================================

export interface ContainerCharge {
  id: string;
  containerId: string;
  description: string;
  amount: number;
  chargeType: ChargeType;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContainerChargeRequest {
  description: string;
  amount: number;
  chargeType: ChargeType;
}

// =============================================================
// COST BREAKDOWN
// =============================================================

export interface CostBreakdown {
  containerId: string;
  containerNumber: string;
  totalCost: number;
  costPerKg: number;
  totalWeight: number;
  charges: ContainerCharge[];
  currency: string;
}

// =============================================================
// INCOMING BALE (Loose Bale)
// =============================================================

export interface IncomingBale {
  id: string;
  tenantId: string;
  purchaseOrderId: string | null;
  containerId: string | null;
  vendorId: string | null;
  baleCode: string;
  categoryId: string | null;
  categoryGuess: string | null;
  rawCategoryId?: string | null;
  weightKg: number;
  cost: number;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: PurchaseOrder;
  container?: Container;
  vendor?: Vendor;
  rawCategory?: {
    id: string;
    name: string;
  } | null;
  sortSessions?: Array<{
    id: string;
    status: string;
  }>;
}

export interface CreateIncomingBaleRequest {
  purchaseOrderId: string;
  containerId?: string;
  vendorId?: string;
  rawCategoryId: string;
  weightKg: number;
  cost?: number;
}

export interface UpdateIncomingBaleRequest {
  purchaseOrderId?: string | null;
  containerId?: string | null;
  vendorId?: string;
  rawCategoryId?: string;
  weightKg?: number;
  cost?: number;
}

export interface IncomingBaleListResponse {
  data: IncomingBale[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================
// DASHBOARD STATS
// =============================================================

export interface ProcurementChartPoint {
  label: string;
  value: number;
}

export interface ProcurementVendorDistributionRow {
  vendorId: string | null;
  vendorName: string;
  totalCost: string;
  sharePct: number;
}

export interface ProcurementDashboardSummary {
  range: { startDate: string; endDate: string };
  currency: string;
  kpis: {
    activePos: number;
    remainingBudget: string;
    containersInTransit: number;
    looseBalesReceived: number;
  };
  charts: {
    poSpendVsAllocated: ProcurementChartPoint[];
    vendorDistribution: ProcurementVendorDistributionRow[];
  };
  generatedAt: string;
}

export interface ProcurementDashboardSummaryResponse {
  data: ProcurementDashboardSummary;
}

// =============================================================
// API FILTER PARAMS
// =============================================================

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus;
  page?: number;
  limit?: number;
}

export interface ContainerFilters {
  purchaseOrderId?: string;
  status?: ContainerStatus;
  page?: number;
  limit?: number;
}

export interface IncomingBaleFilters {
  containerId?: string;
  purchaseOrderId?: string;
  vendorId?: string;
  standalone?: boolean;
  page?: number;
  limit?: number;
}
