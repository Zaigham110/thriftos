import { PrismaService } from '../../prisma/prisma.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
export declare class RepackReportsService {
    private readonly prisma;
    private readonly consistency;
    constructor(prisma: PrismaService, consistency: ReportsConsistencyService);
    repackEfficiency(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        workerId?: string;
    }): Promise<{
        day: string;
        gradeInputWeightKg: number;
        repackOutputWeightKg: number;
        unitsProduced: number;
        avgUnitWeightKg: number;
    }[]>;
    repackSummary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
    }): Promise<{
        data: {
            status: string;
            units: number;
            totalWeightKg: number;
            totalPcs: number;
            totalCost: number;
        }[];
        summary: {
            totalUnits: number;
            totalWeightKg: number;
            totalPcs: number;
            totalCost: number;
        };
    }>;
    skuProductionSummary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        workerId?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        page: number;
        limit: number;
        total: number;
        data: {
            unitId: string;
            unitCode: string;
            unitType: import("@prisma/client").$Enums.UnitType;
            categoryId: string;
            categoryName: string;
            gradeId: string;
            gradeName: string;
            weightKg: number;
            pcsCount: number;
            totalCost: number;
            createdAt: Date;
        }[];
    }>;
}
