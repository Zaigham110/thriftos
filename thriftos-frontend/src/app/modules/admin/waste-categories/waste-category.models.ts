export type WasteUnitType = 'KG' | 'PCS';

export interface WasteCategory {
  id: string;
  tenantId: string;
  name: string;
  linkedCategoryId: string | null;
  unitType: WasteUnitType;
  defaultResalePrice: string | number;
  isSystemGenerated: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  linkedCategory?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateWasteCategoryDto {
  name: string;
  unitType: WasteUnitType;
  defaultResalePrice: number;
}

export interface UpdateWasteCategoryDto {
  name?: string;
  unitType?: WasteUnitType;
  defaultResalePrice?: number;
  isActive?: boolean;
}
