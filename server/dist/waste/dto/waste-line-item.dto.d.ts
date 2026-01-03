import { WasteStage, WasteUnitType } from '@prisma/client';
export declare class AddWasteLineItemDto {
    stage: WasteStage;
    wasteCategoryId: string;
    amount: number;
    sortSessionId?: string;
    gradeSessionId?: string;
}
export declare class UpdateWasteLineItemDto {
    wasteCategoryId: string;
    amount: number;
}
export type WasteLineItemResponse = {
    id: string;
    stage: WasteStage;
    amount: string;
    unitType: WasteUnitType;
    estimatedValue: string;
    wasteCategory: {
        id: string;
        name: string;
        unitType: WasteUnitType;
        defaultResalePrice: string;
    };
    createdAt: string;
    updatedAt: string;
};
