import { AllocationMode, MeasurementType } from '@prisma/client';
export declare class ManualAllocationInputDto {
    gradingOutputId: string;
    amountUsed: number;
}
export declare class CreateRepackUnitDto {
    repackSessionId: string;
    categoryId?: string;
    gradeId?: string;
    measurementType: MeasurementType;
    targetAmount: number;
    allocationMode: AllocationMode;
    manualAllocations?: ManualAllocationInputDto[];
}
export declare class UpdateRepackUnitDto {
    measurementType?: MeasurementType;
    targetAmount?: number;
    allocationMode?: AllocationMode;
    manualAllocations?: ManualAllocationInputDto[];
}
export declare class SealRepackUnitDto {
}
export declare class GetAvailableStockQueryDto {
    categoryId: string;
    gradeId: string;
    measurementType: MeasurementType;
}
