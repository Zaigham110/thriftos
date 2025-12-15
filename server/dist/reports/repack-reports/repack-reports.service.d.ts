import { PrismaService } from '../../prisma/prisma.service';
export declare class RepackReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    repackEfficiency(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        workerId?: string;
    }): Promise<{
        day: string;
        gradeInputWeightKg: string;
        repackOutputWeightKg: string;
        unitsProduced: number;
        avgUnitWeightKg: string;
    }[]>;
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
            weightKg: string;
            pcsCount: number;
            totalCost: string;
            createdAt: Date;
        }[];
    }>;
}
