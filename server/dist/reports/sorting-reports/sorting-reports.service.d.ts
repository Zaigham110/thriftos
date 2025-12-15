import { PrismaService } from '../../prisma/prisma.service';
export declare class SortingReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    categoryYieldReport(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        workerId?: string;
    }): Promise<{
        categoryId: string;
        inputWeightKg: string;
        outputWeightKg: string;
        wasteWeightKg: string;
        yieldPct: string;
    }[]>;
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
}
