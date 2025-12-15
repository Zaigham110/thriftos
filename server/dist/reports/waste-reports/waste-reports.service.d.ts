import { PrismaService } from '../../prisma/prisma.service';
export declare class WasteReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    wasteByStage(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        procurementWasteKg: string;
        sortingStage1WasteKg: string;
        gradingStage2WasteKg: string;
    }>;
    wasteCostImpact(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        procurement: {
            wasteKg: string;
            wasteCost: string;
        };
        sortingStage1: {
            wasteKg: string;
            wasteCost: string;
        };
        gradingStage2: {
            wasteKg: string;
            wasteCost: string;
        };
    }>;
}
