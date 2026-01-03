import { PrismaService } from '../../prisma/prisma.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
export declare class CostReportsService {
    private readonly prisma;
    private readonly consistency;
    constructor(prisma: PrismaService, consistency: ReportsConsistencyService);
    costCascade(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        warehouseId?: string;
    }): Promise<{
        procurement: {
            totalCost: number;
            weightKg: number;
            costPerKg: number;
        };
        sorting: {
            totalCost: number;
            weightKg: number;
            costPerKg: number;
        };
        grading: {
            totalCost: number;
            weightKg: number;
            costPerKg: number;
        };
        repack: {
            totalCost: number;
            weightKg: number;
            costPerKg: number;
        };
        final: {
            totalCost: number;
            weightKg: number;
            costPerKg: number;
        };
    }>;
    profitabilityReadiness(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        warehouseId?: string;
    }): Promise<{
        data: {
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            unitsReady: number;
            totalWeightKg: number;
            totalCost: number;
            avgCostPerKg: number;
        }[];
    }>;
    finalProductCostReport(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
    }): Promise<{
        data: {
            repackUnitId: string;
            productCode: string;
            unitType: string;
            categoryId: string;
            category: string;
            gradeId: string;
            grade: string;
            totalWeightKg: number;
            totalQty: number;
            totalCost: number;
            repackUnitTotalCost: number;
            costPerKg: number;
            costPerUnit: number;
            sourceContainers: number;
            sourceBales: number;
            allocationsCount: number;
            dateSealed: string;
        }[];
        summary: {
            totalUnits: number;
            totalWeightKg: number;
            totalCost: number;
        };
    }>;
}
