import { PrismaService } from '../../prisma/prisma.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
type TrendPoint = {
    bucket: string;
    value: string;
};
type YieldWasteTrendPoint = {
    bucket: string;
    yieldPct: string;
    wastePct: string;
};
export declare class SortingReportsService {
    private readonly prisma;
    private readonly consistency;
    constructor(prisma: PrismaService, consistency: ReportsConsistencyService);
    categoryYieldReport(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        workerId?: string;
    }): Promise<{
        categoryId: string;
        categoryName: string;
        inputWeightKg: number;
        outputWeightKg: number;
        wasteWeightKg: number;
        yieldPct: number;
    }[]>;
    sortingOutputs(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        workerId?: string;
    }): Promise<{
        stage1: {
            data: {
                categoryOutputId: string;
                createdAt: Date;
                categoryId: string;
                categoryName: string;
                weightKg: number;
                allocatedCost: number;
                sortSessionId: string;
                sortStatus: string;
                workerId: string;
                ragId: string;
                ragCode: string;
                containerId: string;
                containerNumber: string;
                purchaseOrderId: string;
                poNumber: string;
            }[];
            summary: {
                totalOutputs: number;
                totalWeightKg: number;
                totalAllocatedCost: number;
            };
        };
        stage2: {
            data: {
                gradingOutputId: string;
                createdAt: Date;
                gradeId: string;
                gradeName: string;
                categoryId: string;
                categoryName: string;
                weightKg: number;
                allocatedCost: number;
                totalAmount: number;
                usedAmount: number;
                remainingAmount: number;
                measurementType: string;
                status: string;
                gradeSessionId: string;
                gradeStatus: string;
                workerId: string;
                categoryOutputId: string;
                sortSessionId: string;
                ragId: string;
                ragCode: string;
                containerId: string;
                containerNumber: string;
                purchaseOrderId: string;
                poNumber: string;
            }[];
            summary: {
                totalOutputs: number;
                totalWeightKg: number;
                totalAllocatedCost: number;
            };
        };
    }>;
    sortingWaste(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        workerId?: string;
    }): Promise<{
        data: {
            sortingWasteId: string;
            createdAt: Date;
            sortSessionId: string;
            workerId: string;
            ragId: string;
            ragCode: string;
            containerId: string;
            containerNumber: string;
            purchaseOrderId: string;
            poNumber: string;
            wasteWeightKg: number;
        }[];
        summary: {
            totalWasteKg: number;
            totalRecords: number;
        };
        categorized: {
            data: {
                wasteLineItemId: string;
                createdAt: Date;
                stage: "STAGE_1" | "STAGE_2";
                amount: number;
                unitType: "KG" | "PCS";
                estimatedValue: number;
                wasteCategoryId: string;
                wasteCategoryName: string;
                sortSessionId: string;
                gradeSessionId: string;
                workerId: string;
                ragId: string;
                ragCode: string;
                containerId: string;
                containerNumber: string;
                purchaseOrderId: string;
                poNumber: string;
            }[];
            byCategory: {
                stage: "STAGE_1" | "STAGE_2";
                wasteCategoryId: string;
                wasteCategoryName: string;
                unitType: "KG" | "PCS";
                totalAmount: number;
                totalEstimatedValue: number;
                totalRecords: number;
            }[];
            summary: {
                totalKg: number;
                totalPcs: number;
                totalEstimatedValue: number;
                totalRecords: number;
            };
        };
        combinedSummary: {
            totalWasteKg: number;
            totalWastePcs: number;
            totalEstimatedValue: number;
            legacyRecords: number;
            categorizedRecords: number;
        };
    }>;
    sortingEfficiency(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        workerId?: string;
    }): Promise<{
        workerId: string;
        sessionsHandled: number;
        inputWeightKg: string;
        outputWeightKg: string;
        wasteWeightKg: string;
        avgYieldPct: string;
        avgWastePct: string;
    }[]>;
    sortingVolumeTrend(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        workerId?: string;
    }): Promise<TrendPoint[]>;
    sortingYieldWasteTrend(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        workerId?: string;
    }): Promise<YieldWasteTrendPoint[]>;
}
export {};
