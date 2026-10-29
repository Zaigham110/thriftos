/** Shapes returned by the /stock/bales API. */

/** Graded stock a bale can be made from (oldest grading first). */
export interface AvailableStock {
  id: string;
  categoryId: string;
  categoryName: string;
  gradeId: string;
  gradeName: string;
  measurementType: 'WEIGHT' | 'QUANTITY';
  totalAmount: number | string;
  usedAmount: number | string;
  remainingAmount: number | string;
  allocatedCost: number | string;
  costPerKg: number | string;
  containerNumber?: string | null;
  ragCode?: string | null;
}

export interface Bale {
  id: string;
  unitCode: string;
  status: 'DRAFT' | 'READY' | 'SEALED' | 'SOLD' | 'RESERVED';
  weightKg: number | string;
  pcsCount: number;
  totalCost: number | string;
  measurementType: 'WEIGHT' | 'QUANTITY';
  createdAt: string;
  category?: { id: string; name: string } | null;
  grade?: { id: string; name: string } | null;
  qrLabel?: { qrCode: string } | null;
}

export interface MakeBaleRequest {
  categoryId: string;
  gradeId: string;
  weightKg: number;
  pieces?: number;
  /** Advanced: take stock from these graded outputs instead of FIFO. */
  allocations?: { gradingOutputId: string; amountKg: number }[];
  warehouseId?: string;
}

export interface Warehouse {
  id: string;
  name: string;
}
