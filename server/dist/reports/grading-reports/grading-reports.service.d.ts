import { PrismaService } from '../../prisma/prisma.service';
export declare class GradingReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    gradeDistribution(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        gradeId?: string;
        workerId?: string;
    }): Promise<{
        categoryId: string;
        gradeId: string;
        gradeWeightKg: string;
        gradePct: string;
        gradeCost: string;
        costPerKg: string;
    }[]>;
    gradingLoss(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        workerId?: string;
    }): Promise<{
        categoryId: string;
        inputWeightKg: string;
        wasteWeightKg: string;
        wastePct: string;
        wasteCost: string;
    }[]>;
}
