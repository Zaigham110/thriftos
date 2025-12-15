import { PrismaService } from '../../prisma/prisma.service';
export declare class CostReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    costCascade(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        warehouseId?: string;
    }): Promise<{
        steps: ({
            stage: string;
            totalCost: string;
            totalWeightKg: string;
            avgCostPerKg: string;
            totalPcs?: undefined;
            lockedCost?: undefined;
            totalKg?: undefined;
        } | {
            stage: string;
            totalCost: string;
            totalWeightKg: string;
            totalPcs: number;
            avgCostPerKg: string;
            lockedCost?: undefined;
            totalKg?: undefined;
        } | {
            stage: string;
            lockedCost: string;
            totalKg: string;
            totalPcs: number;
            totalCost?: undefined;
            totalWeightKg?: undefined;
            avgCostPerKg?: undefined;
        })[];
    }>;
    profitabilityReadiness(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        warehouseId?: string;
    }): Promise<{
        perKg: {
            categoryId: string;
            gradeId: string;
            totalKg: string;
            totalCost: string;
            avgCostPerKg: string;
        }[];
        perPcs: {
            categoryId: string;
            gradeId: string;
            totalPcs: number;
            totalCost: string;
            avgCostPerPcs: string;
        }[];
        perSku: {
            skuKey: string;
            unitType: string;
            categoryId: string;
            gradeId: string;
            units: number;
            totalCost: string;
            totalWeightKg: string;
            totalPcs: number;
        }[];
    }>;
}
