import { MeasurementType } from '@prisma/client';
export declare class ManualAllocationDto {
    gradingOutputId: string;
    amountUsed: number;
}
export declare class CreateRepackUnitV2Dto {
    categoryId: string;
    gradeId: string;
    measurementType: MeasurementType;
    targetAmount: number;
    manualAllocations?: ManualAllocationDto[];
}
