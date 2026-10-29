/** Shapes returned by the /stock/bales API. */

/** Sorted stock a bale can be made from (oldest first): a grade output, or an ungraded category output. */
export interface AvailableStock {
  id: string;
  source: 'GRADE' | 'CATEGORY';
  categoryId: string;
  categoryName: string;
  gradeId: string | null;
  gradeName: string | null;
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
  /** Leave out to make the bale from category outputs (one-stage sorting). */
  gradeId?: string;
  weightKg: number;
  pieces?: number;
  /** Advanced: take stock from these graded outputs instead of FIFO. */
  allocations?: ({ gradingOutputId: string; amountKg: number } | { categoryOutputId: string; amountKg: number })[];
  warehouseId?: string;
}

export interface Warehouse {
  id: string;
  name: string;
}
