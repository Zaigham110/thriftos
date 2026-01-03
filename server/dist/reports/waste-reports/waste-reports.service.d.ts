import { PrismaService } from '../../prisma/prisma.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
export declare class WasteReportsService {
    private readonly prisma;
    private readonly consistency;
    constructor(prisma: PrismaService, consistency: ReportsConsistencyService);
    wasteByStage(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        procurementWasteKg: number;
        sortingStage1WasteKg: number;
        gradingStage2WasteKg: number;
    }>;
    wasteCostImpact(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        procurement: {
            wasteKg: number;
            wasteCost: number;
        };
        sortingStage1: {
            wasteKg: number;
            wasteCost: number;
        };
        gradingStage2: {
            wasteKg: number;
            wasteCost: number;
        };
    }>;
}
