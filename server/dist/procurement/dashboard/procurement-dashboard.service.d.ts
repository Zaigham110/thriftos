import { PrismaService } from '../../prisma/prisma.service';
export declare class ProcurementDashboardService {
    private prisma;
    constructor(prisma: PrismaService);
    private resolveRange;
    summary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        range: {
            startDate: string;
            endDate: string;
        };
        currency: string;
        kpis: {
            activePos: number;
            remainingBudget: string;
            containersInTransit: number;
            looseBalesReceived: number;
        };
        charts: {
            poSpendVsAllocated: {
                label: string;
                value: number;
            }[];
            vendorDistribution: {
                vendorId: string;
                vendorName: string;
                totalCost: string;
                sharePct: number;
            }[];
        };
        generatedAt: string;
    }>;
}
