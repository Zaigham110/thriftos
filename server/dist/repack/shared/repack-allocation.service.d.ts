import { PrismaService } from '../../prisma/prisma.service';
import { MeasurementType, Prisma } from '@prisma/client';
export interface ManualAllocationInput {
    gradingOutputId: string;
    amountUsed: number;
}
export interface AllocationResult {
    allocations: {
        id: string;
        gradingOutputId: string;
        amountUsed: number;
        containerId: string | null;
        ragBaleId: string | null;
    }[];
    totalAllocated: number;
    totalCost: number;
}
export declare class RepackAllocationService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private runInTx;
    appendManualAllocations(tenantId: string, repackUnitId: string, categoryId: string, gradeId: string, measurementType: MeasurementType, remainingTarget: number, manualAllocations: ManualAllocationInput[], tx?: Prisma.TransactionClient): Promise<AllocationResult>;
    deallocateSingle(tenantId: string, allocationId: string, tx?: Prisma.TransactionClient): Promise<{
        repackUnitId: string;
        gradingOutputId: string;
        amountRestored: number;
        costRestored: number;
    }>;
    allocateFIFO(tenantId: string, repackUnitId: string, categoryId: string, gradeId: string, measurementType: MeasurementType, targetAmount: number): Promise<AllocationResult>;
    allocateManual(tenantId: string, repackUnitId: string, measurementType: MeasurementType, targetAmount: number, manualAllocations: ManualAllocationInput[]): Promise<AllocationResult>;
    deallocate(tenantId: string, repackUnitId: string): Promise<void>;
    getAvailableStock(tenantId: string, categoryId: string, gradeId: string, measurementType: MeasurementType): Promise<{
        id: string;
        gradeId: string;
        gradeName: string;
        categoryId: string;
        categoryName: string;
        totalAmount: number;
        usedAmount: number;
        remainingAmount: number;
        measurementType: import("@prisma/client").$Enums.MeasurementType;
        status: import("@prisma/client").$Enums.GradingOutputStatus;
        allocatedCost: number;
        containerId: string;
        containerNumber: string;
        ragBaleCode: string;
        sortSessionId: string;
        gradeSessionId: string;
    }[]>;
}
