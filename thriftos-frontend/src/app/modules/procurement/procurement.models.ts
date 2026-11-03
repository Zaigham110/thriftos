/**
 * Procurement Module Models
 * Phase 2: Procurement UI
 * 
 * TypeScript interfaces matching backend DTOs and Prisma models
 */

// =============================================================
// ENUMS
// =============================================================

export type VendorType = 'SUPPLIER' | 'CUSTOMER' | 'SHIPPER' | 'CONSIGNEE' | 'OTHER';
export type PurchaseOrderType = 'CONTAINER' | 'LOOSE_BALE' | 'HYBRID';
export type PurchaseOrderStatus = 'OPEN' | 'RECEIVED' | 'CLOSED';
export type ContainerStatus = 'IN_TRANSIT' | 'ARRIVED' | 'CLEARED' | 'CLOSED';
/** CIF only appears on old containers; new ones keep the purchase price in Container.purchaseCost. */
export type ChargeType = 'CIF' | 'FREIGHT' | 'DUTY' | 'TAX' | 'CLEARING' | 'PORT_HANDLING' | 'TRANSPORT' | 'LABOUR' | 'MISC';

// =============================================================
// VENDOR
// =============================================================

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  vendorType?: VendorType | null;
  country: string | null;
  contactInfo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorRequest {
  name: string;
  vendorType?: VendorType;
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
  _count?: {
    containers: number;
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
  purchaseOrderId: string | null;
  vendorId?: string | null;
  vendor?: { id: string; name: string; originCountry?: string | null } | null;
  originCountry?: string | null;
  /** Purchase price in purchaseCurrency; landed cost = purchase (× fxRate unless PKR) + charges. */
  purchaseCost?: number | string;
  purchaseCurrency?: string;
  landedCostPKR?: number | string;
  containerNumber: string;
  referenceNumber: string | null;
  containerType: string | null;
  eta: string | null;
  etd: string | null;
  arrivedAt: string | null;
  clearedAt: string | null;
  releasedAt: string | null;
  grossWeight: number;
  tareWeight?: number | null;
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

  // Gate Weighbridge Scale Audit & Landed Cost FX
  weighbridgeGrossWeight?: number | null;
  weighbridgeTareWeight?: number | null;
  weighbridgeNetWeight?: number | null;
  weightVarianceKg?: number | null;
  weightVariancePct?: number | null;
  varianceAlertStatus?: 'OK' | 'VARIANCE_WARNING' | 'CRITICAL_DISCREPANCY' | null;
  fxRate?: number;
  landedCostPerKg?: number | null;

  createdAt: string;
  updatedAt: string;
  purchaseOrder?: PurchaseOrder;
  containerCharges?: ContainerCharge[];
  _count?: {
    containerCharges: number;
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
  grossWeightKg: number;
  netWeightKg: number;
  tareWeightKg?: number;
  billOfLadingNumber?: string;
  shipmentReference?: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  forwarder?: string;
  notes?: string;
  weighbridgeGrossWeight?: number;
  weighbridgeTareWeight?: number;
  fxRate?: number;
}

export interface UpdateContainerRequest {
  referenceNumber?: string;
  containerType?: string;
  status?: ContainerStatus;
  eta?: string;
  etd?: string;
  arrivedAt?: string;
  clearedAt?: string;
  releasedAt?: string;
  billOfLadingNumber?: string;
  shipmentReference?: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  forwarder?: string;
  notes?: string;
  weighbridgeGrossWeight?: number;
  weighbridgeTareWeight?: number;
  fxRate?: number;
}

export interface UpdateContainerWeightsRequest {
  grossWeightKg: number;
  tareWeightKg: number;
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

