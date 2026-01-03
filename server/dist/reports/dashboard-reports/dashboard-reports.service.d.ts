import { PrismaService } from '../../prisma/prisma.service';
type TrendPoint = {
    bucket: string;
    value: string;
};
export declare class DashboardReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    private resolveEffectiveRange;
    private resolvePreviousRange;
    private deltaPctLabel;
    private deltaAbsLabel;
    private procurementTotals;
    private procurementCostTrend;
    private sortingTotals;
    private sortingVolumeTrend;
    private sortingYieldWasteTrend;
    private categoryYield;
    summary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
        categoryId?: string;
        workerId?: string;
    }): Promise<{
        range: {
            startDate: string;
            endDate: string;
        };
        previousRange: {
            startDate: string;
            endDate: string;
        };
        kpis: {
            procurementCost: {
                value: string;
                change: string;
                sparkline: number[];
            };
            sortedWeightKg: {
                value: string;
                change: string;
                sparkline: number[];
            };
            yieldPct: {
                value: string;
                change: string;
                sparkline: number[];
            };
            wastePct: {
                value: string;
                change: string;
                sparkline: number[];
            };
        };
        analytics: {
            sortedVolumeTrend: TrendPoint[];
            categoryYield: {
                categoryId: string;
                inputWeightKg: string;
                outputWeightKg: string;
                wasteWeightKg: string;
                yieldPct: string;
            }[];
        };
        generatedAt: string;
    }>;
}
export {};
