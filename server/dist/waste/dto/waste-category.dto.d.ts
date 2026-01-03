import { WasteUnitType } from '@prisma/client';
export declare class CreateWasteCategoryDto {
    name: string;
    unitType: WasteUnitType;
    defaultResalePrice: number;
}
export declare class UpdateWasteCategoryDto {
    name?: string;
    unitType?: WasteUnitType;
    defaultResalePrice?: number;
    isActive?: boolean;
}
