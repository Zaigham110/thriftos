import { PrismaService } from '../../prisma/prisma.service';
import { ReportsConsistencyService } from '../common/reports-consistency.service';
export declare class ProcurementReportsService {
    private readonly prisma;
    private readonly consistency;
    constructor(prisma: PrismaService, consistency: ReportsConsistencyService);
    containerCostBreakdown(tenantId: string, containerId: string): Promise<{
        containerId: string;
        containerCode: string;
        vendorName: string;
        landingDate: string;
        purchaseCost: number;
        shippingCost: number;
        dutiesCost: number;
        otherCosts: number;
        totalCost: number;
        totalWeightKg: number;
        costPerKg: number;
    }>;
    vendorProcurementSummary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        vendorId: string;
        vendorName: string;
        totalContainers: number;
        totalWeightKg: number;
        totalCost: number;
        avgCostPerKg: number;
    }[]>;
    procurementSummary(tenantId: string, filters: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        data: {
            purchaseOrderId: string;
            poNumber: string;
            poType: string;
            status: string;
            currency: string;
            vendorId: string;
            vendorName: string;
            createdAt: string;
            containers: {
                count: number;
                weightKg: number;
                cost: number;
            };
            looseBales: {
                count: number;
                weightKg: number;
                cost: number;
            };
            poTotalCost: number;
            computedProcurementCost: number;
            costDelta: number;
            matchesPoTotal: boolean;
        }[];
        summary: {
            avgCostPerKg: number;
            currency: string;
            totalPurchaseOrders: number;
            totalPoCost: number;
            totalContainers: number;
            totalContainerWeightKg: number;
            totalContainerCost: number;
            totalLooseBales: number;
            totalLooseBaleWeightKg: number;
            totalLooseBaleCost: number;
            totalComputedProcurementCost: number;
        };
    }>;
}
